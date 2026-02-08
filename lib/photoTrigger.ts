/**
 * Check if text contains photo-related triggers.
 * The Live API generates speech natively -- its transcription wording varies,
 * so we match broadly on key words rather than exact phrases.
 */
export function hasPhotoTrigger(text: string, source: 'ai' | 'user'): boolean {
  const lower = text.toLowerCase();
  if (source === 'ai') {
    // AI explicitly asking the USER to take/send/show a photo.
    // Must match a direct request — NOT Gemini discussing a photo already received
    // (e.g. "I can see from the photo..." must NOT trigger this).
    const hasPhotoWord = lower.includes('photo') || lower.includes('picture') || lower.includes('image');
    const hasExplicitRequest =
      lower.includes('show me') ||
      lower.includes('can you show') ||
      lower.includes('could you show') ||
      lower.includes('can you take') ||
      lower.includes('could you take') ||
      lower.includes('take a photo') ||
      lower.includes('take a picture') ||
      lower.includes('send me') ||
      lower.includes('would you like to show') ||
      lower.includes('would you like to take') ||
      lower.includes('a picture would') ||
      lower.includes('a photo would') ||
      lower.includes('if you can show') ||
      lower.includes('if you could show') ||
      lower.includes('love to see') ||
      lower.includes('love to look');
    return hasPhotoWord && hasExplicitRequest;
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
