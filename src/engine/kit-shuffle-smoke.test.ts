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
import {
  getBankFromCode as getBank,
  getNFromCode,
  getSoundFromCode,
  primarySSample,
} from './code-effects'

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

/** Classify lead note-pattern shape features (not the exact notes). */
function leadShapeKey(code: string): string {
  const m =
    code.match(/\.note\((["'`])([\s\S]*?)\1\)/) ||
    code.match(/note\((["'`])([\s\S]*?)\1\)/)
  const pat = (m?.[2] ?? '').trim()
  const hasRest = pat.includes('~')
  const hasAngle = /</.test(pat)
  const mul =
    /\*3\b/.test(pat) ? '*3'
    : /\*4\b/.test(pat) ? '*4'
    : /\*1\b/.test(pat) ? '*1'
    : /\*0\.5\b/.test(pat) ? '*0.5'
    : /\*2\b/.test(pat) ? '*2'
    : 'nomul'
  return [hasRest ? '~' : 'norest', hasAngle ? '<>' : 'flat', mul].join('|')
}

// Lead pattern families: 30 regenerations → >2 distinct shapes (seed walk; *2 max)
{
  const kit = KITS.find((k) => k.tracks.some((t) => t.role === 'lead')) ?? KITS[0]!
  const shapes = new Set<string>()
  const samples: string[] = []
  for (const density of ['low', 'mid', 'high'] as const) {
    for (let i = 0; i < 10; i++) {
      const code = reshuffleTrack('lead', 'note("c4").sound("sawtooth")', {
        shuffle: { ...kit.shuffle, density, root: kit.shuffle.root ?? 'c', scale: kit.shuffle.scale ?? 'minor' },
        lockKit: true,
      })
      const key = leadShapeKey(code)
      shapes.add(key)
      if (samples.length < 8) samples.push(`${key} :: ${code.slice(0, 72)}`)
    }
  }
  console.log(`lead shapes (${shapes.size}): ${[...shapes].join(' · ')}`)
  for (const s of samples) console.log(`  ${s}`)
  // Seed-based leads: held / motif / rests / *2 — no *3/*4 machine-gun required.
  assert.ok(shapes.size > 2, `expected >2 lead shapes, got ${shapes.size}: ${[...shapes]}`)
}


// Shuffle pins Sound identity (bank/n, primary sample, synth) — rhythm/notes may change
{
  const tablaCur = 's("tabla:3 ~ tabla:1 ~").gain(1)'
  for (let i = 0; i < 8; i++) {
    const next = reshuffleTrack('drums', tablaCur, {
      bank: 'dirt-tabla',
      shuffle: { groove: 'sparse', density: 'mid' },
      lockKit: true,
    })
    assert.equal(primarySSample(next), 'tabla:3', `tabla primary pin; got ${next}`)
    assert.ok(!getBank(next), `tabla should not gain .bank(); got ${next}`)
  }

  // Recorded / one-shot sample on a melodic role: keep s(), never note()+synth
  {
    const mic = 's("jam_mic_1")'
    for (const density of ['low', 'mid', 'high'] as const) {
      const next = reshuffleTrack('vox', mic, {
        shuffle: { groove: 'sparse', density, melodicSounds: ['sawtooth'] },
      })
      assert.ok(/^\s*s\(/.test(next), `mic stays s(); got ${next}`)
      assert.ok(next.includes('jam_mic_1'), `mic sample pinned; got ${next}`)
      assert.ok(!/\bnote\(/.test(next), `mic must not become note(); got ${next}`)
      assert.ok(!/\.sound\(/.test(next), `mic must not become .sound(); got ${next}`)
    }
  }

  const bankCur = 's("bd sd hh cp").bank("RolandTR909").n(1).gain(1.05)'
  for (let i = 0; i < 8; i++) {
    const next = reshuffleTrack('drums', bankCur, {
      bank: 'RolandTR909',
      shuffle: { groove: 'four_on_floor', density: 'mid' },
      lockKit: true,
    })
    assert.equal(getBank(next), 'RolandTR909', `bank pin; got ${next}`)
    assert.equal(getNFromCode(next), 1, `n pin; got ${next}`)
  }

  const melCur = 'note("<c3 eb3 g3>").sound("triangle").lpf(800).gain(0.5)'
  for (let i = 0; i < 8; i++) {
    const next = reshuffleTrack('bass', melCur, {
      shuffle: {
        groove: 'four_on_floor',
        density: 'mid',
        root: 'c',
        scale: 'minor',
        melodicSounds: ['sawtooth', 'square', 'triangle', 'sine'],
      },
      lockKit: true,
    })
    assert.equal(getSoundFromCode(next), 'triangle', `synth pin; got ${next}`)
    // Melody/rhythm may change — just ensure we still have a note/s pattern head
    assert.ok(/note\(|s\(/.test(next), `melodic pattern present; got ${next}`)
  }

  // Empty prior → no pin crash; still returns code
  const fresh = reshuffleTrack('drums', '', {
    bank: 'RolandTR909',
    shuffle: { groove: 'four_on_floor', density: 'mid' },
    lockKit: true,
  })
  assert.ok(fresh.length > 0)
  console.log('shuffle pin sound/bank/n/synth: ok')
}

console.log('ALL CHECKS PASSED')
