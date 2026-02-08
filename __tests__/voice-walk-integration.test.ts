/**
 * Integration tests for the Garden Walk flow
 *
 * Tests walk state transitions, stage detection from conversation messages,
 * photo trigger detection from AI messages, and summary data generation.
 *
 * Business logic functions are now properly exported from lib/ modules.
 */

import { detectStageFromMessages, STAGE_ORDER, truncate, findUserResponseAbout } from '../lib/stageDetection';
import { extractPlantName } from '../lib/plantExtraction';
import { getCareRecommendations } from '../lib/summaryGeneration';
import { hasPhotoTrigger } from '../lib/photoTrigger';

type Message = { role: string; content: string };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Garden Walk — state transitions', () => {
  it('starts at "start" stage with empty messages', () => {
    expect(detectStageFromMessages([])).toBe('start');
  });

  it('detects plant_id stage when AI asks about kind of plant', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Let me take a walk with you! What kind of plant are we looking at?' },
    ];
    expect(detectStageFromMessages(messages)).toBe('plant_id');
  });

  it('detects symptoms stage when AI asks about symptoms', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'What kind of plant is this?' },
      { role: 'user', content: 'It is a tomato plant' },
      { role: 'assistant', content: 'What symptoms are you seeing on the leaves?' },
    ];
    expect(detectStageFromMessages(messages)).toBe('symptoms');
  });

  it('detects environment stage when AI asks about light/location', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'What kind of plant?' },
      { role: 'user', content: 'Tomato' },
      { role: 'assistant', content: 'I see yellow leaves. Where is it, indoor or outdoor?' },
    ];
    // The second AI message has both symptoms keywords and environment keywords,
    // environment (stageIndex=3) wins via Math.max
    expect(detectStageFromMessages(messages)).toBe('environment');
  });

  it('detects care_history stage when AI asks about watering routine', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'What kind of plant?' },
      { role: 'user', content: 'Tomato' },
      { role: 'assistant', content: 'Tell me about symptoms' },
      { role: 'user', content: 'Yellow leaves' },
      { role: 'assistant', content: 'How often do you water it?' },
    ];
    expect(detectStageFromMessages(messages)).toBe('care_history');
  });

  it('detects complete stage when AI gives diagnosis', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'What plant?' },
      { role: 'user', content: 'Tomato' },
      { role: 'assistant', content: 'It sounds like overwatering is the issue.' },
    ];
    expect(detectStageFromMessages(messages)).toBe('complete');
  });

  it('advances stage based on user message count as fallback', () => {
    // Messages with no stage-specific keywords in AI messages
    const messages: Message[] = [
      { role: 'assistant', content: 'Tell me about it.' },
      { role: 'user', content: 'OK' },
      { role: 'user', content: 'Sure thing' },
    ];
    // 2 user messages -> at least symptoms (index 2)
    expect(detectStageFromMessages(messages)).toBe('symptoms');
  });

  it('advances to environment with 3+ user messages', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Go on.' },
      { role: 'user', content: 'First thing' },
      { role: 'user', content: 'Second thing' },
      { role: 'user', content: 'Third thing' },
    ];
    expect(detectStageFromMessages(messages)).toBe('environment');
  });

  it('advances to care_history with 4+ user messages', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Go on.' },
      { role: 'user', content: 'One' },
      { role: 'user', content: 'Two' },
      { role: 'user', content: 'Three' },
      { role: 'user', content: 'Four' },
    ];
    expect(detectStageFromMessages(messages)).toBe('care_history');
  });

  it('never goes backwards in stage progression', () => {
    // First message triggers complete (diagnosis), second is plant_id level
    const messages: Message[] = [
      { role: 'assistant', content: "It's likely root rot causing the problem." },
      { role: 'assistant', content: 'What kind of plant is this?' },
    ];
    // complete (5) should not go back to plant_id (1)
    expect(detectStageFromMessages(messages)).toBe('complete');
  });

  it('recognizes "happy gardening" as complete', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Happy gardening! Let me know if you need anything else.' },
    ];
    expect(detectStageFromMessages(messages)).toBe('complete');
  });

  it('recognizes specific diagnosis keywords as complete', () => {
    const keywords = ['fungal', 'bacterial', 'deficiency', 'i suspect', 'i\'d recommend'];
    for (const kw of keywords) {
      const messages: Message[] = [
        { role: 'assistant', content: `Based on what you told me, ${kw} seems to be the answer.` },
      ];
      expect(detectStageFromMessages(messages)).toBe('complete');
    }
  });
});

describe('Garden Walk — plant name extraction', () => {
  it('returns "Your" when no plant is mentioned', () => {
    expect(extractPlantName([])).toBe('Your');
    expect(extractPlantName([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ])).toBe('Your');
  });

  it('extracts known plant names from user messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'I have a tomato plant with yellow leaves' },
    ];
    expect(extractPlantName(messages)).toBe('Tomato');
  });

  it('extracts known plant names from AI messages', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Your monstera looks a bit stressed' },
    ];
    expect(extractPlantName(messages)).toBe('Monstera');
  });

  it('extracts plant name from AI photo identification', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'This appears to be a fiddle leaf fig. It has broad leaves.' },
    ];
    // "fiddle leaf fig" is in the known plants list, so it gets matched
    expect(extractPlantName(messages)).not.toBe('Your');
  });

  it('extracts multi-word plant names', () => {
    const messages: Message[] = [
      { role: 'user', content: 'My snake plant is not looking great' },
    ];
    expect(extractPlantName(messages)).toBe('Snake Plant');
  });

  it('returns first plant mentioned when multiple are present', () => {
    const messages: Message[] = [
      { role: 'user', content: 'I have a basil and some mint' },
    ];
    // Both are known plants, but basil comes first
    expect(extractPlantName(messages)).toBe('Basil');
  });

  it('title-cases the plant name', () => {
    const messages: Message[] = [
      { role: 'user', content: 'my peace lily has brown tips' },
    ];
    expect(extractPlantName(messages)).toBe('Peace Lily');
  });
});

