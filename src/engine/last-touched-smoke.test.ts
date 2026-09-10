/**
 * Smoke: lastTouchedTrackId update helpers.
 * Run: npx --yes tsx src/engine/last-touched-smoke.test.ts
 * Or:  npm run test:last-touched
 */
import assert from 'node:assert/strict'
import {
  resolveCodeOpenTrackId,
  keepOrFallbackLastTouched,
  afterTrackRemoved,
} from './last-touched'

const ids = ['a', 'b', 'c']

assert.equal(resolveCodeOpenTrackId('b', ids), 'b')
assert.equal(resolveCodeOpenTrackId('gone', ids), 'a')
assert.equal(resolveCodeOpenTrackId(null, ids), 'a')
assert.equal(resolveCodeOpenTrackId(null, []), null)

assert.equal(keepOrFallbackLastTouched('b', ids, ['a', 'c']), 'b')
assert.equal(keepOrFallbackLastTouched('gone', ids, ['c']), 'c')
assert.equal(keepOrFallbackLastTouched(null, ids, []), 'a')
assert.equal(keepOrFallbackLastTouched(null, [], []), null)

assert.equal(afterTrackRemoved('b', 'b'), null)
assert.equal(afterTrackRemoved('a', 'b'), 'a')
assert.equal(afterTrackRemoved(null, 'b'), null)

console.log('last-touched smoke OK')
