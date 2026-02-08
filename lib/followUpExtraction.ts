const WORD_TO_NUM: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCount(raw: string): number {
  const lower = raw.toLowerCase().trim();
  if (WORD_TO_NUM[lower] !== undefined) return WORD_TO_NUM[lower];
  const n = parseInt(lower, 10);
  return isNaN(n) ? 1 : n;
}

const COUNT = '(a|one|two|three|four|five|six|seven|eight|nine|ten|\\d+)';

// Matches: "check in X days/weeks", "check again in", "follow up in", "monitor for the next"
// Optionally captures purpose clause: "to <see if|make sure|check if> ..."
const FOLLOW_UP_RE = new RegExp(
  `(?:check\\s+(?:in|again\\s+in)|follow\\s+up\\s+in|monitor\\s+for\\s+the\\s+next)\\s+${COUNT}\\s+(day|week)s?` +
    `(?:[^.]*?to\\s+((?:see\\s+if|make\\s+sure|check\\s+if)\\s+[^.]+?))?(?:\\.|$)`,
  'gi',
);

export function extractFollowUp(
  messages: { role: string; content: string }[],
): { action: string; days: number } | null {
  let result: { action: string; days: number } | null = null;

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    FOLLOW_UP_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FOLLOW_UP_RE.exec(msg.content)) !== null) {
      const countStr = match[1];
      const unit = match[2].toLowerCase();
      const purposeClause = match[3]?.trim().toLowerCase();

      let days = parseCount(countStr);
      if (unit === 'week') days *= 7;

      const action = purposeClause ?? 'check on your plant';
      result = { action, days };
    }
  }

  return result;
}
