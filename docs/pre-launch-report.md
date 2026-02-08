# Pre-Launch Readiness Report

**Project:** Gardening Whisperer
**Date:** 2026-02-08
**Branch:** `develop` (4f9dd47)
**Reviewed by:** 6 specialist agents (@architect, @qa-lead, @security-reviewer, @performance-eng, @ux-reviewer, @devops)

---

## Executive Summary

| Check | Status |
|-------|--------|
| `npm test` | 13 suites, 194 tests pass |
| `npx tsc --noEmit` | Clean |
| `npm run lint` | Clean |
| `npm run build` | Clean (130 kB first load JS) |

**Build is technically green**, but the test suite inflates confidence: ~80-100 of 194 tests are placeholder assertions that never exercise real code. The core voice/WebSocket hook (`useGeminiLive.ts`) has only 15% branch coverage. A 22 MB ambient sound file will crush mobile load times.

| Severity | Count |
|----------|-------|
| **BLOCKER** | 9 |
| **WARNING** | 37 |
| **INFO** | ~20 |

---

## BLOCKERS (9)

### B-1. VoiceLoop.tsx is a 1300+ line god component
**Reviewer:** @architect
**File:** `components/VoiceLoop.tsx`

Mixes business logic (plant extraction, stage detection, care recommendations), state management (15+ useState calls), and the entire UI for idle/connecting/active/summary/error states. Functions like `extractPlantName` (~100 lines), `detectStageFromMessages` (~100 lines), `getCareRecommendations` (~50 lines) are pure utilities inlined in the component with zero test coverage.

**Fix:** Extract business logic into `lib/plantExtraction.ts`, `lib/stageDetection.ts`, `lib/summaryGeneration.ts`. Extract summary UI into `components/SummaryView.tsx`.

### B-2. Massive dead code: 8+ hooks, 3 API routes, 1 lib, 1 types file unused
**Reviewer:** @architect
**Files:** `hooks/useChat.ts`, `hooks/useTTS.ts`, `hooks/useTTSNative.ts`, `hooks/usePlatformSpeech.ts`, `hooks/useSpeechRecognition.ts`, `hooks/useDeepgramSpeech.ts`, `hooks/useMediaRecorderSpeech.ts`, `hooks/useCapacitorSpeech.ts`, `app/api/chat/route.ts`, `app/api/tts-google/route.ts`, `app/api/transcribe/route.ts`, `lib/gemini.ts`, `types/chat.ts`

Two parallel AI integration paths (REST + WebSocket) coexist. The REST path is never called. Active flow: VoiceLoop -> useGeminiLive -> WebSocket -> server.js -> gemini-live-proxy.js -> Gemini Live API.

**Fix:** Delete all dead code files.

### B-3. Two Google AI SDKs installed
**Reviewer:** @architect
**File:** `package.json`

`@google/generative-ai` (^0.24.1) serves only dead code. `@google/genai` (^1.39.0) is the active SDK.

**Fix:** Remove `@google/generative-ai`. Migrate `scripts/list-models.js` and `scripts/list-available-models.js` to `@google/genai`.

### B-4. `useGeminiLive.ts` has only 15% branch coverage
**Reviewer:** @qa-lead
**File:** `hooks/useGeminiLive.ts`

295 lines, 101 covered (34% lines, 15% branches). This hook manages the entire WebSocket voice conversation, audio I/O, and is the backbone of the garden walk demo. An untested regression would break the primary demo scenario.

**Fix:** Write comprehensive tests covering connection lifecycle, message parsing, audio playback states, error handling, and reconnection.

### B-5. ~80-100 placeholder tests inflate test count
**Reviewer:** @qa-lead
**Files:** `__tests__/voice-interaction.test.ts`, `__tests__/voice-walk-integration.test.ts`, `__tests__/gemini-api.test.ts`, `__tests__/camera-flow.test.ts`

Tests assert against local variables and never exercise real code (e.g., `expect(true).toBe(true)`, `expect(silenceTimeout).toBeGreaterThan(0)`). Zero behavioral coverage from these files.

**Fix:** Replace with real tests that import and exercise actual modules.

### B-6. No `aria-live` regions for voice state changes
**Reviewer:** @ux-reviewer
**File:** `components/VoiceLoop.tsx` (lines 891-910)

The listening/speaking status indicator changes dynamically but is not wrapped in `aria-live`. Screen readers cannot announce state transitions.

**Fix:** Add `aria-live="polite"` to the status container.

