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
  transformTo16,
  transformTo8,
  applyIntensityFromBase,
} from './mutate'
import {
  clampIntensity,
  nextIntensity,
  shouldDropSpawnedPad,
  shouldSpawnIntensityPad,
  intensitySpawnRole,
  shouldSpawnIntensityLane,
} from './intensity'
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

assert.equal(MUTATIONS.length, 15, '13 + intensity up/down')
assert.ok(MUTATIONS.every((m) => m.label && m.id))
assert.equal(MUTATIONS.find((m) => m.id === 'half-time')?.scope, 'song')
assert.equal(MUTATIONS.find((m) => m.id === 'double-time')?.scope, 'song')
assert.equal(MUTATIONS.find((m) => m.id === 'intensity-up')?.scope, 'song')
assert.equal(MUTATIONS.find((m) => m.id === 'intensity-down')?.scope, 'song')
assert.equal(MUTATIONS.find((m) => m.id === 'sparse')?.scope, 'track')
console.log('  catalog: 15 transforms; half/double/intensity song-scoped')

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

{
  assert.deepEqual(transformTo16(['bd', '~', 'sd', '~']), ['bd', 'bd', 'sd', 'sd'])
  assert.deepEqual(transformTo8(['bd', 'bd', 'sd', 'sd']), ['bd', '~', 'sd', '~'])
  assert.deepEqual(transformTo8(transformTo16(['bd', '~', 'sd', '~'])), ['bd', '~', 'sd', '~'])

  const drums = 's("bd ~ sd ~ hh ~ oh ~").bank("RolandTR909")'
  assert.equal(applyIntensityFromBase(drums, 'drums', 1), drums)
  const l2 = applyIntensityFromBase(drums, 'drums', 2)
  assert.ok(l2.includes('bd ~ sd ~'), `L2 kick/snare stay: ${l2}`)
  assert.ok(l2.includes('hh hh') || l2.includes('oh oh'), `L2 doubled hats: ${l2}`)
  assert.ok(!/\.gain\(/.test(l2) && !/\.room\(/.test(l2), `L2 no mush FX: ${l2}`)
  const l3 = applyIntensityFromBase(drums, 'drums', 3)
  assert.equal(l3, l2, 'L3 spawn is jam-actions, not pattern')
  const l4 = applyIntensityFromBase(drums, 'drums', 4)
  assert.ok(l4.includes('bd bd'), `L4 kick: ${l4}`)
  assert.ok(l4.includes('sd sd'), `L4 snare: ${l4}`)
  assert.ok(l4.includes('hh hh') || l4.includes('oh oh'), `L4 hats stay doubled: ${l4}`)

  const hats = 's("hh ~ oh ~")'
  const hats16 = 's("hh hh oh oh")'
  assert.equal(applyIntensityFromBase(hats, 'hihats', 2), hats16)
  assert.equal(applyIntensityFromBase(hats, 'hihats', 3), hats16)
  assert.equal(applyIntensityFromBase(hats, 'hihats', 4), hats16)

  const bass = 'note("c2 ~ g2 ~").sound("sawtooth")'
  assert.equal(applyIntensityFromBase(bass, 'bass', 2), bass)
  const bass4 = applyIntensityFromBase(bass, 'bass', 4)
  assert.ok(bass4.includes('note("c2 c2 g2 g2")'), bass4)

  const pad = 'note("c3 eb3 g3").sound("triangle").gain(0.6)'
  assert.equal(applyIntensityFromBase(pad, 'pad', 4), pad)
  console.log('  intensity: 1 as-is · 2 hats · 3 same pattern · 4 bd+sd+bass; no mush')
}

{
  assert.equal(clampIntensity(0), 1)
  assert.equal(clampIntensity(5), 4)
  assert.equal(nextIntensity(1, 1), 2)
  assert.equal(nextIntensity(4, 1), 4)
  assert.equal(nextIntensity(1, -1), 1)
  assert.equal(nextIntensity(3, -1), 2)
  assert.equal(shouldSpawnIntensityPad(2, false), false)
  assert.equal(shouldSpawnIntensityPad(3, false), true)
  assert.equal(shouldSpawnIntensityPad(3, true), false)
  assert.equal(intensitySpawnRole(false), 'pad')
  assert.equal(intensitySpawnRole(true), 'arp')
  assert.equal(shouldSpawnIntensityLane(3, false), true)
  assert.equal(shouldSpawnIntensityLane(3, true), false)
  assert.equal(shouldDropSpawnedPad(2), true)
  assert.equal(shouldDropSpawnedPad(3), false)
  console.log('  intensity levels: 1–4; pad or arp at 3')
}

console.log('ALL MUTATE CHECKS PASSED')