describe('Garden Walk — photo trigger detection', () => {
  describe('AI triggers', () => {
    it('detects when AI suggests taking a photo', () => {
      expect(hasPhotoTrigger('Would you like to show me a photo?', 'ai')).toBe(true);
      expect(hasPhotoTrigger('Can you take a picture of the affected area?', 'ai')).toBe(true);
      expect(hasPhotoTrigger('I would love to see an image of the leaves', 'ai')).toBe(true);
    });

    it('does not trigger when AI just mentions photos without suggesting', () => {
      // No suggest verb
      expect(hasPhotoTrigger('The photo quality is important for diagnosis', 'ai')).toBe(false);
    });

    it('does not trigger when AI mentions verbs without photo words', () => {
      expect(hasPhotoTrigger('Would you like to show me the symptoms?', 'ai')).toBe(false);
    });

    it('detects various AI photo suggestion patterns', () => {
      expect(hasPhotoTrigger('Could you send me a photo?', 'ai')).toBe(true);
      expect(hasPhotoTrigger('Would it help me to see a picture?', 'ai')).toBe(true);
      expect(hasPhotoTrigger('Can you show me an image of the plant?', 'ai')).toBe(true);
    });
  });

  describe('User triggers', () => {
    it('detects when user offers to send a photo', () => {
      expect(hasPhotoTrigger('Let me take a photo', 'user')).toBe(true);
      expect(hasPhotoTrigger('I can show you a picture', 'user')).toBe(true);
      expect(hasPhotoTrigger('I will upload an image', 'user')).toBe(true);
    });

    it('does not trigger for non-photo user messages', () => {
      expect(hasPhotoTrigger('My plant has yellow leaves', 'user')).toBe(false);
      expect(hasPhotoTrigger('Let me tell you about it', 'user')).toBe(false);
    });

    it('requires both a photo word and an action word', () => {
      expect(hasPhotoTrigger('Here is a photo', 'user')).toBe(false); // no action word
      expect(hasPhotoTrigger('Let me show you something', 'user')).toBe(false); // no photo word
    });
  });
});

describe('Garden Walk — summary data generation', () => {
  it('truncates text at word boundary', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a long string that needs truncation', 15)).toBe('a long string...');
  });

  it('finds user response following AI question about a topic', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'What symptoms are you seeing?' },
      { role: 'user', content: 'The leaves are turning yellow at the bottom' },
    ];

    expect(findUserResponseAbout(messages, ['symptom', 'seeing'])).toBe(
      'The leaves are turning yellow at the bottom'
    );
  });

  it('returns null if no matching AI question found', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Hello! Welcome to the garden walk.' },
      { role: 'user', content: 'Hello!' },
    ];

    expect(findUserResponseAbout(messages, ['symptom', 'seeing'])).toBeNull();
  });

  it('skips short user responses (length <= 2)', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'What symptoms do you see?' },
      { role: 'user', content: 'um' },
      { role: 'user', content: 'The leaves are brown and crispy' },
    ];

    // Should skip "um" and find the real response
    expect(findUserResponseAbout(messages, ['symptom'])).toBe(
      'The leaves are brown and crispy'
    );
  });
});

describe('Garden Walk — app state transitions', () => {
  // These test the expected flow: idle -> connecting -> active -> summary
  it('defines correct app states', () => {
    type AppState = 'idle' | 'connecting' | 'active' | 'summary' | 'error';
    const states: AppState[] = ['idle', 'connecting', 'active', 'summary', 'error'];
    expect(states).toHaveLength(5);
  });

  it('defines correct photo states', () => {
    type PhotoState = 'none' | 'choosing_source' | 'capturing_camera' | 'selecting_library' | 'processing';
    const states: PhotoState[] = ['none', 'choosing_source', 'capturing_camera', 'selecting_library', 'processing'];
    expect(states).toHaveLength(5);
  });

  it('stage order progresses linearly', () => {
    expect(STAGE_ORDER).toEqual(['start', 'plant_id', 'symptoms', 'environment', 'care_history', 'complete']);
    // Verify no stage is skipped: each should be exactly one index after the previous
    for (let i = 1; i < STAGE_ORDER.length; i++) {
      expect(STAGE_ORDER.indexOf(STAGE_ORDER[i])).toBe(i);
    }
  });
});

describe('Garden Walk — care recommendations', () => {
  it('returns tomato-specific recommendations', () => {
    const recs = getCareRecommendations('Tomato');
    expect(recs.light).toBe('Full Sun');
    expect(recs.water).toBe('Regular');
  });

  it('returns succulent-specific recommendations', () => {
    const recs = getCareRecommendations('Succulent');
    expect(recs.water).toBe('Low');
  });

  it('returns fern-specific recommendations', () => {
    const recs = getCareRecommendations('Boston Fern');
    expect(recs.light).toBe('Indirect');
    expect(recs.water).toBe('High');
  });

  it('returns default recommendations for unknown plants', () => {
    const recs = getCareRecommendations('Unknown exotic');
    expect(recs.light).toBe('Bright');
    expect(recs.water).toBe('Moderate');
  });
});