### B-7. No `aria-live` or `role="alert"` for error messages
**Reviewer:** @ux-reviewer
**File:** `components/VoiceLoop.tsx` (lines 1331-1344)

Error messages render without `role="alert"` or `aria-live="assertive"`.

**Fix:** Add `role="alert"` to the error message container.

### B-8. `alert()` used in PhotoLibrary
**Reviewer:** @ux-reviewer
**File:** `components/PhotoLibrary.tsx` (lines 26, 40)

Native `alert()` breaks the immersive PWA experience, blocks the JS thread.

**Fix:** Replace with inline error UI or callback-based error handling.

### B-9. `birds.mp3` is 22 MB, loaded eagerly on mount
**Reviewer:** @performance-eng
**File:** `public/sounds/birds.mp3`

22 MB MP3 loaded via `new Audio('/sounds/birds.mp3')` on component mount. Crushes mobile load times on cellular.

**Fix:** Lazy-load audio only when `startAmbient()` is called. Compress to a shorter loop (~30-60 seconds, ~250-500 KB).

---

## WARNINGS (37)

### Architecture (9)

| # | Finding | File(s) |
|---|---------|---------|
| W-A1 | No React Context or state reducer; 15+ useState calls with no formal state machine | `VoiceLoop.tsx` |
| W-A2 | Capacitor dependencies (3 packages + `ios/` dir) are dead code in Chrome-only PWA | `package.json` |
| W-A3 | Deepgram SDK installed but only used by dead code | `package.json` |
| W-A4 | `eruda` debug tool in production dependencies | `package.json` |
| W-A5 | Inline `<style>` tags in components instead of Tailwind/CSS modules | `VoiceLoop.tsx`, `CameraCapture.tsx`, `PhotoChooser.tsx` |
| W-A6 | System prompt duplicated in `lib/gemini.ts` and `server/gemini-live-proxy.js` | Both files |
| W-A7 | 5 test HTML files + CAMERA_FLOW_TEST.md pollute project root | Root directory |
| W-A8 | Documentation under `docs/` references dead code patterns | `docs/` |
| W-A9 | Business logic functions in VoiceLoop have zero test coverage (not exported) | `VoiceLoop.tsx` |

### QA (4)

| # | Finding | File(s) |
|---|---------|---------|
| W-Q1 | No tests for `/api/analyze-photo` route (only active API route) | `app/api/analyze-photo/route.ts` |
| W-Q2 | No tests for `VoiceLoop` component | `components/VoiceLoop.tsx` |
| W-Q3 | `useAmbientSound` has low branch coverage (43%) | `hooks/useAmbientSound.ts` |
| W-Q4 | No tests for dead hooks (useChat, useTTS, etc.) | Multiple hooks |

### Security (9)

| # | Finding | File(s) |
|---|---------|---------|
| W-S1 | No size limit on `/api/chat` request body | `app/api/chat/route.ts` |
| W-S2 | No size limit on `/api/tts-google` text field | `app/api/tts-google/route.ts` |
| W-S3 | No WebSocket origin validation -- any website can connect | `server.js` |
| W-S4 | No `maxPayload` on WebSocket (default 100 MB) | `server.js` |
| W-S5 | No WebSocket connection rate limiting | `server.js` |
| W-S6 | No security headers (CSP, X-Frame-Options, etc.) | `next.config.ts` |
| W-S7 | Prompt injection surface in analyze-photo (conversationContext unsanitized) | `app/api/analyze-photo/route.ts` |
| W-S8 | Error responses expose `error.message` (could leak internals) | All API routes |
| W-S9 | `npm audit` not run -- should be in CI | `.github/workflows/ci.yml` |

### Performance (8)

| # | Finding | File(s) |
|---|---------|---------|
| W-P1 | No code splitting for conditional components (CameraCapture, PhotoChooser, etc.) | `VoiceLoop.tsx` |
| W-P2 | `Visualizer` resizes canvas buffer every animation frame | `Visualizer.tsx` |
| W-P3 | `useTTS` has no unmount cleanup -- Audio elements can leak | `hooks/useTTS.ts` |
| W-P4 | `useTTSNative` never cancels speechSynthesis on unmount | `hooks/useTTSNative.ts` |
| W-P5 | `useAmbientSound` fade intervals not tracked for cleanup | `hooks/useAmbientSound.ts` |
| W-P6 | Volume decay `setInterval` (100ms) runs in all app states | `VoiceLoop.tsx` |
| W-P7 | HMR cleanup timeout in `useGeminiLive` never cancelled by new mount | `hooks/useGeminiLive.ts` |
| W-P8 | `usePlatformSpeech` imports unused `useMediaRecorderSpeech` | `hooks/usePlatformSpeech.ts` |

