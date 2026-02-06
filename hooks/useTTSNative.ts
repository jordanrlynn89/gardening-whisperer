import { useState, useCallback, useRef, useEffect } from 'react';

interface UseTTSOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
  error: string | null;
  stop: () => void;
  unlockAudio: () => void;
}

/**
 * Use browser's native Speech Synthesis API (no API quota needed!)
 */
export function useTTSNative({
  onStart,
  onEnd,
  onError,
}: UseTTSOptions = {}): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('speechSynthesis' in window);
    if (!('speechSynthesis' in window)) {
      setError('Speech Synthesis not supported in this browser');
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!window.speechSynthesis) {
        const errorMsg = 'Speech Synthesis not available';
        console.error('[TTS Native]', errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      console.log('[TTS Native] Speaking:', text);
      setIsSpeaking(true);
      setError(null);

      // Wait for voices to load (important on Chrome!)
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        console.log('[TTS Native] Waiting for voices to load...');
        await new Promise<void>((resolve) => {
          window.speechSynthesis.onvoiceschanged = () => {
            console.log('[TTS Native] Voices loaded');
            resolve();
          };
          // Timeout after 1 second
          setTimeout(() => resolve(), 1000);
        });
        voices = window.speechSynthesis.getVoices();
      }

      console.log('[TTS Native] Available voices:', voices.length);

      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice settings
      utterance.rate = 1.0; // Normal speed
      utterance.pitch = 1.0; // Normal pitch
      utterance.volume = 1.0; // Full volume

      // Try to use a clear, consistent voice (Alex is known for reliability)
      const preferredVoice = voices.find(
        (v) =>
          v.name.includes('Alex') || // Male, very clear and consistent
          v.name.includes('Daniel') || // Male, British
          v.name.includes('Samantha') // Fallback
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('[TTS Native] Using voice:', preferredVoice.name);
      } else {
        console.log('[TTS Native] Using default voice');
      }

      return new Promise<void>((resolve) => {
        utterance.onstart = () => {
          console.log('[TTS Native] Started speaking:', text.substring(0, 50) + '...');
          if (onStart) onStart();
        };

        utterance.onend = () => {
          console.log('[TTS Native] Ended normally');
          setIsSpeaking(false);
          if (onEnd) onEnd();
          resolve();
        };

        utterance.onerror = (event) => {
          console.error('[TTS Native] Error:', event.error, event);
          const errorMsg = `Speech synthesis error: ${event.error}`;
          setError(errorMsg);
          setIsSpeaking(false);
          if (onError) onError(errorMsg);
          if (onEnd) onEnd();
          resolve(); // Still resolve to continue flow
        };

        utterance.onpause = () => {
          console.warn('[TTS Native] Paused unexpectedly');
        };

        utterance.onresume = () => {
          console.log('[TTS Native] Resumed');
        };

        utterance.onboundary = (event) => {
          console.log('[TTS Native] Boundary at char:', event.charIndex, 'word:', text.substring(event.charIndex, event.charIndex + 20));
        };

        console.log('[TTS Native] Calling speechSynthesis.speak()...');
        window.speechSynthesis.speak(utterance);
        console.log('[TTS Native] speak() called, pending:', window.speechSynthesis.pending, 'speaking:', window.speechSynthesis.speaking);
      });
    },
    [onStart, onEnd, onError]
  );

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      console.log('[TTS Native] STOP CALLED - Cancelling speech');
      console.trace('[TTS Native] Stop called from:');
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const unlockAudio = useCallback(() => {
    // No-op for native speech synthesis (no audio context to unlock)
    console.log('[TTS Native] No unlock needed for native speech synthesis');
  }, []);

  return {
    speak,
    isSpeaking,
    error,
    stop,
    unlockAudio,
  };
}
