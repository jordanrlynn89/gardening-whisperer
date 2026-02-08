import { renderHook, act } from '@testing-library/react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

// ── Mock localStorage ───────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn((key: string) => { delete store[key]; }),
  clear: jest.fn(() => { for (const k in store) delete store[k]; }),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── Mock GIS ────────────────────────────────────────────────────────

const mockRequestAccessToken = jest.fn();
const mockRevoke = jest.fn((_token: string, cb?: () => void) => cb?.());
const mockInitTokenClient = jest.fn(() => ({
  requestAccessToken: mockRequestAccessToken,
}));

// Simulate the GIS library being loaded
function loadGIS() {
  (window as unknown as Record<string, unknown>).google = {
    accounts: {
      oauth2: {
        initTokenClient: mockInitTokenClient,
        revoke: mockRevoke,
      },
    },
  };
}

function unloadGIS() {
  delete (window as unknown as Record<string, unknown>).google;
}

// ── Setup / Teardown ────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  localStorageMock.clear();
  jest.clearAllMocks();
  unloadGIS();
  // Set a fake client ID env var
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('useGoogleCalendar', () => {
  it('starts in disconnected state', () => {
    loadGIS();
    const { result } = renderHook(() => useGoogleCalendar());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.accessToken).toBeNull();
  });

  it('restores a valid (non-expired) token from localStorage on mount', () => {
    // Store a token that expires 1 hour from now
    const expiry = Date.now() + 3600 * 1000;
    store['gw_gcal_token'] = 'ya29.stored-token';
    store['gw_gcal_expiry'] = String(expiry);

    loadGIS();
    const { result } = renderHook(() => useGoogleCalendar());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.accessToken).toBe('ya29.stored-token');
  });

  it('rejects an expired token from localStorage', () => {
    // Store a token that expired 1 hour ago
    const expiry = Date.now() - 3600 * 1000;
    store['gw_gcal_token'] = 'ya29.expired-token';
    store['gw_gcal_expiry'] = String(expiry);

    loadGIS();
    const { result } = renderHook(() => useGoogleCalendar());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.accessToken).toBeNull();
  });

  it('signOut revokes the token and clears localStorage', async () => {
    const expiry = Date.now() + 3600 * 1000;
    store['gw_gcal_token'] = 'ya29.to-revoke';
    store['gw_gcal_expiry'] = String(expiry);

    loadGIS();
    const { result } = renderHook(() => useGoogleCalendar());

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.signOut();
    });

    expect(mockRevoke).toHaveBeenCalledWith('ya29.to-revoke', expect.any(Function));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.accessToken).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('gw_gcal_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('gw_gcal_expiry');
  });

  it('polls for GIS library readiness', () => {
    // Don't load GIS yet
    const { result } = renderHook(() => useGoogleCalendar());
    expect(result.current.isGISReady).toBe(false);

    // Simulate GIS loading after a delay
    loadGIS();
    act(() => {
      jest.advanceTimersByTime(600); // polling interval is 500ms
    });

    expect(result.current.isGISReady).toBe(true);
  });
});