### UX & Accessibility (10)

| # | Finding | File(s) |
|---|---------|---------|
| W-U1 | Start Walk button missing `aria-label` | `VoiceLoop.tsx` (829-837) |
| W-U2 | End Walk button missing `aria-label` | `VoiceLoop.tsx` (921-930) |
| W-U3 | PhotoChooser modal missing `role="dialog"` / `aria-modal` | `PhotoChooser.tsx` |
| W-U4 | Summary action buttons lack `aria-label` | `VoiceLoop.tsx` (1179-1323) |
| W-U5 | GardenJourney SVG icons lack accessible names | `GardenJourney.tsx` |
| W-U6 | `text-stone-500` on dark backgrounds fails WCAG AA (3.9:1) | Multiple files |
| W-U7 | Clipboard failure silently shows "Copied!" | `VoiceLoop.tsx` (1197-1203) |
| W-U8 | Missing `maskable` icon purpose in PWA manifest | `manifest.json` |
| W-U9 | Missing Apple touch icon + favicon | `public/` |
| W-U10 | No service worker -- app not installable as PWA | N/A |

### DevOps (4)

| # | Finding | File(s) |
|---|---------|---------|
| W-D1 | `DEEPGRAM_API_KEY` missing from `.env.example` and CI | `.env.example`, `ci.yml` |
| W-D2 | Untracked `.claude/commands/pre-launch.md` | `.claude/commands/` |
| W-D3 | `develop` is 30 files ahead of `main` with no open PR | Git state |
| W-D4 | Deprecated `url.parse()` in server.js | `server.js` (line 3, 36) |

---

## INFO Items (~20)

### Positives
- Clean build, types, and lint
- Good ref-based callback patterns in hooks (avoids stale closures)
- Thoughtful HMR protection in `useGeminiLive` WebSocket hook
- Clean `server.js` architecture with proper WebSocket upgrade handling
- Hybrid photo analysis (REST) + voice (WebSocket) bridge design is solid
- Thorough safe-area handling for mobile
- Comprehensive loading states across all async operations
- Well-differentiated voice state indicators (green = listening, blue = speaking)
- Good input validation on `analyze-photo` and `transcribe` routes
- No hardcoded secrets; all API keys via `process.env`
- No XSS vulnerabilities (React default escaping, no `dangerouslySetInnerHTML`)
- Env var isolation correct (only OAuth client ID is `NEXT_PUBLIC_`)

### Notes
- Viewport `userScalable: false` is acceptable for standalone PWA
- No live transcript during active session is an intentional design choice
- Server binding to 0.0.0.0 is intentional for LAN phone testing
- `next lint` deprecation warning (Next.js 16 will remove it)
- Recommend running `npm outdated` manually before launch
- `Visualizer` canvas should have `aria-hidden="true"` (decorative)
- `LiveTranscriptionEvents` imported but unused in transcribe route (dead code)
- macOS-specific `ipconfig` in dev-start.sh (dev-only, acceptable)
- `allowedDevOrigins` wildcards in next.config.ts (dev-only)

---

## Test Coverage Summary

| File | Statements | Branches | Lines |
|------|-----------|----------|-------|
| `lib/verbalConfirmation.ts` | 100% | 100% | 100% |
| `lib/googleCalendar.ts` | 100% | 100% | 100% |
| `components/GardenJourney.tsx` | 100% | 100% | 100% |
| `components/PhotoChooser.tsx` | 100% | 100% | 100% |
| `hooks/useCamera.ts` | 96% | 89% | 96% |
| `components/CameraCapture.tsx` | 97% | 86% | 97% |
| `hooks/useGoogleCalendar.ts` | 82% | 77% | 87% |
| `hooks/useAmbientSound.ts` | 60% | 43% | 61% |
| **`hooks/useGeminiLive.ts`** | **33%** | **15%** | **34%** |
| **Overall** | **58%** | **58%** | **59%** |

---

## Fix Priority

1. **Delete dead code** (lowest risk, highest impact)
2. **Compress/lazy-load birds.mp3** (performance blocker)
3. **Add size limits + WebSocket hardening** (security)
4. **Replace `alert()`, add `aria-live` regions** (UX blockers)
5. **Extract business logic from VoiceLoop** (architecture + testability)
6. **Replace placeholder tests + improve coverage** (QA)
7. **Add security headers, PWA assets, service worker** (polish)
8. **DevOps cleanup** (CI, env docs, git state)
