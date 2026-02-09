export interface CalendarEventData {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
}

interface SummaryInput {
  plantName: string;
  diagnosisGiven: string;
}

interface ActionsInput {
  doToday: string[];
  checkInDays?: number;
  ifWorsens: string[];
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatCalendarEvent(
  summary: SummaryInput,
  actions: ActionsInput,
): CalendarEventData {
  const days = actions.checkInDays ?? 3;

  const start = new Date();
  start.setDate(start.getDate() + days);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const descParts: string[] = [];
  descParts.push(`Diagnosis: ${summary.diagnosisGiven}`);

  if (actions.doToday.length > 0) {
    descParts.push('');
    descParts.push('Action items:');
    actions.doToday.forEach((a) => descParts.push(`- ${a}`));
  }

  if (actions.ifWorsens.length > 0) {
    descParts.push('');
    descParts.push('If it worsens:');
    actions.ifWorsens.forEach((a) => descParts.push(`- ${a}`));
  }

  descParts.push('');
  descParts.push('Created by Gardening Whisperer');

  return {
    summary: `Check on ${summary.plantName}`,
    description: descParts.join('\n'),
    start: { date: formatDate(start) },
    end: { date: formatDate(end) },
  };
}

export async function createCalendarEvent(
  accessToken: string,
  eventData: CalendarEventData,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[Calendar API] Error response:', res.status, errorBody);
    let errorMessage = `Failed to create calendar event (${res.status})`;
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // errorBody is not JSON
    }
    throw new Error(errorMessage);
  }

  return res.json();
}
