/**
 * Detects verbal confirmations in user transcripts
 */
export function isVerbalConfirmation(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();

  // Simple affirmations - check if they appear at the start of the sentence
  const simpleAffirmations = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'alright', 'yup'];
  const startsWithAffirmation = simpleAffirmations.some(word =>
    normalized === word ||
    normalized === `${word}.` ||
    normalized === `${word}!` ||
    normalized.startsWith(`${word} `) ||
    normalized.startsWith(`${word},`)
  );

  if (startsWithAffirmation) {
    return true;
  }

  // Photo-specific confirmations
  const photoPatterns = [
    'let me show you',
    'let me take',
    "i'll take",
    'take a picture',
    'take a photo',
    'show you the',
  ];

  return photoPatterns.some(pattern => normalized.includes(pattern));
}

/**
 * Detects verbal rejections in user transcripts
 */
export function isVerbalRejection(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();

  // Simple rejections
  const simpleRejections = ['no', 'nope', 'nah'];
  if (simpleRejections.some(word => normalized === word || normalized === `${word}.` || normalized === `${word}!`)) {
    return true;
  }

  // Deferred responses
  const deferralPatterns = [
    'not now',
    'maybe later',
    'skip that',
    'skip this',
    "let's skip",
  ];

  return deferralPatterns.some(pattern => normalized.includes(pattern));
}
