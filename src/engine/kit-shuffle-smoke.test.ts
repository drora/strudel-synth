/**
 * Tiny smoke: kit shuffle profiles (no baked recipes; regenerate variety).
 * Run: npx --yes tsx src/engine/kit-shuffle-smoke.test.ts
 * Or:  npm run test:kit-shuffle
 */
import assert from 'node:assert/strict'
import {
  KITS,
  getKit,
  kitToTemplate,
  generateKitTracks,
  resolveShuffleProfile,
} from './kits'
import { reshuffleTrack, resolveDrumVoice } from './reshuffle'
import { getBankFromCode as getBank } from './code-effects'

const DRUM_ROLES = new Set(['drums', 'hihats', 'fx'])

console.log(`=== Kit shuffle smoke ===`)
console.log(`kit count: ${KITS.length}`)

// Structure: shuffle + tracks layout, no baked code, drumsBank present
for (const kit of KITS) {
  assert.ok(kit.shuffle?.groove && kit.shuffle?.density, `${kit.id}: shuffle`)
  assert.ok(Array.isArray(kit.tracks) && kit.tracks.length > 0, `${kit.id}: tracks`)
  for (const t of kit.tracks) {
    assert.ok(!('code' in t && (t as { code?: unknown }).code != null), `${kit.id}: no baked code`)
    assert.ok(t.name && t.role, `${kit.id}: name/role`)
  }
  assert.ok(kit.drumsBank, `${kit.id}: drumsBank`)
  const resolved = resolveShuffleProfile(kit)
  assert.ok(resolved.groove && resolved.density)
}

// Regenerate variety: collision rate of identical-all-tracks pairs < 30%
const TRIALS = 20
let identical = 0
let total = 0
for (const kit of KITS) {
  for (let i = 0; i < TRIALS; i++) {
    const a = kitToTemplate(kit)
    const b = kitToTemplate(kit)
    total++
    assert.equal(a.tracks.length, kit.tracks.length)
    assert.ok(a.tracks.every((t) => t.code.length > 0))
    if (a.tracks.every((t, j) => t.code === b.tracks[j]!.code)) identical++
  }
}
const rate = identical / total
console.log(`regenerate pairs: ${total}, identical-all: ${identical} (${(rate * 100).toFixed(1)}%)`)
assert.ok(rate < 0.3, `collision rate ${rate} >= 30%`)

// drumsBank consistency on bank-voice kits
let bankFail = 0
for (const kit of KITS) {
  const voice = resolveDrumVoice(kit.drumsBank)
  for (let i = 0; i < 3; i++) {
    const tracks = generateKitTracks(kit)
    if (voice === 'bank') {
      for (const t of tracks) {
        if (!DRUM_ROLES.has(t.role)) continue
        if (getBank(t.code) !== kit.drumsBank) bankFail++
      }
    }
  }
}
console.log(`drumsBank mismatches: ${bankFail}`)
assert.equal(bankFail, 0)

// Techno four_on_floor vs lofi character differ
const tKit = KITS.find((k) => k.vibe === 'techno' && k.shuffle.groove === 'four_on_floor')!
const lKit = KITS.find((k) => k.vibe === 'lofi')!
assert.ok(tKit && lKit)
const tProf = resolveShuffleProfile(tKit)
const lProf = resolveShuffleProfile(lKit)
console.log(`techno ${tKit.id} groove=${tProf.groove} bank=${tKit.drumsBank}`)
console.log(`lofi   ${lKit.id} groove=${lProf.groove} bank=${lKit.drumsBank}`)
assert.ok(tProf.groove !== lProf.groove || tKit.drumsBank !== lKit.drumsBank)

// reshuffleTrack returns non-empty string; getKit roundtrip
{
  const tracks = generateKitTracks(KITS[0]!)
  const drum = tracks.find((t) => t.role === 'drums')!
  const next = reshuffleTrack('drums', drum.code, {
    bank: KITS[0]!.drumsBank,
    shuffle: KITS[0]!.shuffle,
    vibe: KITS[0]!.vibe,
    lockKit: true,
  })
  assert.equal(typeof next, 'string')
  assert.ok(next.length > 0)
}
assert.equal(getKit(KITS[0]!.id)?.id, KITS[0]!.id)

console.log('ALL CHECKS PASSED')
