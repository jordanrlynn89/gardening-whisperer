# Security Checklist

## ✅ Current Security Status

### API Keys Protected
- ✅ `.env.local` is in `.gitignore` (line 34: `.env*.local`)
- ✅ `.env.local` is NOT tracked by git
- ✅ API keys are server-side only (no `NEXT_PUBLIC_` prefix)
- ✅ `.env.example` contains placeholder values only
- ✅ Gemini API calls happen server-side via `/app/api/chat/route.ts`

### What's Safe to Commit
- ✅ `.env.example` - Template with placeholders
- ✅ All code in `/app`, `/components`, `/hooks`, `/lib`
- ✅ Documentation in `/docs`
- ✅ Type definitions in `/types`

### What's Never Committed
- ✅ `.env.local` - Contains real API keys (auto-ignored)
- ✅ `.env` - Any environment files (auto-ignored)
- ✅ `node_modules/` - Dependencies (auto-ignored)

## 🔒 Security Best Practices

### Environment Variables

**Server-side only (secure):**
```bash
GEMINI_API_KEY=xyz123
ELEVENLABS_API_KEY=xyz123
```

**Client-side exposed (AVOID for secrets):**
```bash
NEXT_PUBLIC_API_KEY=xyz123  # ❌ DON'T DO THIS FOR SECRETS
```

### API Routes
All sensitive operations happen server-side:
- ✅ `/app/api/chat/route.ts` - Gemini API calls
- ✅ `/app/api/tts/route.ts` - ElevenLabs calls (when added)

Client never sees API keys.

### Before Every Commit

```bash
# 1. Check what's being committed
git status

# 2. Verify .env.local is NOT listed
# If you see .env.local, STOP and check .gitignore

# 3. Review changes
git diff

# 4. Search for accidentally committed secrets
git diff | grep -i "api.*key"
```

## 🚨 If You Accidentally Commit a Secret

**Don't panic, but act quickly:**

1. **Rotate the API key immediately**
   - Go to https://ai.google.dev/ and generate a new Gemini key
   - Go to https://elevenlabs.io/ and generate a new ElevenLabs key
   - Update `.env.local` with new keys

2. **Remove from git history** (if pushed to GitHub)
   ```bash
   # Use GitHub's secret scanning to detect exposed keys
   # They'll alert you and you should rotate immediately
   ```

3. **Update .gitignore** if needed
   ```bash
   # Verify .env*.local is in .gitignore
   git check-ignore .env.local
   # Should output: .env.local
   ```

## 📋 Security Audit Commands

```bash
# Verify .env.local is ignored
git check-ignore .env.local
# Expected: .env.local

# Check for tracked env files
git ls-files | grep -E "\.env"
# Expected: Only .env.example

# Search for API key patterns in tracked files
git grep -i "AIzaSy"
# Expected: No results

# Check current git status
git status --ignored
# .env.local should appear under "Ignored files"
```

## 🛡️ Current API Keys in Use

**Location:** `.env.local` (not committed)
- `GEMINI_API_KEY` - Google Gemini API
- `ELEVENLABS_API_KEY` - ElevenLabs TTS (when added)

**Usage:**
- Accessed server-side only via `process.env.*`
- Never exposed to browser/client
- Never in client-side components

## ✅ Verification

Run this to verify security:
```bash
# Should NOT show .env.local
git status

# Should show .env.local
git status --ignored | grep env.local

# Should return .env.local
git check-ignore .env.local
```

All checks passed? You're secure! 🔒
