import { useEffect, useRef, useState, useCallback } from 'react';

interface UseDeepgramSpeechOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSilence?: () => void;
  silenceTimeout?: number;
}

interface UseDeepgramSpeechReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useDeepgramSpeech({
  onTranscript,
  onSilence,
  silenceTimeout = 2500,
}: UseDeepgramSpeechOptions = {}): UseDeepgramSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxRecordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  const onSilenceRef = useRef(onSilence);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  // Check if MediaRecorder is supported
  useEffect(() => {
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMediaRecorder = !!window.MediaRecorder;
    const supported = hasMediaDevices && hasMediaRecorder;

    console.log('[Deepgram] Browser capabilities:');
    console.log('  - navigator.mediaDevices:', !!navigator.mediaDevices);
    console.log('  - getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
    console.log('  - MediaRecorder:', !!window.MediaRecorder);
    console.log('  - User Agent:', navigator.userAgent);
    console.log('  - Supported:', supported);

    setIsSupported(supported);

    if (!supported) {
      const reason = !hasMediaDevices
        ? 'MediaDevices API not available'
        : !hasMediaRecorder
        ? 'MediaRecorder API not available'
        : 'Unknown reason';
      setError(`Audio recording is not supported: ${reason}`);
      console.error('[Deepgram] Not supported:', reason);
    }
  }, []);

  const sendAudioToDeepgram = useCallback(async (audioBlob: Blob) => {
    const requestId = Math.random().toString(36).substring(7);
    try {
      console.log('[Deepgram] Sending audio for transcription, ID:', requestId, 'size:', audioBlob.size);

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      await new Promise((resolve) => {
        reader.onloadend = resolve;
      });

      const base64Audio = reader.result as string;

      // Send to backend API
      console.log('[Deepgram] Fetching transcription API, ID:', requestId);
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Audio,
        }),
      });

      console.log('[Deepgram] Response received ID:', requestId, 'status:', response.status);
      const data = await response.json();
      console.log('[Deepgram] Response parsed ID:', requestId);

      console.log('[Deepgram] API response ID:', requestId, { success: data.success, hasTranscript: !!data.transcript, transcript: data.transcript });

      if (data.success && data.transcript) {
        console.log('[Deepgram] Received transcript:', data.transcript);

        setTranscript((prev) => {
          const updated = prev + data.transcript + ' ';
          console.log('[Deepgram] Updated transcript state:', updated.trim());
          if (onTranscriptRef.current) {
            onTranscriptRef.current(updated.trim(), data.isFinal);
          }
          return updated;
        });
      } else {
        console.log('[Deepgram] No transcript in response or not successful');
      }
    } catch (err) {
      console.error('[Deepgram] Transcription error:', err);
      setError('Failed to transcribe audio');
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      console.log('[Deepgram] Silence detected, chunk count:', audioChunksRef.current.length, 'total bytes:', audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0));
      if (onSilenceRef.current) {
        onSilenceRef.current();
      }
    }, silenceTimeout);
  }, [silenceTimeout]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      console.error('[Deepgram] MediaRecorder not supported');
      setError('Audio recording not supported');
      return;
    }

    if (isListeningRef.current) {
      console.log('[Deepgram] Already listening');
      return;
    }

    console.log('[Deepgram] Starting to listen...');

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      console.log('[Deepgram] Using MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('[Deepgram] Audio chunk received:', event.data.size, 'bytes');
          resetSilenceTimer();
        }
      };

      // Send audio when recording stops
      mediaRecorder.onstop = async () => {
        console.log('[Deepgram] Recording stopped, processing audio...');

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('[Deepgram] Audio blob size:', audioBlob.size, 'bytes');

          if (audioBlob.size > 0) {
            await sendAudioToDeepgram(audioBlob);
          }

          audioChunksRef.current = [];
        }
      };

      // Start recording in chunks (send every 2 seconds)
      mediaRecorder.start(2000);

      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
      resetSilenceTimer();

      // Maximum recording time of 10 seconds
      maxRecordingTimerRef.current = setTimeout(() => {
        console.log('[Deepgram] Max recording time reached (10s), stopping');
        stopListening();
      }, 10000);

      console.log('[Deepgram] Recording started');
    } catch (err) {
      console.error('[Deepgram] Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, resetSilenceTimer, sendAudioToDeepgram]);

  const stopListening = useCallback(() => {
    console.log('[Deepgram] Stopping recording...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
    }

    isListeningRef.current = false;
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (maxRecordingTimerRef.current) {
        clearTimeout(maxRecordingTimerRef.current);
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
