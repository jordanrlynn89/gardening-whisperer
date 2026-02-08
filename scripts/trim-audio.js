#!/usr/bin/env node
/**
 * Trim the 22 MB birds.mp3 ambient sound to a 30-second loop (~750 KB).
 * Requires ffmpeg to be installed (`brew install ffmpeg`).
 *
 * Usage: node scripts/trim-audio.js
 */
const { execSync } = require('child_process');
const path = require('path');

const input = path.join(__dirname, '..', 'public', 'sounds', 'birds.mp3');
const output = path.join(__dirname, '..', 'public', 'sounds', 'birds-loop.mp3');

try {
  execSync(`ffmpeg -i "${input}" -t 30 -c copy "${output}" -y`, { stdio: 'inherit' });
  console.log('Done: trimmed birds.mp3 (22 MB) -> birds-loop.mp3 (~750 KB)');
} catch (e) {
  console.error('Failed to trim audio. Is ffmpeg installed?');
  console.error(e.message);
  process.exit(1);
}
