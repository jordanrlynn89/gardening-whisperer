import { useState, useCallback, useRef, useEffect } from 'react';

interface UseMediaRecorderSpeechOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSilence?: () => void;
  silenceTimeout?: number;
}

interface UseMediaRecorderSpeechReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * Speech recognition using MediaRecorder API + Deepgram
 * More reliable on iOS than Web Speech API
 */
export function useMediaRecorderSpeech({
  onTranscript,
  onSilence,
  silenceTimeout = 3500,
}: UseMediaRecorderSpeechOptions = {}): UseMediaRecorderSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(typeof MediaRecorder !== 'undefined');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onSilenceRef = useRef(onSilence);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  const sendAudioToDeepgram = useCallback(async (audioBlob: Blob) => {
    try {
      console.log('[MediaRecorderSpeech] Sending audio to Deepgram, size:', audioBlob.size);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Audio,
        }),
      });

      const data = await response.json();

      if (data.success && data.transcript) {
        console.log('[MediaRecorderSpeech] Received transcript:', data.transcript);

        setTranscript((prev) => {
          const updated = prev + data.transcript + ' ';
          if (onTranscriptRef.current) {
            onTranscriptRef.current(updated.trim(), true);
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('[MediaRecorderSpeech] Transcription error:', err);
      setError('Failed to transcribe audio');
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      console.log('[MediaRecorderSpeech] Silence detected');
      if (onSilenceRef.current) {
        onSilenceRef.current();
      }
    }, silenceTimeout);
  }, [silenceTimeout]);

  const startListening = useCallback(async () => {
    // Check if APIs are available
    if (typeof MediaRecorder === 'undefined') {
      const error = 'MediaRecorder API not available in this browser';
      console.error('[MediaRecorderSpeech]', error);
      alert('Voice recording not supported in this app.\n\nPlease use desktop Chrome for voice features.');
      setError(error);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = 'getUserMedia not available';
      console.error('[MediaRecorderSpeech]', error);
      alert('Microphone access not available.\n\nPlease use desktop Chrome for voice features.');
      setError(error);
      return;
    }

    if (!isSupported) {
      setError('MediaRecorder not supported');
      return;
    }

    if (isListeningRef.current) {
      console.log('[MediaRecorderSpeech] Already listening');
      return;
    }

    console.log('[MediaRecorderSpeech] Starting recording...');
    console.log('[MediaRecorderSpeech] Requesting microphone permission...');

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      console.log('[MediaRecorderSpeech] Microphone permission granted');

      // iOS doesn't support webm, try different formats
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      console.log('[MediaRecorderSpeech] Using MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[MediaRecorderSpeech] Recording stopped, processing...');

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendAudioToDeepgram(audioBlob);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        audioChunksRef.current = [];
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);

      startSilenceTimer();

      console.log('[MediaRecorderSpeech] Recording started');
    } catch (err) {
      console.error('[MediaRecorderSpeech] Failed to start:', err);
      console.error('[MediaRecorderSpeech] Error type:', typeof err);
      console.error('[MediaRecorderSpeech] Error name:', (err as any)?.name);
      console.error('[MediaRecorderSpeech] Error message:', (err as any)?.message);

      let errorMessage = 'Failed to start recording';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object') {
        errorMessage = JSON.stringify(err);
      }

      // Show alert to user on mobile
      if (typeof window !== 'undefined') {
        alert(`Microphone Error: ${errorMessage}\n\nPlease check:\n1. Microphone permissions granted?\n2. App has mic access in Settings?`);
      }

      setError(errorMessage);
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, sendAudioToDeepgram, startSilenceTimer]);

  const stopListening = useCallback(() => {
    console.log('[MediaRecorderSpeech] Stopping recording...');

    if (mediaRecorderRef.current && isListeningRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
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
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
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
