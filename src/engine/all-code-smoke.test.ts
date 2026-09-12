/**
 * Smoke: all-tracks Code buffer serialize / parse.
 * Run: npm run test:all-code
 */
import assert from 'node:assert/strict'
import {
  CODE_ALL,
  isCodeAllOpen,
  tracksToAllCode,
  parseAllCode,
  applyAllCodeToTracks,
} from './all-code'
import type { Track } from './types'

function track(id: string, name: string, code: string): Track {
  return {
    id,
    name,
    code,
    role: 'custom',
    color: '#fff',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  }
}

console.log('=== all-code smoke ===')

{
  assert.equal(isCodeAllOpen(CODE_ALL), true)
  assert.equal(isCodeAllOpen('kick'), false)
  assert.equal(isCodeAllOpen(null), false)
  console.log('sentinel ok')
}

{
  const tracks = [
    track('a', 'Kick', 's("bd")'),
    track('b', 'Hats', 's("hh*8")'),
  ]
  const buf = tracksToAllCode(tracks)
  assert.match(buf, /\/\/ @track a  Kick/)
  assert.match(buf, /\/\/ @track b  Hats/)
  const parsed = parseAllCode(buf, tracks)
  assert.deepEqual(parsed, [
    { id: 'a', code: 's("bd")' },
    { id: 'b', code: 's("hh*8")' },
  ])
  assert.equal(applyAllCodeToTracks(buf, tracks).length, 0)
  const edited = buf.replace('s("bd")', 's("bd sd")')
  const diff = applyAllCodeToTracks(edited, tracks)
  assert.deepEqual(diff, [{ id: 'a', code: 's("bd sd")' }])
  console.log('roundtrip ok')
}

{
  const tracks = [track('a', 'Kick', 's("bd")'), track('b', 'Hats', 's("hh")')]
  const parsed = parseAllCode('// @track a  Kick\ns("cp")\n\n// leftover', tracks)
  assert.deepEqual(parsed, [{ id: 'a', code: 's("cp")\n\n// leftover' }])
  const unknown = parseAllCode('// @track z  Ghost\ns("xx")', tracks)
  assert.equal(unknown.length, 0)
  console.log('partial parse ok')
}

console.log('all-code-smoke.test.ts: ok')
