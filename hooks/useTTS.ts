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
        // Use Google Cloud TTS as primary provider
        const response = await fetch('/api/tts-google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voiceId: voiceId || 'en-US-Neural2-F', // WaveNet female voice
          }),
        });

        const data = await response.json();

        if (!data.success || !data.audio) {
          throw new Error(data.error || 'Google Cloud TTS failed');
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
        // Final fallback to native browser TTS
        console.warn('All cloud TTS failed, using native browser fallback:', err);

        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          utterance.onend = () => {
            setIsSpeaking(false);
            if (onEnd) {
              onEnd();
            }
          };

          utterance.onerror = () => {
            const errorMessage = 'Failed to play native speech';
            setError(errorMessage);
            setIsSpeaking(false);
            if (onError) {
              onError(errorMessage);
            }
          };

          window.speechSynthesis.speak(utterance);
        } else {
          const errorMessage = 'Text-to-speech not available';
          setError(errorMessage);
          setIsSpeaking(false);
          if (onError) {
            onError(errorMessage);
          }
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
