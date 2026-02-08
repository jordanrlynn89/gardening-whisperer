/**
 * Check if text contains photo-related triggers.
 * The Live API generates speech natively -- its transcription wording varies,
 * so we match broadly on key words rather than exact phrases.
 */
export function hasPhotoTrigger(text: string, source: 'ai' | 'user'): boolean {
  const lower = text.toLowerCase();
  if (source === 'ai') {
    // AI suggesting user send a photo: match any mention of photo/picture
    // combined with action verbs the AI would use
    const hasPhotoWord = lower.includes('photo') || lower.includes('picture') || lower.includes('image');
    const hasSuggestVerb =
      lower.includes('show') ||
      lower.includes('send') ||
      lower.includes('take') ||
      lower.includes('see') ||
      lower.includes('like to') ||
      lower.includes('want to') ||
      lower.includes('help me') ||
      lower.includes('would') ||
      lower.includes('can you') ||
      lower.includes('could you');
    return hasPhotoWord && hasSuggestVerb;
  }
  // User offering to send a photo
  const hasPhotoWord = lower.includes('photo') || lower.includes('picture') || lower.includes('image');
  const hasActionWord =
    lower.includes('show') ||
    lower.includes('take') ||
    lower.includes('send') ||
    lower.includes('upload') ||
    lower.includes('let me');
  return hasPhotoWord && hasActionWord;
}
