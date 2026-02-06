import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

interface UseCapacitorSpeechOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSilence?: () => void;
  silenceTimeout?: number;
}

interface UseCapacitorSpeechReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useCapacitorSpeech({
  onTranscript,
  onSilence,
  silenceTimeout = 2500,
}: UseCapacitorSpeechOptions = {}): UseCapacitorSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onSilenceRef = useRef(onSilence);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  // Check if running on native platform
  useEffect(() => {
    const checkSupport = async () => {
      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();

      console.log('[CapacitorSpeech] Platform:', platform);
      console.log('[CapacitorSpeech] Is native:', isNative);

      if (!isNative) {
        console.log('[CapacitorSpeech] Not on native platform');
        setIsSupported(false);
        return;
      }

      try {
        // Request permissions
        const permissionStatus = await VoiceRecorder.requestAudioRecordingPermission();
        console.log('[CapacitorSpeech] Permission status:', permissionStatus);

        if (permissionStatus.value) {
          setIsSupported(true);
        } else {
          setError('Microphone permission denied');
          setIsSupported(false);
        }
      } catch (err) {
        console.error('[CapacitorSpeech] Error checking support:', err);
        setIsSupported(false);
        setError('Voice recording not available');
      }
    };

    checkSupport();
  }, []);

  const sendAudioToDeepgram = useCallback(async (base64Audio: string) => {
    try {
      console.log('[CapacitorSpeech] Sending audio to Deepgram...');

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
        console.log('[CapacitorSpeech] Received transcript:', data.transcript);

        setTranscript((prev) => {
          const updated = prev + data.transcript + ' ';
          if (onTranscriptRef.current) {
            onTranscriptRef.current(updated.trim(), true);
          }
          return updated;
        });

        resetSilenceTimer();
      }
    } catch (err) {
      console.error('[CapacitorSpeech] Transcription error:', err);
      setError('Failed to transcribe audio');
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      console.log('[CapacitorSpeech] Silence detected');
      if (onSilenceRef.current) {
        onSilenceRef.current();
      }
    }, silenceTimeout);
  }, [silenceTimeout]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      console.error('[CapacitorSpeech] Voice recording not supported');
      return;
    }

    if (isListeningRef.current) {
      console.log('[CapacitorSpeech] Already listening');
      return;
    }

    console.log('[CapacitorSpeech] Starting recording...');

    try {
      await VoiceRecorder.startRecording();

      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
      resetSilenceTimer();

      // Record in chunks - stop and send every 2 seconds for responsiveness
      recordingIntervalRef.current = setInterval(async () => {
        try {
          console.log('[CapacitorSpeech] Stopping chunk...');
          const result = await VoiceRecorder.stopRecording();

          if (result.value && result.value.recordDataBase64) {
            const base64Audio = `data:audio/aac;base64,${result.value.recordDataBase64}`;
            await sendAudioToDeepgram(base64Audio);
          }

          // Immediately start recording again if still listening
          if (isListeningRef.current) {
            await VoiceRecorder.startRecording();
          }
        } catch (err) {
          console.error('[CapacitorSpeech] Error processing chunk:', err);
        }
      }, 2000);

      console.log('[CapacitorSpeech] Recording started');
    } catch (err) {
      console.error('[CapacitorSpeech] Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, resetSilenceTimer, sendAudioToDeepgram]);

  const stopListening = useCallback(async () => {
    console.log('[CapacitorSpeech] Stopping recording...');

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      const result = await VoiceRecorder.stopRecording();

      // Send final chunk if there's data
      if (result.value && result.value.recordDataBase64) {
        const base64Audio = `data:audio/aac;base64,${result.value.recordDataBase64}`;
        await sendAudioToDeepgram(base64Audio);
      }
    } catch (err) {
      console.error('[CapacitorSpeech] Error stopping recording:', err);
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    isListeningRef.current = false;
    setIsListening(false);
  }, [sendAudioToDeepgram]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (isListeningRef.current) {
        VoiceRecorder.stopRecording();
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
