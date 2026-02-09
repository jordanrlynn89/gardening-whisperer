import type { JourneyStage } from '@/components/GardenJourney';
import { extractPlantName } from './plantExtraction';

export const STAGE_ORDER: JourneyStage[] = ['start', 'plant_id', 'symptoms', 'environment', 'care_history', 'complete'];

/**
 * Truncate text to maxLen, ending at a word boundary.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.5 ? cut.substring(0, lastSpace) : cut) + '...';
}

/**
 * Clean up user response by removing filler words, hesitations, and making it concise.
 */
function cleanUserResponse(text: string): string {
  // Remove leading/trailing whitespace
  let cleaned = text.trim();

  // Remove common filler words and hesitations at the start
  const fillerPrefixes = [
    /^(?:yeah|yes|yep|sure|okay|ok|well|um|uh|like|so|hmm|ah|oh),?\s+/i,
    /^(?:i mean|you know|basically|actually|honestly|i think),?\s+/i,
  ];

  for (const pattern of fillerPrefixes) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove trailing filler phrases
  cleaned = cleaned.replace(/,?\s+(?:you know|i think|i guess|or something|and stuff)\.?$/i, '');

  // Remove standalone filler words if they're the only content
  const fillerWords = ['yeah', 'yes', 'yep', 'um', 'uh', 'okay', 'ok'];
  const cleanedLower = cleaned.toLowerCase().replace(/[.,;:!?]/g, '');
  if (fillerWords.includes(cleanedLower)) {
    return '';
  }

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*$/, '');

  return cleaned;
}

/**
 * Find the first user response that answers a question about a given topic.
 * Pairs AI questions with the user reply that follows.
 */
export function findUserResponseAbout(
  messages: { role: string; content: string }[],
  aiTopicKeywords: string[],
): string | null {
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role !== 'assistant') continue;
    const aiLower = messages[i].content.toLowerCase();
    if (aiTopicKeywords.some(kw => aiLower.includes(kw))) {
      // Find next user message
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].role === 'user' && messages[j].content.trim().length > 2) {
          const cleaned = cleanUserResponse(messages[j].content);
          return cleaned || null;
        }
      }
    }
  }
  return null;
}

/**
 * Extract summary for each stage by pulling actual conversation content.
 */
