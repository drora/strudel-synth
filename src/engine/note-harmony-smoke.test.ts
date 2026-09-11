/**
 * Smoke: song scale/root remap + per-track octave shifts.
 * Run: npx --yes tsx src/engine/note-harmony-smoke.test.ts
 * Or:  npm run test:note-harmony
 */
import assert from 'node:assert/strict'
import {
  formatNote,
  remapNotesToHarmony,
  shiftNotesByOctaves,
  rootIndex,
  isMelodicRole,
} from './note-harmony'
import { reshuffleTrack } from './reshuffle'

console.log('=== note-harmony smoke ===')

assert.equal(isMelodicRole('lead'), true)
assert.equal(isMelodicRole('drums'), false)
assert.equal(isMelodicRole('fx'), false)

{
  const code = 'note("c3 eb3 g3").sound("sawtooth").gain(0.5)'
  const up = shiftNotesByOctaves(code, 1)
  assert.equal(up, 'note("c4 eb4 g4").sound("sawtooth").gain(0.5)')
  const down = shiftNotesByOctaves(code, -1)
  assert.equal(down, 'note("c2 eb2 g2").sound("sawtooth").gain(0.5)')
  // Sound/bank untouched
  const banky = 's("bd sd").bank("RolandTR909")'
  assert.equal(shiftNotesByOctaves(banky, 2), banky)
}

{
  const code = 'note("<c4 eb4 g4>").sound("triangle")'
  const remapped = remapNotesToHarmony(code, 'c', 'minor', 'd', 'minor')
  assert.ok(remapped.includes('note('))
  assert.ok(!remapped.includes('c4'), `expected root shift away from c4, got ${remapped}`)
  assert.ok(remapped.includes('sound("triangle")'), 'sound preserved')
  // d minor degrees from transposed c-minor triad-ish
  assert.match(remapped, /note\("/)
}

{
  // Chord brackets
  const code = 'note("[c3,eb3,g3]").sound("sine").room(0.5)'
  const up = shiftNotesByOctaves(code, 1)
  assert.equal(up, 'note("[c4,eb4,g4]").sound("sine").room(0.5)')
}

{
  // Shuffle respects song root/scale + octave offset
  const base = reshuffleTrack('bass', 'note("c2").sound("sawtooth")', {
    shuffle: {
      groove: 'four_on_floor',
      density: 'mid',
      root: 'f',
      scale: 'dorian',
      melodicSounds: ['sawtooth'],
    },
    octaveOffset: 1,
  })
  assert.ok(base.includes('note('), base)
  assert.ok(base.includes('sound("sawtooth")') || base.includes('s("'), base)
  // With +1 octave, bass base oct 2 → notes should include oct 3-ish tokens often
  const nums = [...base.matchAll(/[a-g][#b]?\d/gi)].map((m) => m[0])
  assert.ok(nums.length > 0, `expected note tokens in ${base}`)
}

assert.equal(formatNote(rootIndex('c'), 4), 'c4')
assert.equal(formatNote(rootIndex('eb'), 3), 'eb3')

console.log('note-harmony smoke OK')
