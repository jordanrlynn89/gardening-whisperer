'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const TOKEN_KEY = 'gw_gcal_token';
const EXPIRY_KEY = 'gw_gcal_expiry';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function getGIS(): typeof google.accounts.oauth2 | null {
  if (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).google &&
    (google as unknown as Record<string, unknown>).accounts
  ) {
    return google.accounts.oauth2;
  }
  return null;
}

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGISReady, setIsGISReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);

  // Check if token is valid (exists and not expired)
  const isConnected = accessToken !== null;

  // Restore token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (stored && expiry && Date.now() < Number(expiry)) {
      setAccessToken(stored);
    } else if (stored) {
      // Expired — clean up
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EXPIRY_KEY);
    }
  }, []);

  // Poll for GIS library readiness
  useEffect(() => {
    if (getGIS()) {
      setIsGISReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (getGIS()) {
        setIsGISReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Initialize token client when GIS is ready
  useEffect(() => {
    if (!isGISReady) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[Calendar] NEXT_PUBLIC_GOOGLE_CLIENT_ID not set');
      setError('Calendar not configured - missing client ID');
      return;
    }

    const gis = getGIS();
    if (!gis) {
      console.error('[Calendar] Google Identity Services not available');
      setError('Google Sign-In library failed to load');
      return;
    }

    try {
      tokenClientRef.current = gis.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            console.error('[Calendar] OAuth error:', response.error);
            setError(`Sign-in failed: ${response.error}`);
            return;
          }
          console.log('[Calendar] Successfully signed in');
          const token = response.access_token;
          const expiry = Date.now() + response.expires_in * 1000;
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(EXPIRY_KEY, String(expiry));
          setAccessToken(token);
          setError(null);
        },
      });
      console.log('[Calendar] Token client initialized');
    } catch (err) {
      console.error('[Calendar] Failed to initialize token client:', err);
      setError('Failed to initialize Google Sign-In');
    }
  }, [isGISReady]);

  const signIn = useCallback(() => {
    tokenClientRef.current?.requestAccessToken({ prompt: '' });
  }, []);

  const signOut = useCallback(() => {
    if (accessToken) {
      const gis = getGIS();
      gis?.revoke(accessToken, () => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    setAccessToken(null);
  }, [accessToken]);

  return { isConnected, accessToken, isGISReady, signIn, signOut, error };
}
