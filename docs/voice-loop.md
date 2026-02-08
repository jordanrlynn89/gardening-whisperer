# Voice Loop Component

## Overview

The **Voice Loop** is the main component that integrates real-time voice conversation via Gemini Live into a seamless voice-first gardening assistant experience.

## Architecture

```
User Speaks -> Browser Mic -> WebSocket -> Gemini Live API
                                                |
                                          AI Audio Response
                                                |
                                    Browser Audio Playback
                                                |
                                          [Loop Continues]
```

The voice loop uses a single WebSocket connection through `useGeminiLive` to handle both speech-to-text and text-to-speech natively via Google's Gemini Live API. There are no separate STT or TTS hooks.

## Conversation Flow

1. **User speaks** -> Audio sent to Gemini Live via WebSocket
2. **Gemini processes** -> AI generates spoken response
3. **Audio streamed back** -> Played through browser audio
4. **Auto-resume listening** -> Loop continues

## Component States

The component manages five states:

- **Idle** - Not active, waiting to start
- **Connecting** - Establishing WebSocket connection
- **Active** - Live conversation (listening + speaking)
- **Summary** - Garden walk complete, showing summary
- **Error** - Connection or runtime error

## Key Integration

The component coordinates these hooks:

```tsx
const {
  connect,
  disconnect,
  sendText,
  pauseMic,
  resumeMic,
  isConnected,
  isListening,
  isSpeaking,
  userTranscript,
  aiTranscript,
  messages,
  messagesRef,
  error,
} = useGeminiLive({
  onSpeakingStart, onSpeakingEnd,
  onConnected, onError, onWalkComplete,
});
```

## Business Logic Modules

Pure business logic is extracted into separate modules:

- `lib/plantExtraction.ts` - Plant name detection from conversation
- `lib/stageDetection.ts` - Garden walk stage detection and summary extraction
- `lib/summaryGeneration.ts` - Summary data generation and care recommendations
- `lib/backgroundGradient.ts` - Dynamic gradient based on journey progress
- `lib/photoTrigger.ts` - Photo trigger detection from user/AI text

## Garden Walk Progress

The component tracks conversation progress through stages:
- **Start** -> **Plant ID** -> **Symptoms** -> **Environment** -> **Care History** -> **Complete**

Stage detection happens via keyword analysis of AI messages, with fallback to message count.

## Photo Flow

1. AI suggests or user requests a photo
2. Photo chooser modal appears (camera or library)
3. User captures/selects photo
4. Photo sent to `/api/analyze-photo` for Gemini vision analysis
5. Analysis result injected into the live conversation

## Files

- `/components/VoiceLoop.tsx` - Main component
- `/hooks/useGeminiLive.ts` - WebSocket + Gemini Live integration
- `/hooks/useAmbientSound.ts` - Background ambient sounds
- `/lib/plantExtraction.ts` - Plant name extraction
- `/lib/stageDetection.ts` - Stage detection and summaries
- `/lib/summaryGeneration.ts` - Summary generation
- `/lib/backgroundGradient.ts` - Dynamic gradients
- `/lib/photoTrigger.ts` - Photo trigger detection
