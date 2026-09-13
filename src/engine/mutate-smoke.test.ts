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
  fillSilences,
  applyIntensityFromBase,
  applyIntensityL4Layer,
  doubleImmediate,
  isKickish,
  isSnareish,
} from './mutate'
import {
  clampIntensity,
  nextIntensity,
  shouldDropSpawnedPad,
  shouldSpawnIntensityPad,
  intensitySpawnRole,
  isKeysTrack,
  shouldSpawnIntensityLane,
  intensityLevelsShareSpawn,
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
  assert.deepEqual(fillSilences(['~', 'hh', '~', 'hh'], (x) => x !== '~' && x !== '-'), [
    'hh',
    'hh',
    'hh',
    'hh',
  ])

  const hatsSparse = 's("~ hh ~ hh")'
  const hatsFilled = 's("hh hh hh hh")'
  assert.equal(applyIntensityFromBase(hatsSparse, 'hihats', 2), hatsFilled)
  assert.equal(applyIntensityFromBase(hatsSparse, 'hihats', 3), hatsFilled)
  assert.equal(applyIntensityFromBase(hatsSparse, 'hihats', 4), hatsFilled)

  const hatsDense = 's("hh*8")'
  assert.equal(applyIntensityFromBase(hatsDense, 'hihats', 2), 's("hh*16")')

  assert.deepEqual(fillSilences(['hh(3,8)'], (x) => x !== '~' && x !== '-'), ['hh(5,8)'])
  assert.equal(applyIntensityFromBase('s("hh(3,8)")', 'hihats', 2), 's("hh(5,8)")')
  assert.equal(
    applyIntensityFromBase('s("hh").bank("RolandTR808").euclid(3,8)', 'hihats', 2),
    's("hh").bank("RolandTR808").euclid(5,8)',
  )
  assert.equal(
    applyIntensityFromBase('s("hh").euclid(3,8,1)', 'hihats', 2),
    's("hh").euclid(5,8,1)',
  )

  const drums = 's("bd ~ sd ~ hh ~ oh ~").bank("RolandTR909")'
  assert.equal(applyIntensityFromBase(drums, 'drums', 1), drums)
  const l2 = applyIntensityFromBase(drums, 'drums', 2)
  assert.ok(!l2.includes('bd bd') && !l2.includes('sd sd'), `L2 kick/snare not doubled: ${l2}`)
  assert.ok(/hh/.test(l2) && !/hh ~/.test(l2.replace(/oh[^"]*/, '')), `L2 hats filled: ${l2}`)
  // lookahead may yield bd hh sd hh hh hh oh oh
  assert.ok(l2.includes('hh'), `L2 has hats: ${l2}`)
  assert.ok(!/\.gain\(/.test(l2) && !/\.room\(/.test(l2), `L2 no mush FX: ${l2}`)
  const l3 = applyIntensityFromBase(drums, 'drums', 3)
  assert.equal(l3, l2, 'L3 spawn is jam-actions, not pattern')
  assert.deepEqual(doubleImmediate(['bd', '~', '~', '~'], isKickish), ['bd', '~', 'bd', '~'])
  assert.deepEqual(doubleImmediate(['~', 'sd', '~', '~'], isSnareish), ['~', 'sd', '~', 'sd'])
  assert.equal(applyIntensityFromBase('s("bd*2")', 'drums', 4), 's("bd*4")')
  assert.equal(applyIntensityFromBase('s("bd*4")', 'drums', 4), 's("bd*8")')

  const sparseKicks = 's("bd ~ ~ ~")'
  assert.equal(applyIntensityFromBase(sparseKicks, 'drums', 4), 's("bd ~ bd ~")')
  assert.equal(applyIntensityFromBase('s("bd ~ ~ ~ bd ~ ~ ~")', 'drums', 4), 's("bd ~ bd ~ bd ~ bd ~")')

  // L4 snare-family densifies rim/rs/clap like sd
  assert.equal(applyIntensityFromBase('s("rim ~ ~ ~")', 'drums', 4), 's("rim ~ rim ~")')
  assert.equal(applyIntensityFromBase('s("~ rim ~ ~")', 'drums', 4), 's("~ rim ~ rim")')
  assert.equal(applyIntensityFromBase('s("cp ~ ~ ~")', 'drums', 4), 's("cp ~ cp ~")')
  assert.ok(isSnareish('rim') && isSnareish('rs') && isSnareish('rimshot') && isSnareish('cp') && isSnareish('clap'))
  // L2 hat-fill must not treat rim as a hat
  assert.equal(applyIntensityFromBase('s("rim ~ ~ ~")', 'drums', 2), 's("rim ~ ~ ~")')

  const l4 = applyIntensityFromBase(drums, 'drums', 4)
  assert.ok(/hh/.test(l4), `L4 hats stay dense: ${l4}`)

  const perc = 's("~ sd ~ ~")'
  assert.equal(applyIntensityFromBase(perc, 'fx', 2), perc)
  assert.equal(applyIntensityFromBase(perc, 'fx', 4), 's("~ sd ~ sd")')

  const keysLine = 'note("c3 ~ g3 ~").sound("piano")'
  assert.equal(applyIntensityFromBase(keysLine, 'lead', 4), keysLine, 'plain lead is not keys')
  const keys4 = applyIntensityFromBase(keysLine, 'lead', 4, { keys: true })
  assert.ok(keys4.includes('c3') && keys4.includes('g3'), `L4 keys keep cores: ${keys4}`)
  assert.ok(/@0\.5/.test(keys4), `L4 keys walk @0.5: ${keys4}`)
  assert.ok(!keys4.includes('~'), `L4 keys no rests: ${keys4}`)

  const bass = 'note("c2 ~ g2 ~").sound("sawtooth")'
  assert.equal(applyIntensityFromBase(bass, 'bass', 2), bass)
  const bass4 = applyIntensityFromBase(bass, 'bass', 4)
  assert.ok(bass4.includes('c2') && bass4.includes('g2'), `L4 bass keeps cores: ${bass4}`)
  assert.ok(/@0\.5/.test(bass4), `L4 bass walks @0.5: ${bass4}`)
  assert.ok(!bass4.includes('~'), `L4 bass no rests: ${bass4}`)
  // cores in order: c2 before g2, and not same-pitch double fill
  const bassBody = bass4.match(/note\("([^"]+)"\)/)?.[1] ?? ''
  const bassToks = bassBody.split(/\s+/)
  assert.ok(bassToks[0] === 'c2', `first core c2: ${bassBody}`)
  assert.ok(bassToks.includes('g2'), `has g2: ${bassBody}`)
  assert.ok(bassToks.indexOf('c2') < bassToks.indexOf('g2'), `order c2…g2: ${bassBody}`)
  assert.ok(!bassBody.includes('c2 c2') && !bassBody.includes('g2 g2'), `not same-pitch fill: ${bassBody}`)

  const bassSparse = 'note("c2 ~ ~ ~").sound("sawtooth")'
  const bassSparse4 = applyIntensityFromBase(bassSparse, 'bass', 4)
  assert.ok(!bassSparse4.includes('~'), `L4 bass sparse no rests: ${bassSparse4}`)
  assert.ok(/c2/.test(bassSparse4) && /@0\.5/.test(bassSparse4), `L4 walk fills: ${bassSparse4}`)

  const bassDense = 'note("c2 eb2 g2").sound("sawtooth")'
  const bassDense4 = applyIntensityFromBase(bassDense, 'bass', 4)
  assert.ok(/c2/.test(bassDense4) && /eb2/.test(bassDense4) && /g2/.test(bassDense4), bassDense4)
  assert.ok(/@0\.5/.test(bassDense4), `dense bass inserts walks: ${bassDense4}`)
  const denseBody = bassDense4.match(/note\("([^"]+)"\)/)?.[1] ?? ''
  const dToks = denseBody.split(/\s+/)
  assert.equal(dToks.filter((x) => x === 'c2' || x === 'eb2' || x === 'g2').join(' '), 'c2 eb2 g2')

  const pad = 'note("c3 eb3 g3").sound("triangle").gain(0.6)'
  assert.equal(applyIntensityFromBase(pad, 'pad', 4), pad)

  // L4-on-L3/L2 layer: densify without re-running hats/euclid
  assert.equal(applyIntensityL4Layer('s("hh hh hh hh")', 'hihats'), 's("hh hh hh hh")')
  assert.equal(applyIntensityFromBase('s("hh hh hh hh")', 'hihats', 4, { from: 2 }), 's("hh hh hh hh")')
  assert.equal(applyIntensityFromBase('s("~ hh ~ hh")', 'hihats', 3, { from: 2 }), 's("~ hh ~ hh")', 'from:2 level 3 is no-op')
  const drumsL2 = 's("bd ~ sd ~ hh hh oh oh")'
  const drumsL4layer = applyIntensityL4Layer(drumsL2, 'drums')
  assert.ok(/bd/.test(drumsL4layer) && /sd/.test(drumsL4layer), drumsL4layer)
  assert.ok(!drumsL4layer.includes('hh hh hh'), `must not hat-fill: ${drumsL4layer}`)
  // kick/snare doubled via doubleImmediate from L2 base
  assert.equal(applyIntensityL4Layer('s("bd ~ ~ ~")', 'drums'), 's("bd ~ bd ~")')
  assert.equal(applyIntensityL4Layer('s("rim ~ ~ ~")', 'drums'), 's("rim ~ rim ~")')
  assert.equal(applyIntensityL4Layer('s("~ sd ~ ~")', 'fx'), 's("~ sd ~ sd")')
  const bassL2 = 'note("c2 ~ g2 ~").sound("sawtooth")'
  const bassL4l = applyIntensityL4Layer(bassL2, 'bass')
  assert.ok(/@0\.5/.test(bassL4l), `L4 layer bass walk: ${bassL4l}`)
  assert.equal(applyIntensityFromBase(bassL2, 'bass', 4, { from: 3 }), bassL4l)

  console.log('  intensity: 1 as-is · 2 hats fill/bump · 3 same · 4 double bd+sd (not every step) + perc snares; bass walk @0.5')
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
  assert.equal(intensitySpawnRole({ hasPad: false, hasArp: false, hasKeys: false }), 'pad')
  assert.equal(intensitySpawnRole({ hasPad: true, hasArp: false, hasKeys: false }), 'arp')
  assert.equal(intensitySpawnRole({ hasPad: true, hasArp: true, hasKeys: false }), 'lead')
  assert.equal(intensitySpawnRole({ hasPad: true, hasArp: true, hasKeys: true }), 'fx')
  assert.equal(isKeysTrack({ name: 'Keys' }), true)
  assert.equal(isKeysTrack({ name: 'Lead' }), false)
  assert.equal(isKeysTrack({ name: 'Piano' }), true)
  assert.equal(shouldSpawnIntensityLane(3, false), true)
  assert.equal(shouldSpawnIntensityLane(3, true), false)
  assert.equal(shouldDropSpawnedPad(2), true)
  assert.equal(shouldDropSpawnedPad(3), false)
  assert.equal(intensityLevelsShareSpawn(3, 4), true)
  assert.equal(intensityLevelsShareSpawn(4, 3), true)
  assert.equal(intensityLevelsShareSpawn(2, 3), false)
  assert.equal(intensityLevelsShareSpawn(3, 2), false)
  assert.equal(intensityLevelsShareSpawn(1, 4), false)
  console.log('  intensity levels: 1–4; 3 pad → arp → keys → fx; L3↔L4 share spawn')
}

console.log('ALL MUTATE CHECKS PASSED')
