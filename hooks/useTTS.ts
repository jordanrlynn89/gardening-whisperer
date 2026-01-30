import { useState, useCallback, useRef } from 'react';

interface UseTTSOptions {
  voiceId?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
  error: string | null;
  stop: () => void;
}

export function useTTS({
  voiceId,
  onStart,
  onEnd,
  onError,
}: UseTTSOptions = {}): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      // Stop any currently playing audio
      stop();

      setIsSpeaking(true);
      setError(null);

      if (onStart) {
        onStart();
      }

      try {
        // Call TTS API
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voiceId,
          }),
        });

        const data = await response.json();

        if (!data.success || !data.audio) {
          throw new Error(data.error || 'Failed to generate speech');
        }

        // Create and play audio
        const audio = new Audio(data.audio);
        audioRef.current = audio;

        // Handle audio events
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (onEnd) {
            onEnd();
          }
        };

        audio.onerror = () => {
          const errorMessage = 'Failed to play audio';
          setError(errorMessage);
          setIsSpeaking(false);
          audioRef.current = null;
          if (onError) {
            onError(errorMessage);
          }
        };

        // Play audio
        await audio.play();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsSpeaking(false);
        console.error('TTS error:', err);
        if (onError) {
          onError(errorMessage);
        }
      }
    },
    [voiceId, onStart, onEnd, onError, stop]
  );

  return {
    speak,
    isSpeaking,
    error,
    stop,
  };
}
