'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Inline types for SpeechRecognition (Chrome-only, no extra type file needed)
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface UseSpeechCommandOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
}

export function useSpeechCommand({ onTranscript }: UseSpeechCommandOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const wantListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const getRecognitionAPI = useCallback((): SpeechRecognitionConstructor | null => {
    const w = window as unknown as Record<string, unknown>;
    return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionConstructor | null;
  }, []);

  const start = useCallback(() => {
    const API = getRecognitionAPI();
    if (!API) return;

    wantListeningRef.current = true;

    const recognition = new API();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      onTranscriptRef.current(transcript, isFinal);
    };

    recognition.onerror = () => {
      // Errors like 'no-speech' are recoverable; onend will fire and auto-restart
    };

    recognition.onend = () => {
      if (wantListeningRef.current) {
        // Auto-restart after silence or transient error
        try {
          recognition.start();
        } catch {
          // Already started or other issue — ignore
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [getRecognitionAPI]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { start, stop, isListening };
}
