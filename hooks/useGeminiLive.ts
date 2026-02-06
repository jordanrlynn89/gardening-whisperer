'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseGeminiLiveReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendImage: (imageData: string, text?: string) => void;
  pauseMic: () => void;
  resumeMic: () => void;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  userTranscript: string;
  aiTranscript: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  error: string | null;
}

interface UseGeminiLiveOptions {
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onConnected?: () => void;
  onError?: (error: string) => void;
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

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    // Stop mic
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
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
  }, []);

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
    setUserTranscript('');
    setAiTranscript('');
    currentUserTranscriptRef.current = '';
    currentAiTranscriptRef.current = '';

    try {
      // Create AudioContext (must be from user gesture for iOS)
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;

      // Resume AudioContext (iOS requires this after user gesture)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Register audio worklet for mic capture
      const workletCode = `
        class PcmCaptureProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input && input[0]) {
              const float32 = input[0];
              // Convert float32 to int16
              const int16 = new Int16Array(float32.length);
              for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              this.port.postMessage(int16.buffer, [int16.buffer]);
            }
            return true;
          }
        }
        registerProcessor('pcm-capture', PcmCaptureProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Connect mic to worklet
      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(ctx, 'pcm-capture');
      workletNodeRef.current = workletNode;

      source.connect(workletNode);
      // Don't connect workletNode to destination (we don't want to hear ourselves)

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/gemini-live`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // Create a promise that resolves when setup_complete is received
      let resolveSetupComplete: (() => void) | null = null;
      const setupCompletePromise = new Promise<void>((resolve) => {
        resolveSetupComplete = resolve;
      });

      ws.onopen = () => {
        console.log('[useGeminiLive] WebSocket connected');
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary data = audio from Gemini
          enqueueAudio(event.data);
          return;
        }

        // Text data = JSON control message
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'setup_complete':
              console.log('[useGeminiLive] Session ready:', msg.sessionId);
              setIsConnected(true);
              setIsListening(true);
              optionsRef.current.onConnected?.();
              // Resolve the setup promise
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

            case 'turn_complete':
              // AI finished speaking — save messages and reset
              if (currentUserTranscriptRef.current.trim()) {
                setMessages((prev) => [
                  ...prev,
                  { role: 'user', content: currentUserTranscriptRef.current.trim() },
                ]);
              }
              if (currentAiTranscriptRef.current.trim()) {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: currentAiTranscriptRef.current.trim() },
                ]);
              }
              currentUserTranscriptRef.current = '';
              currentAiTranscriptRef.current = '';
              setUserTranscript('');
              setAiTranscript('');
              setIsListening(true);
              break;

            case 'interrupted':
              // User interrupted AI — stop playback
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

      ws.onclose = () => {
        console.log('[useGeminiLive] WebSocket closed');
        setIsConnected(false);
        setIsListening(false);
      };

      ws.onerror = (e) => {
        console.error('[useGeminiLive] WebSocket error:', e);
        setError('Connection failed');
        optionsRef.current.onError?.('Connection failed');
      };

      // Start sending mic audio to WebSocket (skip when paused)
      workletNode.port.onmessage = (event) => {
        if (ws.readyState === WebSocket.OPEN && !micPausedRef.current) {
          ws.send(event.data);
        }
      };

      // Wait for setup_complete with timeout
      try {
        await Promise.race([
          setupCompletePromise,
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini setup timeout (15s)')), 15000)
          ),
        ]);
        console.log('[useGeminiLive] ✅ Connection complete and ready');
      } catch (timeoutErr) {
        console.warn('[useGeminiLive] Setup timeout, but continuing anyway:', timeoutErr);
        // Don't throw - let it proceed, the onConnected callback will fire when setup_complete arrives
      }
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

  return {
    connect,
    disconnect,
    sendImage,
    pauseMic,
    resumeMic,
    isConnected,
    isListening,
    isSpeaking,
    userTranscript,
    aiTranscript,
    messages,
    error,
  };
}
