# Web Speech API Integration

## Overview

The `useSpeechRecognition` hook provides a React interface to the browser's native Web Speech API for speech-to-text functionality.

## Features

- ✅ **Microphone permission handling** - Automatically requests and manages permissions
- ✅ **Live transcription** - Real-time interim results while speaking
- ✅ **Final transcription** - Confirmed text after pauses
- ✅ **Silence detection** - Configurable timeout (default: 2.5 seconds)
- ✅ **Error handling** - Clear error messages for common issues
- ✅ **Chrome-only support** - Per project requirements (no cross-browser needed)

## Usage

```tsx
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

function MyComponent() {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onTranscript: (text, isFinal) => {
      console.log('Transcript:', text, 'Final:', isFinal);
    },
    onSilence: () => {
      // Trigger "Anything else?" prompt after 2.5s of silence
      console.log('Silence detected');
    },
    silenceTimeout: 2500, // milliseconds
    language: 'en-US',
  });

  return (
    <div>
      <button onClick={startListening}>Start</button>
      <button onClick={stopListening}>Stop</button>
      <p>{transcript}</p>
    </div>
  );
}
```

## API Reference

### Hook Options

```typescript
interface UseSpeechRecognitionOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSilence?: () => void;
  silenceTimeout?: number; // default: 2500ms
  language?: string; // default: 'en-US'
}
```

### Return Values

```typescript
interface UseSpeechRecognitionReturn {
  isListening: boolean;          // Currently listening to speech
  transcript: string;             // Final confirmed transcript
  interimTranscript: string;      // Live interim results while speaking
  error: string | null;           // Error message if any
  isSupported: boolean;           // Whether Web Speech API is available
  startListening: () => void;     // Start speech recognition
  stopListening: () => void;      // Stop speech recognition
  resetTranscript: () => void;    // Clear transcript text
}
```

## Error Handling

The hook provides user-friendly error messages for common issues:

- **no-speech** - No speech detected
- **audio-capture** - No microphone found
- **not-allowed** - Microphone permission denied
- **network** - Network error occurred
- **unsupported** - Browser doesn't support Web Speech API

## Silence Detection

The silence timer works as follows:

1. User starts speaking → timer resets
2. User stops speaking (final result) → timer starts
3. After `silenceTimeout` ms → `onSilence` callback fires
4. Use this to implement the "Anything else?" pattern per CLAUDE.md

## Testing

A test component is available at `/components/SpeechTest.tsx`:

```bash
npm run dev
# Navigate to http://localhost:3000
# Click "Start Listening" and grant microphone access
# Start speaking to see transcription
```

## Browser Compatibility

**Chrome-only** per project requirements. No fallback needed.

## Files

- `/hooks/useSpeechRecognition.ts` - Main hook implementation
- `/types/speech.d.ts` - TypeScript declarations for Web Speech API
- `/components/SpeechTest.tsx` - Test component
- `/app/page.tsx` - Home page using the test component

## Next Steps

- [ ] Integrate with Gemini API to process transcripts
- [ ] Add conversation context management
- [ ] Connect to ElevenLabs TTS for responses
- [ ] Build main voice loop component
