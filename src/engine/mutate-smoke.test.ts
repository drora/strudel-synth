/**
 * Mutate: deterministic pattern transforms + FX/sound chain intact; undo batch shape.
 */
import assert from 'node:assert/strict'
import {
  MUTATIONS,
  applyMutateToTracks,
  mutatePatternCode,
  tokenizeMini,
  transformSparse,
  transformDenser,
  transformHalfTime,
  transformDoubleTime,
  transformReverse,
  transformRotate,
  transformStutter,
  transformSkeleton,
  transformEveryOther,
  transformSyncopate,
  transformGhosts,
  transformStraighten,
} from './mutate'
import { splitEffectSuffix } from './code-effects'
import type { Track } from './types'

function track(id: string, code: string, role: Track['role'] = 'drums'): Track {
  return {
    id,
    name: id,
    role,
    code,
    color: '#fff',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  }
}

console.log('=== Mutate smoke ===')

assert.equal(MUTATIONS.length, 13, 'core 8 + 5 extras (rotate L/R)')
assert.ok(MUTATIONS.every((m) => m.label && m.id))
assert.equal(MUTATIONS.find((m) => m.id === 'half-time')?.scope, 'song')
assert.equal(MUTATIONS.find((m) => m.id === 'double-time')?.scope, 'song')
assert.equal(MUTATIONS.find((m) => m.id === 'sparse')?.scope, 'track')
console.log('  catalog: 13 transforms; half/double song-scoped')

{
  const toks = tokenizeMini('bd [sd, cp] <hh oh> ~')
  assert.deepEqual(toks, ['bd', '[sd, cp]', '<hh oh>', '~'])
  console.log('  tokenizeMini: groups preserved')
}

{
  assert.deepEqual(transformSparse(['bd', 'sd', 'hh', 'hh']), ['bd', '~', 'hh', '~'])
  assert.deepEqual(transformDenser(['bd', '~', 'sd', '~']), ['bd', 'bd', 'sd', 'sd'])
  assert.deepEqual(transformHalfTime(['bd', 'sd']), ['bd', '~', 'sd', '~'])
  assert.deepEqual(transformDoubleTime(['bd', '~', 'sd', '~']), ['bd', 'sd'])
  assert.deepEqual(transformReverse(['a', 'b', 'c']), ['c', 'b', 'a'])
  assert.deepEqual(transformRotate(['a', 'b', 'c'], -1), ['b', 'c', 'a'])
  assert.deepEqual(transformRotate(['a', 'b', 'c'], 1), ['c', 'a', 'b'])
  assert.deepEqual(transformStutter(['bd', 'sd', 'hh']), ['bd', 'sd', 'hh*4'])
  assert.deepEqual(transformEveryOther(['bd', 'sd', 'hh', 'oh']), ['bd', '~', 'hh', '~'])
  assert.deepEqual(transformSyncopate(['bd', '~', 'sd', '~']), ['~', 'bd', '~', 'sd'])
  assert.ok(transformGhosts(['bd', '~', 'sd']).some((t) => t.includes('bd')))
  assert.ok(transformStraighten(['bd', 'sd', 'hh', 'oh']).includes('bd'))
  console.log('  token transforms: ok')
}

{
  const sk = transformSkeleton(['bd', 'sd', 'hh', 'cp', 'hh', 'oh'], 's', 'drums')
  assert.equal(sk[0], 'bd')
  assert.ok(sk.every((t, i) => t === '~' || i === 0 || /hh|oh/.test(t) || t === 'bd'))
  const mel = transformSkeleton(['c3', 'eb3', 'g3', 'bb3'], 'note', 'lead')
  assert.equal(mel[0], 'c3')
  assert.ok(mel.filter((t) => t !== '~').every((t) => t === 'c3'))
  console.log('  skeleton: drums kick+hats; melodic root drones')
}

{
  const code = 's("bd sd hh hh").bank("RolandTR909").gain(0.8).room(0.3)'
  const { fx: fxBefore } = splitEffectSuffix(code)
  const next = mutatePatternCode(code, 'reverse', 'drums')
  assert.notEqual(next, code)
  assert.ok(next.includes('s("hh hh sd bd")'), `got ${next}`)
  assert.equal(splitEffectSuffix(next).fx, fxBefore)
  console.log('  s() reverse keeps bank/FX chain')
}

{
  const code = 'note("c3 eb3 g3 bb3").sound("sawtooth").lpf(1200).gain(0.7)'
  const next = mutatePatternCode(code, 'sparse', 'lead')
  assert.ok(next.includes('note("c3 ~ g3 ~")'), `got ${next}`)
  assert.ok(next.includes('.sound("sawtooth")'))
  assert.ok(next.includes('.lpf(1200)'))
  console.log('  note() sparse keeps sound/FX')
}

{
  const code = 's("sawtooth").note("c3 eb3 g3").gain(0.6)'
  const next = mutatePatternCode(code, 'reverse', 'lead')
  assert.ok(next.startsWith('s("sawtooth")'), 'voice pin untouched')
  assert.ok(next.includes('note("g3 eb3 c3")'), `got ${next}`)
  console.log('  s(voice).note(...): only note mutates')
}

{
  const drums = track('d', 's("bd sd hh hh").bank("RolandTR909")', 'drums')
  const lead = track('l', 'note("c3 eb3 g3").sound("sawtooth")', 'lead')
  const r = applyMutateToTracks([drums, lead], 'half-time', 'l')
  assert.ok(r)
  assert.equal(r.scope, 'song')
  assert.equal(r.changes.length, 2, 'half-time hits all unlocked')
  assert.ok(r.changes.every((c) => c.code.includes('~')))
  console.log('  half-time: song-global')
}

{
  const a = track('a', 's("bd sd cp hh").bank("RolandTR808")', 'drums')
  const b = track('b', 'note("c2 g2").sound("triangle")', 'bass')
  b.locked = true
  const r = applyMutateToTracks([a, b], 'double-time', 'a')
  assert.ok(r)
  assert.equal(r.changes.length, 1)
  assert.equal(r.changes[0]!.trackId, 'a')
  console.log('  double-time: skips locked')
}

{
  const a = track('a', 's("bd sd hh oh")', 'drums')
  const b = track('b', 'note("c4 e4")', 'lead')
  const r = applyMutateToTracks([a, b], 'stutter', 'b')
  assert.ok(r)
  assert.equal(r.changes.length, 1)
  assert.equal(r.changes[0]!.trackId, 'b')
  assert.ok(r.changes[0]!.code.includes('*4'))
  console.log('  track scope: last-touched only')
}

{
  const locked = track('x', 's("bd sd")', 'drums')
  locked.locked = true
  const r = applyMutateToTracks([locked], 'sparse', 'x')
  assert.equal(r, null)
  console.log('  locked track: no change')
}

{
  const code = 's("bd sd hh cp").bank("X")'
  const once = mutatePatternCode(code, 'reverse', 'drums')
  const twice = mutatePatternCode(once, 'reverse', 'drums')
  assert.equal(twice, code)
  console.log('  reverse twice = identity')
}

console.log('ALL MUTATE CHECKS PASSED')
