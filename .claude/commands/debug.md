Debug the issue described: $ARGUMENTS

Follow this systematic approach:

1. **Reproduce**: Identify the failing behavior from the description
2. **Locate**: Search the codebase for relevant code (use Grep/Glob, read files)
3. **Hypothesize**: Form 2-3 hypotheses about the root cause
4. **Test hypotheses**: Read code paths, check logs, run targeted tests
5. **Fix**: Implement the minimal fix
6. **Verify**: Run `npm test` and `npm run typecheck` to confirm the fix

Common areas to check:
- WebSocket connection state (`server.ts`, `useGeminiLive.ts`)
- Gemini response parsing (JSON structure mismatches)
- TTS audio playback (ElevenLabs API errors, audio context state)
- Speech recognition lifecycle (start/stop/abort timing)
- State management (React state updates, race conditions)
