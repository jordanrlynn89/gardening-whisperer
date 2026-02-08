# Gemini API Integration

## Overview

The Gemini integration uses the **Gemini Live API** via WebSocket for real-time voice conversations, and the **Gemini REST API** for photo analysis.

## Architecture

### Voice Conversation (Gemini Live)

```
Browser -> WebSocket -> server.js -> gemini-live-proxy.js -> Gemini Live API
                                                                    |
                                                        Audio + Text Response
                                                                    |
                                                            Browser Playback
```

### Photo Analysis (Gemini REST)

```
Photo Capture -> /api/analyze-photo -> @google/genai SDK -> Gemini API
                                                                |
                                                       Text Analysis
                                                                |
                                                  Injected into Live Session
```

## Active SDK

- **`@google/genai`** (`^1.39.0`) - Used for both REST photo analysis and Live API proxy

## System Prompt

The system prompt lives in `server/gemini-live-proxy.js` (single canonical location). It enforces:
- **Friendly Gardener persona** - Warm, encouraging, simple language
- **Short responses** - Optimized for voice
- **Acknowledgment first** - "Got it." "I see."
- **Confidence language** - "likely/possible/unlikely" (no percentages)
- **Garden walk structure** - Semi-structured questioning with coverage tracking
- **Action-oriented** - Every diagnosis includes concrete next steps

## Garden Walk Coverage Tracking

The AI tracks conversation coverage across 4 categories:
1. **Plant ID** - What plant is it?
2. **Symptoms** - What's wrong?
3. **Environment** - Sun, water, soil conditions
4. **Care History** - What has the user done?

When sufficient coverage is achieved, the AI moves to diagnosis. Walk completion is detected server-side and signaled to the client via a `walk_complete` WebSocket message.

## Files

- `/server/gemini-live-proxy.js` - WebSocket proxy with system prompt
- `/app/api/analyze-photo/route.ts` - REST photo analysis endpoint
- `/hooks/useGeminiLive.ts` - Client-side WebSocket hook
- `/lib/plantExtraction.ts` - Plant name extraction from conversation
- `/lib/stageDetection.ts` - Client-side stage detection

## Environment Variables

Required in `.env.local`:
```
GEMINI_API_KEY=your_api_key_here
```

Get your API key at: https://ai.google.dev/
