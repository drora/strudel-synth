/**
 * Song-seed walk smoke (PR A).
 * Run: npx --yes tsx src/engine/song-seed-smoke.test.ts
 * Or:  npm run test:song-seed
 */
import assert from 'node:assert/strict'
import {
  rollSeed,
  retargetSeed,
  isLegalWalk,
  NEIGHBORS,
  WALK_PATTERNS,
  centerTriadNotes,
  centerMelodyNotes,
  type SongSeed,
  type WalkCenter,
} from './song-seed'
import { generateKitTracks, getKit, KITS } from './kits'
import type { ScaleKind } from './kits-types'

console.log('=== Song seed smoke ===')

function notePcs(code: string): string[] {
  const out: string[] = []
  const re = /([a-g](?:#|b)?)(-?\d+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) out.push(m[1]!.toLowerCase())
  return out
}

function centerPcs(seed: SongSeed): Set<string> {
  const pcs = new Set<string>()
  for (const c of seed.walk) {
    for (const n of centerMelodyNotes(seed.root, seed.scale, c, 3)) {
      const m = n.toLowerCase().match(/^([a-g](?:#|b)?)/)
      if (m) pcs.add(m[1]!)
    }
    for (const n of centerTriadNotes(seed.root, c, 3)) {
      const m = n.toLowerCase().match(/^([a-g](?:#|b)?)/)
      if (m) pcs.add(m[1]!)
    }
  }
  return pcs
}

// rollSeed walk degrees ∈ neighbor list
for (const scale of Object.keys(WALK_PATTERNS) as ScaleKind[]) {
  for (let i = 0; i < 40; i++) {
    const seed = rollSeed({ root: 'c', scale })
    assert.ok(isLegalWalk(scale, seed.walk), `${scale} illegal walk ${seed.patternId}`)
    const allowedDegs = new Set(NEIGHBORS[scale].map((n) => n.degree))
    for (const c of seed.walk) {
      assert.ok(allowedDegs.has(c.degree), `${scale} degree ${c.degree}`)
    }
  }
}
console.log('  rollSeed degrees ∈ neighbors: ok')

// minor cadence-V only last, only on patterns that include it
{
  let sawCadence = false
  for (let i = 0; i < 80; i++) {
    const seed = rollSeed({ root: 'c', scale: 'minor' })
    const majVIdx = seed.walk.findIndex((c) => c.quality === 'maj' && c.degree === 7)
    if (majVIdx >= 0) {
      sawCadence = true
      assert.equal(majVIdx, seed.walk.length - 1, `V not last in ${seed.patternId}`)
      assert.ok(
        seed.patternId.includes('V') || seed.patternId.includes('cadence'),
        `unexpected V pattern ${seed.patternId}`,
      )
    }
  }
  // Force-check known cadence patterns
  const cadence = WALK_PATTERNS.minor.filter((p) =>
    p.centers.some((c) => c.quality === 'maj' && c.degree === 7),
  )
  assert.ok(cadence.length >= 1)
  for (const p of cadence) {
    const last = p.centers[p.centers.length - 1]!
    assert.equal(last.degree, 7)
    assert.equal(last.quality, 'maj')
    for (let i = 0; i < p.centers.length - 1; i++) {
      const c = p.centers[i]!
      assert.ok(!(c.quality === 'maj' && c.degree === 7))
    }
  }
  // dorian/pentatonic never get maj V
  for (let i = 0; i < 30; i++) {
    for (const scale of ['dorian', 'pentatonic'] as ScaleKind[]) {
      const seed = rollSeed({ root: 'c', scale })
      assert.ok(!seed.walk.some((c) => c.quality === 'maj' && c.degree === 7))
    }
  }
  console.log(`  minor cadence-V last-only (saw=${sawCadence}): ok`)
}

// two rollSeeds can differ
{
  const a = new Set<string>()
  for (let i = 0; i < 30; i++) {
    const s = rollSeed({ root: 'c', scale: 'minor' })
    a.add(`${s.patternId}|${JSON.stringify(s.walk)}`)
  }
  assert.ok(a.size >= 2, `expected variety, got ${a.size}`)
  console.log(`  rollSeed variety: ${a.size} distinct`)
}

// retargetSeed C→F keeps degrees
{
  const seed = rollSeed({ root: 'c', scale: 'minor' })
  // force a known walk
  const fixed: SongSeed = {
    root: 'c',
    scale: 'minor',
    patternId: 'i_iv_v_i',
    walk: [
      { degree: 0, quality: 'min' },
      { degree: 5, quality: 'min' },
      { degree: 7, quality: 'min' },
      { degree: 0, quality: 'min' },
    ],
  }
  const retargeted = retargetSeed(fixed, 'f', 'minor')
  assert.equal(retargeted.root, 'f')
  assert.equal(retargeted.scale, 'minor')
  assert.deepEqual(
    retargeted.walk.map((c) => c.degree),
    fixed.walk.map((c) => c.degree),
  )
  console.log('  retargetSeed C→F keeps degrees: ok')
}

// generateKitTracks pad/bass/lead notes from FIXED seed centers
{
  const kit = KITS.find((k) => k.tracks.some((t) => t.role === 'pad')) ?? KITS[0]!
  const fixed: SongSeed = {
    root: 'c',
    scale: 'minor',
    patternId: 'i_bVI_bIII_v',
    walk: [
      { degree: 0, quality: 'min' },
      { degree: 8, quality: 'maj' },
      { degree: 3, quality: 'maj' },
      { degree: 7, quality: 'min' },
    ],
  }
  const allowed = centerPcs(fixed)
  // Allow leading-tone only if some center were maj V — not in this walk
  const tracks = generateKitTracks(kit, fixed)
  for (const role of ['pad', 'bass', 'lead'] as const) {
    const t = tracks.find((x) => x.role === role)
    if (!t) continue
    const pcs = notePcs(t.code)
    assert.ok(pcs.length > 0, `${role} has notes`)
    for (const pc of pcs) {
      assert.ok(
        allowed.has(pc),
        `${role} note ${pc} not in seed centers; code=${t.code}; allowed=${[...allowed]}`,
      )
    }
  }
  console.log(`  generateKitTracks fixed seed (${kit.id}): ok`)
}

// Example minor walk encoded
{
  const ex = WALK_PATTERNS.minor.find((p) => p.id === 'i_bVI_bIII_V')!
  assert.deepEqual(
    ex.centers.map((c: WalkCenter) => `${c.degree}${c.quality}`),
    ['0min', '8maj', '3maj', '7maj'],
  )
  console.log('  example minor walk i→bVI→bIII→V: ok')
}

console.log('ALL SONG-SEED CHECKS PASSED')
