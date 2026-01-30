# Gardening Whisperer
**Voice-First, Multimodal AI Gardening Assistant**

---

## 1. Product Overview

**Gardening Whisperer** is a **voice-first AI assistant** designed for real-world gardening conditions where hands are busy, typing is inconvenient, and connectivity may be unreliable. The app combines **spoken conversation** and **photo-based reasoning** to help gardeners diagnose plant issues in the moment.

The product emphasizes **explainable, confidence-aware AI**, positioning Gemini as a thoughtful partner rather than an authoritative oracle.

---

## 2. Project Context

| Attribute | Decision |
|-----------|----------|
| **Platform** | Web PWA (Chrome-only for demo) |
| **Scope** | Lean MVP for hackathon/demo |
| **Timeline** | 2-4 weeks |
| **Team** | Solo developer |
| **Tech familiarity** | New to Web Speech API, ElevenLabs, and Gemini |
| **Risk tolerance** | Must have working demo - will cut features aggressively if behind |
| **Success metric** | Garden walk flow works flawlessly |
| **Demo format** | Recorded hybrid video (real app footage + motion graphics) |

---

## 3. Objectives

### Primary Objectives
- Enable gardeners to interact **hands-free via voice**
- Diagnose plant issues using **voice + images**
- Deliver **clear, explainable, actionable guidance**

### Secondary Objectives
- Demonstrate responsible use of **multimodal AI**
- Build user trust through transparency and uncertainty acknowledgment

---

## 4. Target Users

- Home gardeners (beginner to intermediate)
- Gardeners who prefer conversational guidance over technical manuals
- Users comfortable with voice interaction

**Demo scenarios to test:** Common vegetables, houseplants, herb gardens, flower gardens

---

## 5. Core Design Principles

1. Voice-first by default
2. Multimodal reasoning over rigid rules
3. Probabilistic assessments, not certainty
4. Human-in-the-loop
5. Demo reliability over feature breadth

---

## 6. Technical Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| **Frontend** | React / Next.js | PWA configuration for mobile |
| **Speech-to-Text** | Web Speech API | Chrome-only, browser-native |
| **Text-to-Speech** | ElevenLabs | High-quality voice for Friendly Gardener persona |
| **AI Model** | Gemini 3 Pro | Multimodal (text + images) |
| **Hosting** | TBD | - |

### Prompt Architecture

Two-layer response structure from Gemini:
1. **Structured JSON** - Drives app behavior (diagnosis data, confidence levels, next actions, coverage tracking)
2. **Natural language** - Sent to ElevenLabs for spoken response

Structure only what the app needs to reason about. Keep spoken responses conversational.

---

## 7. Feature Set

### 7.1 Voice-First Conversational Interface

**Core loop:** User speaks → Transcribed → Gemini reasons → Response spoken via ElevenLabs

**Design decisions:**
- Turn-based conversation (not continuous streaming)
- Short, structured responses optimized for voice
- "Acknowledgment first" response pattern (e.g., "Got it.")
- **Turn-taking:** Silence detection (2-3 seconds) triggers soft prompt: "Anything else?" before AI responds
- **Error recovery:** User can say "try again" to regenerate response

**Browser compatibility:** Chrome-only. No fallbacks for unsupported browsers in MVP.

---

### 7.2 Guided Garden Walk-Through

A structured but natural voice session where the AI guides the user through describing their garden.

**Flow:**
1. User starts a "Garden Walk"
2. AI provides **progress framing** at start: "I'd like to ask about your plant, the conditions, and what you've noticed"
3. AI prompts observational questions from **semi-structured categories**
4. AI tracks coverage and wraps up when sufficient information gathered

**Question categories (AI picks within each):**
- Plant identification
- Observed symptoms
- Environmental conditions
- Recent care history

**Completion logic:** Coverage-based. AI tracks which categories have been addressed and summarizes when sufficient context is gathered.

**Handling deviations:** If user goes off-script, AI asks: "Want me to answer that now or finish the walk first?"

---

### 7.3 Image-Assisted Diagnosis

