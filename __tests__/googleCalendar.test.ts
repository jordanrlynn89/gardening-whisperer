import { formatCalendarEvent, createCalendarEvent, CalendarEventData } from '@/lib/googleCalendar';

// Freeze "today" so date math is deterministic
const FAKE_NOW = new Date('2025-06-15T12:00:00Z');

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FAKE_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

// ── formatCalendarEvent ─────────────────────────────────────────────

describe('formatCalendarEvent', () => {
  const baseSummary = {
    plantName: 'Tomato',
    diagnosisGiven: 'Likely nitrogen deficiency',
  };

  const baseActions = {
    doToday: ['Add nitrogen-rich fertilizer', 'Water deeply'],
    checkInDays: 5,
    ifWorsens: ['Check for root damage', 'Consider soil test'],
  };

  it('puts the plant name in the event title', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    expect(event.summary).toContain('Tomato');
  });

  it('sets the start date to today + checkInDays', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    // 2025-06-15 + 5 days = 2025-06-20
    expect(event.start.date).toBe('2025-06-20');
  });

  it('sets end date to one day after start (all-day event)', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    expect(event.end.date).toBe('2025-06-21');
  });

  it('defaults to 3 days when checkInDays is undefined', () => {
    const event = formatCalendarEvent(baseSummary, { ...baseActions, checkInDays: undefined });
    // 2025-06-15 + 3 = 2025-06-18
    expect(event.start.date).toBe('2025-06-18');
    expect(event.end.date).toBe('2025-06-19');
  });

  it('includes diagnosis in the description', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    expect(event.description).toContain('Likely nitrogen deficiency');
  });

  it('includes doToday actions in the description', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    expect(event.description).toContain('Add nitrogen-rich fertilizer');
    expect(event.description).toContain('Water deeply');
  });

  it('includes ifWorsens actions in the description', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    expect(event.description).toContain('Check for root damage');
    expect(event.description).toContain('Consider soil test');
  });

  it('creates all-day events (date, not dateTime)', () => {
    const event = formatCalendarEvent(baseSummary, baseActions);
    expect(event.start).toHaveProperty('date');
    expect(event.start).not.toHaveProperty('dateTime');
    expect(event.end).toHaveProperty('date');
    expect(event.end).not.toHaveProperty('dateTime');
  });

  it('handles empty action arrays gracefully', () => {
    const event = formatCalendarEvent(baseSummary, {
      doToday: [],
      checkInDays: 2,
      ifWorsens: [],
    });
    expect(event.description).toContain('Likely nitrogen deficiency');
    // Should still have a valid structure
    expect(event.start.date).toBe('2025-06-17');
  });
});

// ── createCalendarEvent ─────────────────────────────────────────────

describe('createCalendarEvent', () => {
  const fakeToken = 'ya29.fake-access-token';
  const fakeEvent: CalendarEventData = {
    summary: 'Check on Tomato',
    description: 'Diagnosis: Likely nitrogen deficiency',
    start: { date: '2025-06-20' },
    end: { date: '2025-06-21' },
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends POST to the correct Google Calendar API URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'event123', htmlLink: 'https://calendar.google.com/event/123' }),
    });

    await createCalendarEvent(fakeToken, fakeEvent);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('sends the access token in the Authorization header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'event123' }),
    });

    await createCalendarEvent(fakeToken, fakeEvent);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBe(`Bearer ${fakeToken}`);
  });

  it('sends the event data as JSON body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'event123' }),
    });

    await createCalendarEvent(fakeToken, fakeEvent);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.summary).toBe(fakeEvent.summary);
    expect(body.start.date).toBe(fakeEvent.start.date);
  });

  it('returns the created event data on success', async () => {
    const responseData = { id: 'event123', htmlLink: 'https://calendar.google.com/event/123' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => responseData,
    });

    const result = await createCalendarEvent(fakeToken, fakeEvent);
    expect(result).toEqual(responseData);
  });

  it('throws on non-OK API response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid credentials' } }),
      json: async () => ({ error: { message: 'Invalid credentials' } }),
    });

    await expect(createCalendarEvent(fakeToken, fakeEvent)).rejects.toThrow('Invalid credentials');
  });

  it('throws on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(createCalendarEvent(fakeToken, fakeEvent)).rejects.toThrow('Network error');
  });
});
