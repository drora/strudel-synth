/**
 * Smoke: mix-capture mime / clock / 3:00 limit. Run: npm run test:mix-capture
 */
import assert from 'node:assert/strict'
import {
  MIX_CAPTURE_LIMIT_MS,
  captureExtension,
  formatCaptureClock,
  pickCaptureMime,
} from './mix-capture'

console.log('=== mix-capture smoke ===')

assert.equal(MIX_CAPTURE_LIMIT_MS, 180_000)
assert.equal(formatCaptureClock(180_000), '3:00')
assert.equal(formatCaptureClock(61_000), '1:01')
assert.equal(formatCaptureClock(0), '0:00')
assert.equal(captureExtension('audio/mp4'), '.m4a')
assert.equal(captureExtension('audio/webm;codecs=opus'), '.webm')
assert.equal(captureExtension('audio/ogg;codecs=opus'), '.ogg')
const mime = pickCaptureMime()
assert.ok(typeof mime === 'string')
console.log('  3:00 clock + mime ok')
console.log('mix-capture-smoke.test.ts: ok')
