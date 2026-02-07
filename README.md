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

The app requires a custom server for WebSocket connections (Gemini Live audio). Always use:

```bash
npm run dev:full
```

This starts the HTTPS server on port 3003 with WebSocket support. Do **not** use `npm run dev` — that starts Next.js only without the WebSocket server.

**Phone testing (same Wi-Fi):** Open the `https://<local-ip>:3003` URL shown in the terminal. Accept the self-signed certificate warning.

**Note:** If zrok is installed, a public tunnel URL is also provided for remote testing. It's optional.

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

## Tech Stack

- **Next.js 15** with TypeScript
- **React 19**
- **Tailwind CSS**
- **Web Speech API** for speech-to-text (Chrome-only)
- **Gemini 2.0 Flash** for multimodal AI reasoning (text + images + live audio)
- **Custom Node server** with WebSocket for Gemini Live streaming
- **Self-signed HTTPS** for local development (required for mic/audio APIs)

## License

MIT
