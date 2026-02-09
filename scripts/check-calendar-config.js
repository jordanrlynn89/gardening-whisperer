#!/usr/bin/env node

/**
 * Check Google Calendar integration configuration
 * Run: node scripts/check-calendar-config.js
 */

console.log('🔍 Checking Google Calendar Configuration\n');

// Check environment variables
console.log('Environment Variables:');
console.log('  NEXT_PUBLIC_GOOGLE_CLIENT_ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set');

if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
  console.log('\n⚠️  NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set!');
  console.log('\nTo fix this:');
  console.log('  1. Locally: Add it to .env.local');
  console.log('  2. Railway: Add it in Settings → Variables → Environment Variables');
  console.log('\nExample value:');
  console.log('  NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com');
} else {
  console.log('\n✅ Environment variable is set correctly');

  // Extract domain from client ID
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  console.log('\nClient ID:', clientId);

  console.log('\n📋 Next steps:');
  console.log('  1. Go to Google Cloud Console → APIs & Services → Credentials');
  console.log('  2. Find OAuth 2.0 Client ID:', clientId);
  console.log('  3. Add authorized JavaScript origins:');
  console.log('     - http://localhost:3003 (local dev)');
  console.log('     - https://your-app.up.railway.app (production)');
  console.log('  4. Enable Google Calendar API in APIs & Services → Library');
  console.log('  5. Add your Google account as a test user (OAuth consent screen)');
}

console.log('\n📚 Full setup guide: docs/google-calendar-setup.md\n');