**Photo capture flow:**
1. AI suggests: "Would you like to show me that?"
2. User confirms verbally: "Yes"
3. Camera opens
4. User takes photo
5. Gemini analyzes visual cues alongside conversational context

**Output includes:**
- Explicit visual observations
- Probable causes with templated confidence language
- Alternative explanations

**Handling uncertainty:** If Gemini can't identify the plant or is unsure, acknowledge it directly: "I'm not certain what plant this is. Can you tell me?"

---

### 7.4 Explainable & Confidence-Aware Assessments

Every diagnosis includes:
- Observed symptoms
- Reasoning behind conclusions
- **Templated confidence language** (likely / possible / unlikely)
- Secondary hypotheses

**Example:**
> "Based on the yellowing of older leaves and visibly wet soil, overwatering is the most likely cause. A nutrient deficiency is also possible."

**Note:** No numeric percentages. Use natural language confidence indicators.

---

### 7.5 Action-Oriented Guidance

Each interaction ends with:
- **Do this today**
- **Check again in X days**
- **If this worsens…**

---

### 7.6 Voice Persona

**Single persona for MVP:** Friendly Gardener
- Warm, encouraging, simple language
- Broadest appeal for demo audience

Persona affects tone and verbosity, not factual content.

---

### 7.7 Session Summary & Sharing

**Context persistence:** Session-only (resets when browser closes)

**Export feature:**
- Copy/share button generates text summary of conversation
- Uses native Web Share API on mobile
- Allows user to send summary to themselves for reference

---

## 8. User Experience Details

### 8.1 Visual Design

**Direction:** Earthy/organic
- Greens, browns, natural textures
- Botanical illustrations or accents
- Minimal ambient UI while speaking (waveform/pulse animation)
- Conversation transcript below voice visualization

### 8.2 Mobile/PWA Considerations

**Primary concern:** Touch targets and one-handed usability
- Large tap targets for key actions
- Designed for use while holding phone in garden
- High contrast for outdoor/sunlight visibility

### 8.3 Permissions & Onboarding

**Microphone permission flow:**
1. Brief onboarding screen explaining voice-first nature
2. Request microphone permission with context
3. Proceed to main experience

### 8.4 Network Error Handling

- Automatic retry with backoff on API failures
- Loading state shown during retry
- Simple error message if retries exhausted

---

## 9. Out of Scope for MVP

The following features from the original vision are **cut** for the lean MVP:

| Feature | Reason |
|---------|--------|
| Offline-aware capture mode | Adds complexity, requires connectivity for demo anyway |
| Multiple voice personas | Focus on nailing one persona (Friendly Gardener) |
| Follow-up reminders | In-app reminder system adds complexity without demo value |
| Season-level retrospective analysis | Requires long-term data, doesn't fit demo format |
| Emotional awareness detection | Over-engineered for MVP scope |
| Cross-browser support | Chrome-only simplifies speech API handling |
| Account/login system | Session-only context, no persistence needed |

---

## 10. Development Approach

**Strategy:** Build incrementally

**Suggested phases:**

### Week 1: Core Voice Loop
- Web Speech API integration (STT)
- Basic Gemini API integration
- ElevenLabs integration (TTS)
- Goal: Speak → AI responds audibly → speak again

### Week 2: Garden Walk Structure
- Semi-structured question flow
- Coverage tracking logic
- Two-layer prompt architecture
- Turn-taking with "anything else?" pattern

### Week 3: Photos & Polish
- Camera integration with confirmation flow
- Image analysis via Gemini
- Visual design implementation
- Mobile touch target optimization

### Week 4: Demo Preparation
- Session summary & share feature
- Bug fixes and edge cases
- Record demo video
- Add motion graphics for context

**If behind schedule:** Cut photo feature first, focus on voice-only garden walk.

---

## 11. Demo Video Plan

**Format:** Hybrid (real app screen recording + motion graphics)

**Structure:**
1. Brief intro explaining the problem (hands dirty, can't type)
2. Show voice interaction with real app
3. Garden walk flow demonstration
4. Photo diagnosis feature
5. Summary/share feature
6. Motion graphics for context/vision where needed

**Test with:** Tomato plant with yellowing leaves (common, relatable problem)
