# ElevenLabs Text-to-Speech Integration

## Overview

The ElevenLabs TTS integration converts Gemini's natural language responses into spoken audio, completing the voice interaction loop.

## Architecture

```
Gemini Response (Layer 2) → TTS API Route → ElevenLabs API → Audio (MP3)
                                                                    ↓
                                                            Browser Playback
```

## Files

- `/app/api/tts/route.ts` - Server-side ElevenLabs API integration
- `/hooks/useTTS.ts` - React hook for text-to-speech
- `/components/TTSTest.tsx` - Test component

## Usage

### Basic Usage

```tsx
import { useTTS } from '@/hooks/useTTS';

function MyComponent() {
  const { speak, isSpeaking, stop } = useTTS();

  const handleSpeak = async () => {
    await speak('Hello! I\'m your gardening assistant.');
  };

  return (
    <div>
      <button onClick={handleSpeak} disabled={isSpeaking}>
        Speak
      </button>
      {isSpeaking && <button onClick={stop}>Stop</button>}
    </div>
  );
}
```

### With Callbacks

```tsx
const { speak } = useTTS({
  onStart: () => console.log('Started speaking'),
  onEnd: () => console.log('Finished speaking'),
  onError: (error) => console.error('TTS error:', error),
});
```

### Custom Voice

```tsx
const { speak } = useTTS({
  voiceId: 'your_voice_id_here', // From ElevenLabs voice library
});
```

## API Reference

### useTTS Hook

```typescript
interface UseTTSOptions {
  voiceId?: string;           // ElevenLabs voice ID
  onStart?: () => void;       // Called when audio starts
  onEnd?: () => void;         // Called when audio ends
  onError?: (error: string) => void;  // Called on error
}

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;  // Speak text
  isSpeaking: boolean;                     // Currently speaking
  error: string | null;                     // Error message
  stop: () => void;                        // Stop current audio
}
```

## Default Voice

**Rachel** - Friendly, warm female voice (ID: `21m00Tcm4TlvDq8ikWAM`)

Perfect for the "Friendly Gardener" persona per CLAUDE.md.

## Finding More Voices

Visit the ElevenLabs Voice Library:
https://elevenlabs.io/voice-library

Copy the voice ID and use it in the `voiceId` option.

## Voice Settings

Current configuration (in `/app/api/tts/route.ts`):
- **Model:** `eleven_monolingual_v1` (English-only, fastest)
- **Stability:** 0.5 (balanced between consistency and expressiveness)
- **Similarity Boost:** 0.75 (more similar to original voice)

## Audio Format

- **Format:** MP3
- **Encoding:** Base64 data URI
- **Playback:** HTML5 Audio element

## Integration with Gemini

The TTS hook is designed to work with Gemini's Layer 2 responses:

```tsx
import { useChat } from '@/hooks/useChat';
import { useTTS } from '@/hooks/useTTS';

function VoiceLoop() {
  const { sendMessage, lastResponse } = useChat();
  const { speak, isSpeaking } = useTTS();

  const handleUserInput = async (text: string) => {
    const response = await sendMessage(text);

    if (response) {
      // Speak the natural language response (Layer 2)
      await speak(response.spokenResponse);
    }
  };
}
```

## Error Handling

The hook provides error states and callbacks:

```tsx
const { speak, error } = useTTS({
  onError: (err) => {
    // Handle error (e.g., show notification)
    console.error('TTS failed:', err);
  },
});

// Check error state
{error && <div>Error: {error}</div>}
```

## Testing

Visit http://localhost:3000 to test:
1. Type or select a test phrase
2. Click "Speak" to hear it
3. Click "Stop" to interrupt playback
4. Check console for event logs

## Environment Variables

Required in `.env.local`:
```
ELEVENLABS_API_KEY=sk_...
```

Get your API key at: https://elevenlabs.io/

## Rate Limits

ElevenLabs free tier:
- 10,000 characters/month
- ~10-15 minutes of audio

For production, consider upgrading to a paid plan.

## Security

- ✅ API key stored server-side only
- ✅ Never exposed to client
- ✅ All TTS requests go through `/api/tts` route

## Next Steps

- [ ] Integrate with full voice loop component
- [ ] Add automatic TTS after Gemini responses
- [ ] Implement voice interruption (stop TTS when user speaks)
- [ ] Add voice selection UI (optional)
