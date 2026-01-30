import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSilence?: () => void;
  silenceTimeout?: number; // milliseconds of silence before triggering onSilence
  language?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition({
  onTranscript,
  onSilence,
  silenceTimeout = 2500, // 2.5 seconds default (per CLAUDE.md: 2-3 seconds)
  language = 'en-US',
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef(false); // Track manual stops vs auto-stops

  // Check if Web Speech API is supported (Chrome-only per CLAUDE.md)
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) {
      setError('Web Speech API is not supported in this browser. Please use Chrome.');
      return;
    }

    // Initialize recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening after each result
    recognition.interimResults = true; // Get partial results while speaking
    recognition.lang = language;

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language]);

  // Reset silence timer
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      if (onSilence) {
        onSilence();
      }
    }, silenceTimeout);
  }, [onSilence, silenceTimeout]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    setError(null);
    setIsListening(true);

    const recognition = recognitionRef.current;

    // Handle results
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;

        if (result.isFinal) {
          finalText += transcriptPart + ' ';
        } else {
          interimText += transcriptPart;
        }
      }

      // Update interim transcript
      if (interimText) {
        setInterimTranscript(interimText);
        // Reset silence timer on any speech activity
        resetSilenceTimer();
      }

      // Update final transcript
      if (finalText) {
        setTranscript((prev) => {
          const updated = prev + finalText;
          if (onTranscript) {
            onTranscript(updated.trim(), true);
          }
          return updated;
        });
        setInterimTranscript('');

        // Reset silence timer after final transcript
        resetSilenceTimer();
      }

      // Notify of interim results too
      if (interimText && onTranscript) {
        onTranscript(interimText, false);
      }
    };

    // Handle errors
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setError(errorMessage);
      setIsListening(false);
    };

    // Handle end (can restart if needed)
    recognition.onend = () => {
      // Only stop if we manually triggered stop
      if (isStoppingRef.current) {
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        isStoppingRef.current = false;
      } else {
        // Auto-stopped by browser - restart to keep listening
        // But keep the silence timer running
        try {
          recognition.start();
        } catch (err) {
          console.error('Failed to restart recognition:', err);
          setIsListening(false);
        }
      }
    };

    // Start recognition
    try {
      recognition.start();
      resetSilenceTimer();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError('Failed to start speech recognition');
      setIsListening(false);
    }
  }, [isListening, onTranscript, resetSilenceTimer]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      isStoppingRef.current = true;
      recognitionRef.current.stop();
      setIsListening(false);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    }
  }, [isListening]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
