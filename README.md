# Gardening Whisperer

A voice-first AI gardening assistant PWA that helps gardeners diagnose plant issues hands-free using spoken conversation and photo analysis.

## Getting Started

### Prerequisites

- Node.js 20+
- Chrome browser (for Web Speech API support)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Add your API keys to `.env.local`:
   - **Gemini API**: Get from https://ai.google.dev/
   - **ElevenLabs API**: Get from https://elevenlabs.io/

### Running the App

> **Important:** Always use `npm run dev:full`, never `npm run dev`.
> The app requires a custom Node server (`server.js`) that handles WebSocket
> connections for Gemini Live audio. Plain `npm run dev` starts Next.js only
> (port 3000) with no WebSocket support — the app will not work.

```bash
npm run dev:full
```

This will:
1. Generate a self-signed HTTPS certificate (first run only)
2. Start the HTTPS server on port 3003 with WebSocket support
3. Print your local and Wi-Fi URLs

> **Why HTTPS?** Browser APIs like microphone (`getUserMedia`) and `AudioContext`
> require a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
> On `localhost` this works automatically, but accessing via a LAN IP (e.g. from
> your phone) requires HTTPS — even with a self-signed certificate.

### Phone Testing (same Wi-Fi)

1. Run `npm run dev:full` — note the `https://<local-ip>:3003` URL in the output
2. Open that URL in Chrome on your phone
3. Accept the self-signed certificate warning ("Your connection is not private" → Advanced → Proceed)
4. Allow microphone access when prompted

**Optional:** If [zrok](https://zrok.io) is installed, a public tunnel URL is also provided for remote testing.

### Other Commands

```bash
npm run dev:stop      # Stop all dev services
npm test              # Run tests
npm test -- --watch   # Watch mode
npm run typecheck     # Type-check without emitting
npm run lint          # Lint
npm run build         # Production build
npm start             # Start production server
```

## Features

- **Voice-first garden walks** — hands-free spoken conversation with AI about your plants
- **Photo diagnosis** — capture or upload plant photos for visual analysis mid-conversation
- **Garden walk summary** — coverage tracking, care recommendations, and shareable summary
- **Google Calendar reminders** — schedule follow-up checks directly from the summary
- **PWA installable** — works as a standalone app on mobile (service worker + offline fallback)
- **Ambient soundscape** — bird sounds fade in during walks, duck during AI speech

## Architecture

```
VoiceLoop.tsx          → Main UI component (idle/connecting/active/summary states)
hooks/useGeminiLive.ts → WebSocket voice conversation (mic → server → Gemini Live → audio)
server.js              → HTTPS + WebSocket server (origin validation, rate limiting)
server/gemini-live-proxy.js → Gemini Live API bridge
lib/                   → Extracted business logic (plant extraction, stage detection, etc.)
```

Active data flow: **VoiceLoop → useGeminiLive → WebSocket → server.js → Gemini Live API**

## Tech Stack

- **Next.js 15** with TypeScript, **React 19**, **Tailwind CSS**
- **Gemini 3 Pro** for multimodal AI (text + images + live audio via WebSocket)
- **Custom Node server** with WebSocket for Gemini Live streaming
- **Self-signed HTTPS** for local development (required for mic/audio APIs)
- **PWA** with service worker, maskable icons, and offline fallback

## Audio Optimization

The ambient bird sounds use a trimmed 30-second loop (586 KB) instead of the full 18-minute file (22 MB). To regenerate:

```bash
# Requires ffmpeg (brew install ffmpeg)
node scripts/trim-audio.js
```

## License

MIT
