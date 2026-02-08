# Speech Recognition

## Overview

Speech recognition is handled natively by the Gemini Live API through a WebSocket connection. The browser captures microphone audio and streams it to Gemini Live, which processes speech-to-text internally as part of its multimodal conversation.

## Architecture

```
Browser Microphone -> MediaStream -> AudioWorklet -> PCM Audio
                                                        |
                                                   WebSocket
                                                        |
                                              Gemini Live API
                                                        |
                                            (STT + AI Response)
```

There is no separate speech recognition hook. The `useGeminiLive` hook manages both audio capture and speech processing in a single WebSocket session.

## How It Works

1. `useGeminiLive` opens a WebSocket to the local server (`/ws/gemini-live`)
2. The server proxies to Google's Gemini Live API
3. Browser captures microphone audio via `MediaStream` + `AudioWorklet`
4. Raw PCM audio is sent as base64 chunks over the WebSocket
5. Gemini Live processes audio natively (no separate STT step)
6. AI responses come back as audio + text transcription

## Key Hook

```tsx
import { useGeminiLive } from '@/hooks/useGeminiLive';
```

See `docs/voice-loop.md` for full usage.

## Files

- `/hooks/useGeminiLive.ts` - WebSocket connection, audio capture, and playback
- `/server/gemini-live-proxy.js` - Server-side WebSocket proxy to Gemini Live API
- `/server.js` - HTTP + WebSocket server setup

## Browser Compatibility

**Chrome-only** per project requirements. No fallback needed.
