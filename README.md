# 🌱 Gardening Whisperer

A voice-first AI gardening assistant PWA that helps gardeners diagnose plant issues hands-free using spoken conversation and photo analysis.

## Getting Started

### Prerequisites

- Node.js 25+ (installed)
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

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or :3001 if 3000 is in use) in Chrome.

### Building for Production

```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 15** with TypeScript
- **React 19**
- **Tailwind CSS** with custom earthy color palette
- **Web Speech API** for speech-to-text (Chrome-only)
- **Gemini 3 Pro** for multimodal AI reasoning
- **ElevenLabs** for high-quality text-to-speech

## Project Structure

```
├── app/                # Next.js app directory
│   ├── layout.tsx      # Root layout with PWA metadata
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles with Tailwind
├── CLAUDE.md           # Development guidelines
├── gardening-whisperer-plan.md  # Full project plan
└── .env.example        # Environment variables template
```

## Development Roadmap

### Week 1: Core Voice Loop ✓
- [x] Next.js project setup
- [ ] Web Speech API integration (STT)
- [ ] Gemini API integration
- [ ] ElevenLabs integration (TTS)
- [ ] Basic voice loop: speak → AI responds → speak again

### Week 2: Garden Walk Structure
- [ ] Semi-structured question flow
- [ ] Coverage tracking logic
- [ ] Two-layer prompt architecture
- [ ] Turn-taking with "anything else?" pattern

### Week 3: Photos & Polish
- [ ] Camera integration
- [ ] Image analysis via Gemini
- [ ] Visual design implementation
- [ ] Mobile optimization

### Week 4: Demo Preparation
- [ ] Session summary & share feature
- [ ] Bug fixes
- [ ] Record demo video

## License

MIT
