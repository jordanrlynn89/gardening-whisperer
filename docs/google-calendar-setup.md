# Google Calendar Integration Setup

## Overview

The Google Calendar integration lets users add follow-up plant care reminders directly to their Google Calendar from the garden walk summary screen. It uses client-side OAuth 2.0 via Google Identity Services (GIS) — no backend database or server-side tokens needed.

## Architecture

```
Summary Screen → "Calendar" button → GIS OAuth popup → Access Token
                                                            ↓
                                    Google Calendar API ← POST event
                                                            ↓
                                                   Token cached in localStorage
```

## Files

- `/types/google-gis.d.ts` - TypeScript declarations for GIS
- `/hooks/useGoogleCalendar.ts` - OAuth hook (sign in, sign out, token persistence)
- `/lib/googleCalendar.ts` - Calendar event formatting and API calls
- `/app/layout.tsx` - Loads the GIS script (`lazyOnload`)
- `/components/VoiceLoop.tsx` - "Add to Calendar" button in summary view

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top and select **New Project**
3. Name it something like `gardening-whisperer` and click **Create**
4. Wait for the project to be created, then select it from the dropdown

### 2. Enable the Google Calendar API

1. In the sidebar, go to **APIs & Services > Library**
2. Search for **Google Calendar API**
3. Click on it and press **Enable**

### 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** as the user type, then click **Create**
3. Fill in the required fields:
   - **App name**: `Gardening Whisperer`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue**
5. On the **Scopes** step, click **Add or Remove Scopes**
   - Search for `Google Calendar API` and check `.../auth/calendar.events`
   - Click **Update**, then **Save and Continue**
6. On the **Test users** step, click **Add Users**
   - Add your own Google account email (the one you'll use to test)
   - Click **Save and Continue**
7. Review and click **Back to Dashboard**

> **Important**: Keep the app in **Testing** mode. This is fine for development and demo purposes. Publishing requires Google's review process. In Testing mode, only the test users you added can authorize the app.

### 4. Create OAuth 2.0 Client Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application** as the application type
4. Name it `Gardening Whisperer Dev`
5. Under **Authorized JavaScript origins**, add all origins you'll use:
   - `https://localhost:3003` (local dev)
   - `https://<your-local-ip>:3003` (phone testing on Wi-Fi, e.g. `https://192.168.4.170:3003`)
   - Your zrok tunnel URL if applicable (e.g. `https://abc123.share.zrok.io`)
6. Leave **Authorized redirect URIs** empty (GIS token flow doesn't use redirects)
7. Click **Create**
8. Copy the **Client ID** — it looks like `123456789-abcdef.apps.googleusercontent.com`

### 5. Configure the Environment Variable

Add the Client ID to your local environment:

```bash
# In .env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

Then restart the dev server:

```bash
npm run dev:stop && npm run dev:full
```

## How It Works

1. User completes a garden walk and sees the summary screen
2. The **Calendar** button appears at the bottom
3. First tap opens a Google OAuth popup — user authorizes calendar access
4. The token is stored in `localStorage` with its expiry time
5. Button changes to **Add to Cal** — tapping it creates an all-day reminder event 3 days out
6. On subsequent visits, the stored token is restored automatically (if not expired)

## Troubleshooting

### OAuth popup doesn't appear
- Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set in `.env.local` and the server was restarted
- Check that the GIS script loaded: in browser devtools, look for a request to `accounts.google.com/gsi/client`
- Ensure pop-ups aren't blocked for `localhost:3003`

### "Access blocked: This app's request is invalid"
- The JavaScript origin in Google Cloud Console must **exactly** match the URL in your browser (protocol, host, port)
- For localhost: add `https://localhost:3003` (not `http://`, not without port)
- For phone testing: add `https://<your-ip>:3003`

### "Google hasn't verified this app" warning
- This is expected in Testing mode — click **Continue** to proceed
- Only test users added to the consent screen can authorize

### Token expired / "Calendar" button reappears
- Tokens last ~1 hour. After expiry, the user simply taps **Calendar** again to re-authorize
- The hook automatically cleans up expired tokens on page load

### "Failed to create calendar event"
- Check that the Google Calendar API is enabled in the Cloud Console
- Verify the token hasn't expired (the hook checks this on mount but not mid-session)
- Open browser devtools Network tab and look for the failed `POST` to `googleapis.com` for details

## Cost

This integration is entirely free:
- Google Cloud free tier includes 1,000,000 Calendar API calls/day
- OAuth consent screen in Testing mode has no cost
- No server-side infrastructure needed
