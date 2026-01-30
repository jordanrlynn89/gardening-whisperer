# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gardening Whisperer** is a voice-first AI gardening assistant PWA built for a hackathon demo. The app combines spoken conversation and photo-based reasoning to help gardeners diagnose plant issues hands-free.

**Key constraints:**
- Solo developer project (2-4 weeks)
- Chrome-only (no cross-browser support needed)
- Demo must be flawless - cut features aggressively if behind schedule
- Success metric: Garden walk flow works perfectly

## Working with This Project

### Verification is Critical
Always provide ways to verify your work:
- Write tests for voice transcription, Gemini API responses, and TTS output
- Test the camera flow end-to-end (verbal confirmation → capture → analysis)
- Verify the garden walk flow completes successfully with proper coverage tracking
- Run the dev server and manually test voice interactions after changes
- For UI changes, describe what should be visible/audible and verify it matches

### Development Workflow
1. **Explore first**: Read existing code before making changes
2. **Plan for multi-file changes**: Use Plan Mode for features touching >2 files or architectural decisions
3. **Skip planning for simple fixes**: Direct implementation is fine for typos, single-line changes, or clear bug fixes
4. **Verify immediately**: Test after every significant change
5. **Course-correct early**: Stop and redirect as soon as something looks wrong

### Context Management
- Run `/clear` between unrelated tasks (e.g., after fixing a bug, before starting a new feature)
- Use subagents for codebase exploration to avoid cluttering main context
- Keep conversations focused on one feature/bug at a time

## Technical Stack

- **Frontend:** React/Next.js configured as PWA
- **Speech-to-Text:** Web Speech API (browser-native, Chrome-only)
- **Text-to-Speech:** ElevenLabs API
- **AI Model:** Gemini 3 Pro (multimodal: text + images)

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Add your API keys:
   - Gemini API: https://ai.google.dev/
   - ElevenLabs API: https://elevenlabs.io/

## Core Architecture

### Two-Layer Response Pattern

Gemini returns responses in two parts:
1. **Structured JSON** - Drives app behavior (diagnosis data, confidence levels, next actions, coverage tracking)
2. **Natural language text** - Sent to ElevenLabs for spoken response

Structure only what the app needs to reason about. Keep spoken responses conversational.

### Voice Interaction Flow

Turn-based conversation (not continuous streaming):
1. User speaks → Web Speech API transcribes
2. Transcription sent to Gemini (with conversation context)
3. Gemini responds with JSON + natural language
4. Natural language sent to ElevenLabs
5. Audio played back to user

**Turn-taking:** After 2-3 seconds of silence, soft prompt: "Anything else?" before AI responds.

### Garden Walk Structure

Semi-structured voice session with coverage tracking:
- AI frames scope at start: "I'd like to ask about your plant, the conditions, and what you've noticed"
- AI tracks which question categories have been addressed (plant ID, symptoms, environment, care history)
- AI wraps up when sufficient coverage is gathered
- Handles off-script deviations: "Want me to answer that now or finish the walk first?"

### Photo Diagnosis Flow

1. AI suggests: "Would you like to show me that?"
2. User confirms verbally: "Yes"
3. Camera opens via user gesture
4. User captures photo
5. Image sent to Gemini alongside conversation context
6. Visual analysis combined with conversational data for diagnosis

## Development Priorities

### Phased Build Schedule

**Week 1:** Core voice loop (speak → AI responds audibly → speak again)
**Week 2:** Garden walk structure with coverage tracking
**Week 3:** Photos & mobile polish
**Week 4:** Demo prep (summary/share feature, bug fixes, record video)

**If behind schedule:** Cut photo feature first, focus on voice-only garden walk.

### Voice Design Requirements

- **Persona:** Friendly Gardener (warm, encouraging, simple language)
- Short, structured responses optimized for voice
- "Acknowledgment first" pattern (e.g., "Got it.")
- Templated confidence language: "likely" / "possible" / "unlikely" (no numeric percentages)
- Every diagnosis includes: observed symptoms, reasoning, confidence indicators, alternative hypotheses

### Action-Oriented Output

Each interaction must end with:
- Do this today
- Check again in X days
- If this worsens...

## MVP Scope Cuts

The following are **explicitly out of scope** for MVP:
- Offline capture mode
- Multiple voice personas
- Follow-up reminders
- Season-level retrospectives
- Emotional awareness detection
- Cross-browser support (Chrome-only)
- Account/login system (session-only context)

## Demo Requirements

**Test scenario:** Tomato plant with yellowing leaves
**Video format:** Hybrid (real app screen recording + motion graphics)
**Target:** Show voice interaction, garden walk flow, photo diagnosis, and summary/share feature

---

## Maintaining This File

Keep CLAUDE.md concise. Only include:
- ✅ Build/test/dev commands once project is initialized
- ✅ Architectural patterns that aren't obvious from code
- ✅ Project-specific constraints and priorities
- ✅ API integration patterns (Gemini, ElevenLabs, Web Speech API)

Do NOT include:
- ❌ Standard language conventions
- ❌ Generic advice like "write tests" or "handle errors"
- ❌ File-by-file descriptions of the codebase
- ❌ Information that changes frequently
- ❌ Things Claude can figure out by reading code
