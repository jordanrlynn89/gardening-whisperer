# Gemini API Integration

## Overview

The Gemini integration provides AI-powered responses following a two-layer pattern: structured JSON for app behavior and natural language text for spoken responses.

## Two-Layer Response Pattern

Per CLAUDE.md, every Gemini response contains:

### Layer 1: Structured JSON
Controls app behavior and state:
- **diagnosis** - Plant condition analysis with confidence levels
- **coverage** - Garden walk progress tracking
- **nextAction** - What the AI should do next
- **actions** - User action items

### Layer 2: Natural Language
Conversational text sent to ElevenLabs for speech synthesis.

## Architecture

```
User Input → API Route → Gemini Client → Gemini API
                ↓
          Two-Layer Response
                ↓
    ┌──────────┴──────────┐
    ↓                     ↓
Structured JSON     Spoken Response
    ↓                     ↓
App Behavior          TTS (ElevenLabs)
```

## Files

- `/lib/gemini.ts` - Gemini client with prompt engineering
- `/app/api/chat/route.ts` - Next.js API route
- `/hooks/useChat.ts` - React hook for client-side usage
- `/types/chat.ts` - TypeScript interfaces
- `/components/GeminiTest.tsx` - Test component

## Usage

```tsx
import { useChat } from '@/hooks/useChat';

function MyComponent() {
  const { messages, sendMessage, lastResponse, isLoading } = useChat();

  const handleSend = async () => {
    const response = await sendMessage('My tomato has yellow leaves');

    if (response) {
      // Layer 1: Structured data
      console.log(response.structured.diagnosis);
      console.log(response.structured.coverage);

      // Layer 2: Spoken response
      console.log(response.spokenResponse);
    }
  };
}
```

## Response Structure

```typescript
{
  structured: {
    nextAction: {
      type: 'ask_question' | 'suggest_photo' | 'provide_diagnosis' | 'wrap_up',
      question?: string,
      category?: 'plant_id' | 'symptoms' | 'environment' | 'care_history'
    },
    coverage: {
      plantIdentified: boolean,
      symptomsDiscussed: boolean,
      environmentAssessed: boolean,
      careHistoryGathered: boolean
    },
    diagnosis?: {
      condition: string,
      confidence: 'likely' | 'possible' | 'unlikely',
      symptoms: string[],
      reasoning: string,
      alternatives: string[]
    },
    actions?: {
      doToday: string[],
      checkInDays: number,
      ifWorsens: string[]
    }
  },
  spokenResponse: string
}
```

## System Prompt Design

The system prompt enforces:
- **Friendly Gardener persona** - Warm, encouraging, simple language
- **Short responses** - 2-3 sentences max for voice
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

When sufficient coverage is achieved, the AI moves to diagnosis.

## Multimodal Support

The integration supports image analysis:

```typescript
const imageData = 'data:image/jpeg;base64,...';
const response = await sendMessage('What's wrong with this?', imageData);
```

Gemini will analyze the image alongside the conversation context.

## Error Handling

The client provides a fallback response if Gemini fails or returns invalid JSON:
- Safe degradation
- User-friendly error messages
- Logs errors for debugging

## Model Configuration

Currently using **Gemini 2.0 Flash** (experimental):
- Fast responses for real-time conversation
- Multimodal capabilities (text + images)
- Temperature: 0.7 (balanced creativity/consistency)
- Max tokens: 1024 (concise responses)

## Testing

Visit http://localhost:3000 to test:
1. Type a gardening question
2. See the two-layer response
3. Watch coverage tracking update
4. Observe conversation flow

Example prompts:
- "My tomato plant has yellowing leaves"
- "It's in full sun and I water it daily"
- "The leaves are turning yellow from the bottom up"

## Environment Variables

Required in `.env.local`:
```
GEMINI_API_KEY=your_api_key_here
```

Get your API key at: https://ai.google.dev/

## Next Steps

- [ ] Integrate with Web Speech API for voice input
- [ ] Connect to ElevenLabs for TTS output
- [ ] Build unified voice loop component
- [ ] Add photo capture flow
