# Text-to-Speech

## Overview

Text-to-speech is now handled natively by the **Gemini Live API**. Audio responses are generated server-side by Gemini and streamed back to the browser via WebSocket. There is no separate ElevenLabs TTS integration in the current architecture.

## Architecture

```
Gemini Live API -> Audio Response (PCM) -> WebSocket -> Browser Audio Playback
```

## How It Works

1. Gemini Live generates spoken responses as part of its native multimodal output
2. Audio is streamed back through the WebSocket connection
3. `useGeminiLive` hook decodes and plays audio chunks via the Web Audio API
4. The hook exposes `isSpeaking` state for UI coordination

## Audio Playback

Audio playback is managed by `useGeminiLive` using:
- `AudioContext` for decoding audio chunks
- Queued buffer playback for smooth streaming
- Automatic ducking of ambient sounds during AI speech

## Integration

```tsx
import { useGeminiLive } from '@/hooks/useGeminiLive';

const { isSpeaking } = useGeminiLive({
  onSpeakingStart: () => { /* duck ambient sounds */ },
  onSpeakingEnd: () => { /* unduck ambient sounds */ },
});
```

## Files

- `/hooks/useGeminiLive.ts` - Audio playback and WebSocket management
- `/server/gemini-live-proxy.js` - Server-side proxy to Gemini Live API

## Note on ElevenLabs

The original design called for ElevenLabs TTS, but Gemini Live's native audio output replaced it. The `/app/api/tts/route.ts` endpoint may still exist for fallback scenarios but is not used in the primary voice loop flow.
