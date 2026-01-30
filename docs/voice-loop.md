# Voice Loop Component

## Overview

The **Voice Loop** is the main component that integrates all three Week 1 technologies into a seamless voice-first conversation experience.

## Architecture

```
User Speaks → STT (Web Speech API) → Transcript
                                         ↓
                                     Gemini 3 Flash
                                         ↓
                              ┌──────────┴──────────┐
                              ↓                     ↓
                       Structured JSON        Spoken Response
                              ↓                     ↓
                       Coverage Tracking      TTS (ElevenLabs)
                                                    ↓
                                              User Hears
                                                    ↓
                                           [Loop Continues]
```

## Conversation Flow

1. **User speaks** → Web Speech API transcribes
2. **Silence detected** (2.5s) → Triggers processing
3. **Transcript sent to Gemini** → AI analyzes
4. **AI responds** → Two layers:
   - Layer 1: Coverage tracking, diagnosis data (displayed)
   - Layer 2: Natural language (spoken aloud)
5. **TTS speaks response** → User hears
6. **Auto-resume listening** → Loop continues

## Conversation States

The component manages four states:

- **Idle** 🌱 - Not active, waiting to start
- **Listening** 🎤 - Capturing user speech
- **Thinking** 🤔 - Processing with Gemini
- **Speaking** 🔊 - TTS playing response

## Features

### 1. Unified Controls
- **Start Conversation** - Begins voice loop
- **Stop** - Ends conversation immediately

### 2. Real-time Feedback
- Visual state indicator (pulsing dot)
- Current state display
- Live transcript preview
- Conversation history

### 3. Garden Walk Progress
- Displays coverage tracking from Gemini
- Shows which topics have been discussed:
  - Plant Identified
  - Symptoms Discussed
  - Environment Assessed
  - Care History Gathered

### 4. Auto-resume
- After AI speaks, automatically resumes listening
- Seamless turn-taking
- No manual intervention needed

## Usage

Simply replace your page content with:

```tsx
import { VoiceLoop } from '@/components/VoiceLoop';

export default function Home() {
  return <VoiceLoop />;
}
```

## State Management

The component coordinates three hooks:

```tsx
const {
  isListening,
  transcript,
  startListening,
  stopListening,
  resetTranscript
} = useSpeechRecognition();

const {
  messages,
  sendMessage,
  lastResponse,
  isLoading
} = useChat();

const {
  speak,
  isSpeaking,
  stop
} = useTTS();
```

## Turn-Taking Logic

Per CLAUDE.md requirements:

1. User speaks → Transcript accumulates
2. User pauses → 2.5 seconds of silence
3. Silence detected → Process transcript
4. Stop listening → Prevent overlap
5. Send to Gemini → Get response
6. Speak response → TTS plays
7. Response ends → Resume listening
8. Repeat

## Testing

Visit http://localhost:3000:

1. Click **"Start Conversation"**
2. Grant microphone access
3. Say: **"My tomato plant has yellowing leaves"**
4. Wait 2.5 seconds
5. Listen to AI response
6. Continue conversation naturally

## Example Conversation

```
USER: "My tomato plant has yellowing leaves"
[Silence 2.5s → Processing]

AI: "Got it. Tell me, are the yellow leaves mainly
     at the bottom of the plant or throughout?"
[Coverage: Plant Identified ✅, Symptoms Discussed ⏳]

USER: "Mostly at the bottom"
[Silence 2.5s → Processing]

AI: "I see. How much sun does your tomato get each day?"
[Coverage: Symptoms Discussed ✅, Environment Assessed ⏳]

...and so on until diagnosis is ready
```

## Conversation State Transitions

```
IDLE → [Start] → LISTENING
LISTENING → [Silence] → THINKING
THINKING → [Response Ready] → SPEAKING
SPEAKING → [Audio Ends] → LISTENING (if active)
SPEAKING → [Audio Ends] → IDLE (if stopped)
ANY STATE → [Stop] → IDLE
```

## Visual Design

- **Status Card** - White card with state indicator
- **Coverage Panel** - Grid showing garden walk progress
- **Conversation History** - Scrollable message list
- **Color Coding:**
  - User messages: Green background
  - AI messages: Earth tone background
  - Completed coverage: Green checkmarks
  - Pending coverage: Gray circles

## Error Handling

The component gracefully handles:
- Microphone permission denied
- Gemini API errors
- TTS failures
- Network issues

Errors are logged to console and component remains functional.

## Performance Notes

- Silence timer resets on each speech result
- Transcript accumulates until silence
- Auto-cleanup on unmount
- Prevents memory leaks

## Week 1 Requirements ✅

This component completes all Week 1 goals:

- ✅ Core voice loop (speak → AI responds audibly)
- ✅ Turn-based conversation
- ✅ Silence detection (2-3 seconds)
- ✅ Gemini integration with two-layer responses
- ✅ ElevenLabs TTS for spoken output
- ✅ Real-time feedback and state management

## Next Steps (Week 2+)

- [ ] Add photo capture flow
- [ ] Implement "Anything else?" soft prompt
- [ ] Add off-script deviation handling
- [ ] Enhance coverage tracking UI
- [ ] Add conversation summary
- [ ] Implement share feature

## Files

- `/components/VoiceLoop.tsx` - Main component
- `/hooks/useSpeechRecognition.ts` - STT hook
- `/hooks/useChat.ts` - Gemini integration hook
- `/hooks/useTTS.ts` - TTS hook
