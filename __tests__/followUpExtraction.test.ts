import { extractFollowUp } from '@/lib/followUpExtraction';

describe('extractFollowUp', () => {
  function msgs(texts: string[]) {
    return texts.map((content) => ({ role: 'assistant', content }));
  }

  it('returns null when no follow-up pattern found', () => {
    expect(extractFollowUp(msgs(['Your tomato looks great!']))).toBeNull();
  });

  it('returns null for empty messages', () => {
    expect(extractFollowUp([])).toBeNull();
  });

  it('extracts numeric days', () => {
    const result = extractFollowUp(msgs(['Check in 5 days to see if the yellowing improves.']));
    expect(result).toEqual({ action: 'see if the yellowing improves', days: 5 });
  });

  it('extracts "a week" as 7 days', () => {
    const result = extractFollowUp(msgs(['Check in a week to see if the spots clear up.']));
    expect(result).toEqual({ action: 'see if the spots clear up', days: 7 });
  });

  it('extracts "one week" as 7 days', () => {
    const result = extractFollowUp(msgs(['Check in one week to see if growth resumes.']));
    expect(result).toEqual({ action: 'see if growth resumes', days: 7 });
  });

  it('extracts "two weeks" as 14 days', () => {
    const result = extractFollowUp(msgs(['Check in two weeks to make sure the wilting stops.']));
    expect(result).toEqual({ action: 'make sure the wilting stops', days: 14 });
  });

  it('extracts "X weeks" as X * 7 days', () => {
    const result = extractFollowUp(msgs(['Check in 3 weeks to see if new growth appears.']));
    expect(result).toEqual({ action: 'see if new growth appears', days: 21 });
  });

  it('handles "follow up in" pattern', () => {
    const result = extractFollowUp(msgs(['Follow up in 10 days to check if the soil drains properly.']));
    expect(result).toEqual({ action: 'check if the soil drains properly', days: 10 });
  });

  it('handles "check again in" pattern', () => {
    const result = extractFollowUp(msgs(['Check again in 7 days to see if the leaves perk up.']));
    expect(result).toEqual({ action: 'see if the leaves perk up', days: 7 });
  });

  it('handles "monitor for the next" pattern', () => {
    const result = extractFollowUp(msgs(['Monitor for the next 3 days to see if the color returns.']));
    expect(result).toEqual({ action: 'see if the color returns', days: 3 });
  });

  it('uses "check on your plant" as fallback action when no purpose clause', () => {
    const result = extractFollowUp(msgs(['Check in 5 days.']));
    expect(result).toEqual({ action: 'check on your plant', days: 5 });
  });

  it('last match wins when multiple follow-ups in conversation', () => {
    const result = extractFollowUp(
      msgs([
        'Check in 3 days to see if it improves.',
        'Actually, check in 2 weeks to see if the roots recover.',
      ]),
    );
    expect(result).toEqual({ action: 'see if the roots recover', days: 14 });
  });

  it('ignores user messages, only scans assistant messages', () => {
    const messages = [
      { role: 'user', content: 'Check in 100 days to see if I was right.' },
      { role: 'assistant', content: 'Check in 4 days to see if the color improves.' },
    ];
    expect(extractFollowUp(messages)).toEqual({ action: 'see if the color improves', days: 4 });
  });

  it('is case-insensitive', () => {
    const result = extractFollowUp(msgs(['CHECK IN 2 DAYS TO SEE IF THE STEM HARDENS.']));
    expect(result).toEqual({ action: 'see if the stem hardens', days: 2 });
  });

  it('handles "to check if" as purpose clause prefix', () => {
    const result = extractFollowUp(msgs(['Check in 6 days to check if the mold is gone.']));
    expect(result).toEqual({ action: 'check if the mold is gone', days: 6 });
  });
});
