'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseGeminiLiveReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendImage: (imageData: string, text?: string) => void;
  sendText: (text: string) => void;
  pauseMic: () => void;
  resumeMic: () => void;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  userTranscript: string;
  aiTranscript: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  messagesRef: React.RefObject<{ role: 'user' | 'assistant'; content: string }[]>;
  error: string | null;
}

interface UseGeminiLiveOptions {
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onConnected?: () => void;
  onError?: (error: string) => void;
  onWalkComplete?: () => void;
}

// Gemini Live API expects 16kHz 16-bit PCM mono
const SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000; // Gemini outputs 24kHz audio

export function useGeminiLive(options: UseGeminiLiveOptions = {}): UseGeminiLiveReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio playback queue
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Mic pause control
  const micPausedRef = useRef(false);

  // Track accumulated transcripts for message history
  const currentUserTranscriptRef = useRef('');
  const currentAiTranscriptRef = useRef('');

  // Durable backup of messages — survives any React state quirks
  const messagesBackupRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Guard: prevent HMR unmount from killing an active connection
  const activeConnectionRef = useRef(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Clean up on unmount — but skip if we have an active connection (likely HMR)
  useEffect(() => {
    return () => {
      if (activeConnectionRef.current) {
        // HMR remount — schedule delayed cleanup so the new mount can reclaim
        const ws = wsRef.current;
        const timeout = setTimeout(() => {
          // If nobody reclaimed the connection in 3s, it's a real unmount
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, 3000);
        // Store timeout ID on the WebSocket so the new mount can cancel it
        if (ws) (ws as unknown as Record<string, unknown>)._hmrCleanupTimeout = timeout;
        return;
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush any pending transcripts into the messages array
  const commitPendingTranscripts = useCallback(() => {
    const userText = currentUserTranscriptRef.current.trim();
    const aiText = currentAiTranscriptRef.current.trim();

    if (userText || aiText) {
      console.log('[useGeminiLive] Committing pending transcripts — user:', userText.length, 'chars, ai:', aiText.length, 'chars');
      setMessages((prev) => {
        const next = [...prev];
        if (userText) next.push({ role: 'user', content: userText });
        if (aiText) next.push({ role: 'assistant', content: aiText });
        messagesBackupRef.current = next;
        return next;
      });
      currentUserTranscriptRef.current = '';
      currentAiTranscriptRef.current = '';
    }
  }, []);

  const cleanup = useCallback(() => {
    // Commit any in-flight transcripts before tearing down
    commitPendingTranscripts();

    activeConnectionRef.current = false;

    // Stop mic capture (worklet or script processor)
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Stop playback
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // already stopped
      }
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  }, [commitPendingTranscripts]);

  const playNextInQueue = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') return;

    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      optionsRef.current.onSpeakingEnd?.();
      return;
    }

    isPlayingRef.current = true;
    const samples = audioQueueRef.current.shift()!;

    const buffer = ctx.createBuffer(1, samples.length, PLAYBACK_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      currentSourceRef.current = null;
      playNextInQueue();
    };

    source.start();
  }, []);

  const enqueueAudio = useCallback(
    (pcmBytes: ArrayBuffer) => {
      // Convert 16-bit PCM bytes to Float32
      const int16 = new Int16Array(pcmBytes);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      audioQueueRef.current.push(float32);

      if (!isPlayingRef.current) {
        setIsSpeaking(true);
        optionsRef.current.onSpeakingStart?.();
        playNextInQueue();
      }
    },
    [playNextInQueue]
  );

  const connect = useCallback(async () => {
    setError(null);
    setMessages([]);
    messagesBackupRef.current = [];
    setUserTranscript('');
    setAiTranscript('');
    currentUserTranscriptRef.current = '';
    currentAiTranscriptRef.current = '';

    // Mark connection as active so HMR cleanup doesn't kill it
    activeConnectionRef.current = true;

    try {
      // ── Step 1: Audio setup FIRST (requires fresh user gesture on mobile) ──
      // On mobile browsers, AudioContext creation and getUserMedia must happen
      // close to the user tap. If we await the WebSocket (1-2s through tunnel)
      // first, the gesture expires and audio setup fails silently.
      console.log('[useGeminiLive] Creating AudioContext (user gesture)...');
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      console.log('[useGeminiLive] AudioContext ready, state:', ctx.state);

      // Start getUserMedia IMMEDIATELY while gesture is still fresh
      console.log('[useGeminiLive] Requesting mic access...');
      const micPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // ── Step 2: Start WebSocket + AudioWorklet + mic in PARALLEL ──
      // All three can proceed simultaneously, reducing total connection time.
      let useWorklet = false;
      const workletPromise = ctx.audioWorklet
        .addModule('/pcm-capture-processor.js')
        .then(() => {
          useWorklet = true;
          console.log('[useGeminiLive] AudioWorklet loaded');
        })
        .catch(() => {
          console.warn('[useGeminiLive] AudioWorklet unavailable, using ScriptProcessorNode fallback');
        });

      // ── Set up WebSocket + message handlers BEFORE Promise.all ──
      // setup_complete can arrive while we're still waiting for mic/worklet,
      // so the onmessage handler MUST be registered immediately.
      let resolveSetupComplete: (() => void) | null = null;
      const setupCompletePromise = new Promise<void>((resolve) => {
        resolveSetupComplete = resolve;
      });

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/gemini-live`;
      console.log('[useGeminiLive] Connecting WebSocket to', wsUrl);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // Register onmessage IMMEDIATELY so we never miss setup_complete
      ws.onmessage = (event) => {
        // Normalize data: some proxies (zrok, ngrok) convert text WebSocket
        // frames to binary. We need to detect JSON-as-binary vs actual audio.
        let jsonStr: string | null = null;

        if (event.data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(event.data);
          if (bytes.length > 0 && bytes[0] === 0x7b) {
            // First byte is '{' — might be JSON delivered as binary
            const decoded = new TextDecoder().decode(event.data);
            try {
              JSON.parse(decoded); // validate before committing
              jsonStr = decoded;
            } catch {
              // Not valid JSON despite starting with '{' — treat as audio
              enqueueAudio(event.data);
              return;
            }
          } else {
            // Actual PCM audio data
            enqueueAudio(event.data);
            return;
          }
        } else {
          // Normal text frame
          jsonStr = event.data;
        }

        try {
          const msg = JSON.parse(jsonStr!);

          switch (msg.type) {
            case 'setup_complete':
              console.log('[useGeminiLive] Session ready:', msg.sessionId);
              setIsConnected(true);
              setIsListening(true);
              optionsRef.current.onConnected?.();
              if (resolveSetupComplete) {
                resolveSetupComplete();
                resolveSetupComplete = null;
              }
              break;

            case 'input_transcript':
              currentUserTranscriptRef.current += msg.text;
              setUserTranscript((prev) => prev + msg.text);
              break;

            case 'output_transcript':
              currentAiTranscriptRef.current += msg.text;
              setAiTranscript((prev) => prev + msg.text);
              break;

            case 'turn_complete': {
              const userText = currentUserTranscriptRef.current.trim();
              const aiText = currentAiTranscriptRef.current.trim();
              console.log('[useGeminiLive] turn_complete — user:', userText.length, 'chars, ai:', aiText.length, 'chars');
              if (userText || aiText) {
                setMessages((prev) => {
                  const next = [...prev];
                  if (userText) next.push({ role: 'user', content: userText });
                  if (aiText) next.push({ role: 'assistant', content: aiText });
                  messagesBackupRef.current = next;
                  console.log('[useGeminiLive] Messages now:', next.length, 'entries');
                  return next;
                });
              }
              currentUserTranscriptRef.current = '';
              currentAiTranscriptRef.current = '';
              setUserTranscript('');
              setAiTranscript('');
              setIsListening(true);
              break;
            }

            case 'interrupted': {
              // Commit partial transcripts so interrupted turns aren't lost
              const partialUser = currentUserTranscriptRef.current.trim();
              const partialAi = currentAiTranscriptRef.current.trim();
              if (partialUser || partialAi) {
                console.log('[useGeminiLive] Committing interrupted turn — user:', partialUser.length, 'chars, ai:', partialAi.length, 'chars');
                setMessages((prev) => {
                  const next = [...prev];
                  if (partialUser) next.push({ role: 'user', content: partialUser });
                  if (partialAi) next.push({ role: 'assistant', content: partialAi });
                  messagesBackupRef.current = next;
                  return next;
                });
                currentUserTranscriptRef.current = '';
                currentAiTranscriptRef.current = '';
              }
              if (currentSourceRef.current) {
                try {
                  currentSourceRef.current.stop();
                } catch {
                  // already stopped
                }
                currentSourceRef.current = null;
              }
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              setIsSpeaking(false);
              setIsListening(true);
              break;
            }

            case 'connecting':
              console.log('[useGeminiLive] Server connecting to AI...');
              break;

            case 'walk_complete':
              console.log('[useGeminiLive] Walk complete signal received');
              optionsRef.current.onWalkComplete?.();
              break;

            case 'error':
              console.error('[useGeminiLive] Error from server:', msg.message);
              setError(msg.message);
              optionsRef.current.onError?.(msg.message);
              break;

            case 'closed':
              setIsConnected(false);
              setIsListening(false);
              break;
          }
        } catch (e) {
          console.error('[useGeminiLive] Failed to parse message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log(`[useGeminiLive] WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
        setIsConnected(false);
        setIsListening(false);
        // If connection drops unexpectedly (not a clean close from disconnect()),
        // surface it to the user so they're not staring at a frozen UI
        if (activeConnectionRef.current && event.code !== 1000) {
          const msg = 'Connection lost — please try again';
          setError(msg);
          optionsRef.current.onError?.(msg);
        }
      };

      const wsOpenPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timed out')), 10000);
        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[useGeminiLive] WebSocket connected');
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });

      // Wait for mic + WebSocket + worklet (worklet failure is OK)
      const [stream] = await Promise.all([
        Promise.race([
          micPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Microphone access timed out — please allow mic permission and try again')), 10000)
          ),
        ]),
        wsOpenPromise,
        Promise.race([
          workletPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 3000)), // 3s timeout, fallback is fine
        ]),
      ]);
      mediaStreamRef.current = stream;
      console.log('[useGeminiLive] Mic + WebSocket + audio processor all ready');

      // ── Step 3: Wire mic audio to WebSocket ──
      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      if (useWorklet) {
        const workletNode = new AudioWorkletNode(ctx, 'pcm-capture');
        workletNodeRef.current = workletNode;
        source.connect(workletNode);
        workletNode.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN && !micPausedRef.current) {
            ws.send(event.data);
          }
        };
      } else {
        const spNode = ctx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = spNode;
        source.connect(spNode);
        spNode.connect(ctx.destination);
        spNode.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN || micPausedRef.current) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          ws.send(int16.buffer);
        };
      }

      // ── Step 4: Connection is ready ──
      // Don't wait for setup_complete — the WebSocket is open, mic is wired,
      // and audio is flowing. Gemini will catch up and setup_complete will
      // still be processed by onmessage when it arrives.
      console.log('[useGeminiLive] Connection ready — mic and WebSocket wired');
      setIsConnected(true);
      setIsListening(true);
      optionsRef.current.onConnected?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      console.error('[useGeminiLive] Connect error:', err);
      setError(message);
      optionsRef.current.onError?.(message);
      cleanup();
      throw err;
    }
  }, [cleanup, enqueueAudio]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const pauseMic = useCallback(() => {
    micPausedRef.current = true;
    setIsListening(false);
  }, []);

  const resumeMic = useCallback(() => {
    micPausedRef.current = false;
    if (isConnected) {
      setIsListening(true);
    }
  }, [isConnected]);

  const sendImage = useCallback((imageData: string, text?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Strip data URL prefix if present
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;

    wsRef.current.send(
      JSON.stringify({
        type: 'image',
        imageData: base64,
        text: text || 'Here is a photo of my plant. What do you see?',
      })
    );
  }, []);

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'text',
        text,
      })
    );
  }, []);

  return {
    connect,
    disconnect,
    sendImage,
    sendText,
    pauseMic,
    resumeMic,
    isConnected,
    isListening,
    isSpeaking,
    userTranscript,
    aiTranscript,
    messages,
    messagesRef: messagesBackupRef,
    error,
  };
}