export function extractStageSummary(
  messages: { role: string; content: string }[],
  stage: 'plant_id' | 'symptoms' | 'environment' | 'care_history' | 'diagnosis',
): string {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
  const aiMessages = messages.filter(m => m.role === 'assistant').map(m => m.content);

  if (stage === 'plant_id') {
    const plantName = extractPlantName(messages);
    if (plantName !== 'Your') return `${plantName} plant`;
    if (userMessages.length > 0) {
      const cleaned = cleanUserResponse(userMessages[0]);
      return cleaned ? truncate(cleaned, 60) : 'Plant discussed';
    }
    return 'Plant discussed';
  }

  if (stage === 'symptoms') {
    const response = findUserResponseAbout(messages, [
      'symptom', 'seeing', 'notice', 'observing', 'what are you', 'describe',
      'color', 'spots', 'wilting', 'drooping', 'wrong with',
    ]);
    if (response) return truncate(response, 80);
    for (const msg of userMessages) {
      const lower = msg.toLowerCase();
      if (['yellow', 'brown', 'spot', 'wilt', 'droop', 'curl', 'dying', 'pale', 'hole', 'dry', 'crispy', 'soft', 'mushy', 'rot'].some(kw => lower.includes(kw))) {
        const cleaned = cleanUserResponse(msg);
        return cleaned ? truncate(cleaned, 80) : 'Symptoms discussed';
      }
    }
    return 'Symptoms discussed';
  }

  if (stage === 'environment') {
    const response = findUserResponseAbout(messages, [
      'sun', 'light', 'indoor', 'outdoor', 'where', 'soil', 'temperature',
      'location', 'placed', 'garden', 'pot', 'container', 'bed',
    ]);
    if (response) return truncate(response, 80);
    return 'Environment discussed';
  }

  if (stage === 'care_history') {
    const response = findUserResponseAbout(messages, [
      'water', 'fertiliz', 'care', 'routine', 'how long', 'how often',
      'feed', 'spray', 'prune', 'repot', 'recent',
    ]);
    if (response) return truncate(response, 80);
    return 'Care routine discussed';
  }

  if (stage === 'diagnosis') {
    for (const msg of aiMessages) {
      const lower = msg.toLowerCase();

      const clausePatterns = [
        /(?:it'?s\s+)?(?:likely|probably)\s+(.{3,40}?)(?:[.,;!]|\s+(?:so|and|which|because|I'd|you should))/i,
        /(?:i\s+suspect|i\s+think)\s+(?:it(?:'s| is| might be)\s+)?(.{3,40}?)(?:[.,;!]|\s+(?:so|and|which|because))/i,
        /(?:sounds like|appears to be|looks like)\s+(.{3,40}?)(?:[.,;!]|\s+(?:so|and|which|because))/i,
        /(?:caused by|due to)\s+(.{3,40}?)(?:[.,;!]|\s+(?:so|and|which))/i,
      ];

      for (const pattern of clausePatterns) {
        const match = msg.match(pattern);
        if (match) {
          const clause = match[1].trim().replace(/[.,;!]+$/, '');
          return clause.charAt(0).toUpperCase() + clause.slice(1);
        }
      }

      if (['likely', 'suspect', 'sounds like', 'appears to be', 'probably', 'recommend', 'cause'].some(kw => lower.includes(kw))) {
        const firstSentence = msg.split(/(?<=[.!?])\s+/)[0];
        return truncate(firstSentence.trim(), 60);
      }
    }
    return 'Assessment provided';
  }

  return 'Discussed';
}

/**
 * Detect what stage the walk is in by scanning AI messages for stage-specific questions.
 * Stages advance progressively -- once we pass a stage, we don't go back.
 */
export function detectStageFromMessages(messages: { role: string; content: string }[]): JourneyStage {
  if (messages.length === 0) return 'start';

  let stageIndex = 0;
  let userMessageCount = 0;

  for (const msg of messages) {
    const lower = msg.content.toLowerCase();

    if (msg.role === 'user') {
      userMessageCount++;
    }

    if (msg.role !== 'assistant') continue;

    // Check for completion/diagnosis
    if (
      lower.includes('happy gardening') ||
      lower.includes("it's likely") ||
      lower.includes('i suspect') ||
      lower.includes('i think it') ||
      lower.includes('sounds like') ||
      lower.includes('i\'d recommend') ||
      lower.includes('my recommendation') ||
      lower.includes('what to do today') ||
      lower.includes('do today') ||
      lower.includes('root rot') ||
      lower.includes('fungal') ||
      lower.includes('bacterial') ||
      lower.includes('deficien') ||
      lower.includes('overwater') ||
      lower.includes('underwater') ||
      (lower.includes('caused by') && lower.length > 50)
    ) {
      stageIndex = Math.max(stageIndex, 5);
    }
    // Check for care/watering questions
    else if (
      lower.includes('water') ||
      lower.includes('fertiliz') ||
      lower.includes('care') ||
      lower.includes('routine') ||
      lower.includes('how long have you had')
    ) {
      stageIndex = Math.max(stageIndex, 4);
    }
    // Check for environment questions
    else if (
      lower.includes('sun') ||
      lower.includes('light') ||
      lower.includes('indoor') ||
      lower.includes('outdoor') ||
      lower.includes('where') ||
      lower.includes('soil') ||
      lower.includes('temperature')
    ) {
      stageIndex = Math.max(stageIndex, 3);
    }
    // Check for symptom questions
    else if (
      lower.includes('symptom') ||
      lower.includes('yellow') ||
      lower.includes('brown') ||
      lower.includes('spot') ||
      lower.includes('wilt') ||
      lower.includes('droop') ||
      lower.includes('color') ||
      lower.includes('leaves') ||
      lower.includes('describe') ||
      lower.includes('seeing') ||
      lower.includes('notice')
    ) {
      stageIndex = Math.max(stageIndex, 2);
    }
    // Check for plant_id (walk started)
    else if (lower.includes('take a walk') || lower.includes('kind of plant')) {
      stageIndex = Math.max(stageIndex, 1);
    }
  }

  // Fallback: use message count to estimate stage if keywords didn't trigger
  if (userMessageCount >= 2 && stageIndex < 2) {
    stageIndex = 2;
  }
  if (userMessageCount >= 3 && stageIndex < 3) {
    stageIndex = 3;
  }
  if (userMessageCount >= 4 && stageIndex < 4) {
    stageIndex = 4;
  }

  return STAGE_ORDER[stageIndex];
}
