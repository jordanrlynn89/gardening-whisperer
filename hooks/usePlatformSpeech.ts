import { useSpeechRecognition } from './useSpeechRecognition';
import { useMediaRecorderSpeech } from './useMediaRecorderSpeech';
import { Capacitor } from '@capacitor/core';

interface UsePlatformSpeechOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSilence?: () => void;
  silenceTimeout?: number;
  language?: string;
}

/**
 * Smart speech recognition hook that automatically chooses:
 * - MediaRecorder + Deepgram on iOS/Android (reliable on mobile)
 * - Web Speech API on desktop browsers (best experience)
 */
export function usePlatformSpeech(options: UsePlatformSpeechOptions) {
  const isNative = Capacitor.isNativePlatform();

  console.log('[usePlatformSpeech] Platform:', Capacitor.getPlatform(), 'isNative:', isNative);

  // Use Web Speech API everywhere for push-to-talk mode
  // MediaRecorder doesn't work in iOS WebView
  // Push-to-talk mode makes Web Speech API reliable enough
  return useSpeechRecognition(options);
}
