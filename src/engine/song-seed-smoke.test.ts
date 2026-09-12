/**
 * Song-seed walk smoke (PR A).
 * Run: npx --yes tsx src/engine/song-seed-smoke.test.ts
 * Or:  npm run test:song-seed
 */
import assert from 'node:assert/strict'
import {
  rollSeed,
  retargetSeed,
  hydrateSeed,
  isLegalWalk,
  NEIGHBORS,
  WALK_PATTERNS,
  centerTriadNotes,
  centerMelodyNotes,
  buildMixCard,
  randomSongRoot,
  walkConcertNames,
  type SongSeed,
  type WalkCenter,
  type MixCard,
} from './song-seed'
import { generateKitTracks, KITS } from './kits'
import { generateDrumRole } from './reshuffle-drums'
import { reshuffleTrack } from './reshuffle'
import { rewriteSPatternSample } from './code-effects'
import { ROLE_PRESETS } from './presets'
import type { ScaleKind } from './kits-types'
import { SONG_ROOTS, SONG_SCALES } from './note-harmony'

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
    for (const scale of ['dorian', 'pentatonic', 'phrygian'] as ScaleKind[]) {
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

// PR B: seed carries kick clock + budget + mix
{
  const seed = rollSeed({
    root: 'c',
    scale: 'minor',
    density: 'mid',
    groove: 'four_on_floor',
    fxBias: 'roomy',
  })
  assert.ok(seed.kickClock && seed.kickClock.length > 0, 'kickClock')
  assert.ok(seed.budget && seed.budget.drums, 'budget')
  assert.ok(seed.mix, 'mix')
  assert.equal(seed.mix!.bassLpf, 360)
  assert.equal(seed.mix!.kickLpf, 900)
  const kit = KITS.find((k) => k.drumsBank === 'RolandTR909' && k.tracks.some((t) => t.role === 'bass')) ?? KITS[0]!
  const tracks = generateKitTracks(kit, seed)
  const bass = tracks.find((x) => x.role === 'bass')
  if (bass) {
    assert.ok(/lpf\(360\)/.test(bass.code), `bass mix lpf; got ${bass.code}`)
    assert.ok(/\.gain\(/.test(bass.code), `bass mix gain; got ${bass.code}`)
  }
  const hats = tracks.find((x) => x.role === 'hihats')
  if (hats) {
    assert.ok(/\.gain\(/.test(hats.code), `hats mix gain; got ${hats.code}`)
  }
  console.log('  rollSeed clock+mix: ok')
}

// hydrate old persisted seeds
{
  const old: SongSeed = {
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
  const h = hydrateSeed(old, { density: 'mid', groove: 'four_on_floor', fxBias: 'dry' })
  assert.ok(h.kickClock)
  assert.ok(h.budget)
  assert.ok(h.mix)
  assert.equal(h.mix!.bassLpf, 360)
  console.log('  hydrateSeed fills clock/mix: ok')
}

// amen hats use amen voice, not leftover hh
{
  const seed = rollSeed({
    root: 'c',
    scale: 'minor',
    groove: 'breakbeat',
    density: 'mid',
    fxBias: 'dry',
  })
  const hats = generateDrumRole('hihats', 'breakbeat', 'mid', 'dirt-amen', 'dry', undefined, seed)
  assert.ok(/amencutup/.test(hats), `amen hats voice; got ${hats}`)
  assert.ok(!/\bhh\b/.test(hats), `amen hats leftover hh; got ${hats}`)
  const br = generateDrumRole('hihats', 'breakbeat', 'mid', 'clean-breaks', 'dry', undefined, seed)
  assert.ok(/breaks/.test(br), `breaks hats voice; got ${br}`)
  assert.ok(!/\bhh\b/.test(br), `breaks leftover hh; got ${br}`)
  console.log('  amen/breaks hats voice: ok')
}

// pin only primary hit
{
  const out = rewriteSPatternSample('s("bd ~ sd cp")', 'tabla:3')
  assert.equal(out, 's("tabla:3 ~ sd cp")')
  const rests = rewriteSPatternSample('s("~ bd sd")', 'cp')
  assert.equal(rests, 's("~ cp sd")')
  console.log('  rewriteSPatternSample primary-only: ok')
}


// PR D: new scales appear; walks legal; old scales still legal
{
  const expected = [
    'minor', 'major', 'dorian', 'pentatonic',
    'mixolydian', 'phrygian', 'lydian', 'harmonic_minor',
  ]
  assert.deepEqual([...SONG_SCALES], expected)
  for (const scale of expected as ScaleKind[]) {
    assert.ok(WALK_PATTERNS[scale]?.length >= 3, `${scale} walks`)
    assert.ok(NEIGHBORS[scale]?.length >= 3, `${scale} neighbors`)
    for (let i = 0; i < 30; i++) {
      const seed = rollSeed({ root: 'c', scale })
      assert.ok(isLegalWalk(scale, seed.walk), `${scale} ${seed.patternId}`)
    }
  }
  // Walk ids locked for new scales
  assert.deepEqual(
    WALK_PATTERNS.mixolydian.map((p) => p.id),
    ['I_bVII_I', 'I_IV_bVII_I', 'I_bVII_IV_I'],
  )
  assert.deepEqual(
    WALK_PATTERNS.phrygian.map((p) => p.id),
    ['i_bII_i', 'i_bVII_i', 'i_bII_bVII_i'],
  )
  assert.deepEqual(
    WALK_PATTERNS.lydian.map((p) => p.id),
    ['I_II_I', 'I_V_I', 'I_II_V_I'],
  )
  assert.deepEqual(
    WALK_PATTERNS.harmonic_minor.map((p) => p.id),
    ['i_V_i', 'i_iv_V_i', 'i_bVI_V_i'],
  )
  console.log('  PR D scales + walk ids: ok')
}

// PR D: harmonic_minor maj V allowed not-only-last
{
  const midV: WalkCenter[] = [
    { degree: 0, quality: 'min' },
    { degree: 7, quality: 'maj' },
    { degree: 0, quality: 'min' },
  ]
  assert.ok(isLegalWalk('harmonic_minor', midV), 'harmonic_minor V mid')
  assert.ok(!isLegalWalk('minor', midV), 'natural minor V mid illegal')
  let sawNonLast = false
  for (let i = 0; i < 60; i++) {
    const seed = rollSeed({ root: 'c', scale: 'harmonic_minor' })
    const idx = seed.walk.findIndex((c) => c.quality === 'maj' && c.degree === 7)
    if (idx >= 0 && idx !== seed.walk.length - 1) sawNonLast = true
    assert.ok(isLegalWalk('harmonic_minor', seed.walk), seed.patternId)
  }
  // i_V_i has V in the middle
  const pat = WALK_PATTERNS.harmonic_minor.find((p) => p.id === 'i_V_i')!
  assert.equal(pat.centers[1]!.degree, 7)
  assert.equal(pat.centers[1]!.quality, 'maj')
  assert.ok(isLegalWalk('harmonic_minor', pat.centers))
  console.log(`  harmonic_minor V anywhere (sawNonLast=${sawNonLast}): ok`)
}

// PR D: mix feel emits .swing( / .euclid( / .duck( on expected roles
{
  const baseMix = (): MixCard => ({
    ...buildMixCard('dry', 'four_on_floor', 'mid'),
    swing: false,
    swingArp: false,
    euclid: false,
    duck: false,
  })

  const kit =
    KITS.find((k) => k.drumsBank === 'RolandTR909' && k.tracks.some((t) => t.role === 'bass')) ??
    KITS[0]!

  // swing on hats
  {
    const seed = rollSeed({ root: 'c', scale: 'minor', groove: 'halftime', density: 'mid' })
    seed.mix = { ...baseMix(), swing: 8, swingArp: false, room: { hihats: 0.35 }, kickLpf: 900 }
    const hats = generateDrumRole('hihats', 'halftime', 'mid', kit.drumsBank, 'roomy', undefined, seed)
    assert.ok(/\.swing\(8\)/.test(hats), `swing hats; got ${hats}`)
  }
  // euclid on hats
  {
    const seed = rollSeed({ root: 'c', scale: 'minor', groove: 'four_on_floor', density: 'mid' })
    seed.mix = {
      ...baseMix(),
      euclid: [3, 8],
      euclidRole: 'hihats',
    }
    const hats = generateDrumRole('hihats', 'four_on_floor', 'mid', kit.drumsBank, 'dry', undefined, seed)
    assert.ok(/\.euclid\(3,8\)/.test(hats), `euclid hats; got ${hats}`)
  }
  // duck on drums + orbit on bass
  {
    const seed = rollSeed({
      root: 'c',
      scale: 'minor',
      groove: 'four_on_floor',
      density: 'mid',
      fxBias: 'dry',
    })
    seed.mix = { ...baseMix(), duck: true }
    const drums = generateDrumRole('drums', 'four_on_floor', 'mid', kit.drumsBank, 'dry', undefined, seed)
    assert.ok(/\.duck\(2\)/.test(drums), `duck drums; got ${drums}`)
    const tracks = generateKitTracks(kit, seed)
    const bass = tracks.find((t) => t.role === 'bass')
    assert.ok(bass && /\.orbit\(2\)/.test(bass.code), `bass orbit; got ${bass?.code}`)
  }
  // euclid on arp via generateKitTracks
  {
    const seed = rollSeed({ root: 'c', scale: 'dorian', groove: 'four_on_floor', density: 'mid' })
    seed.mix = { ...baseMix(), euclid: [5, 8], euclidRole: 'arp' }
    const kitArp = KITS.find((k) => k.tracks.some((t) => t.role === 'arp')) ?? kit
    const tracks = generateKitTracks(kitArp, seed)
    const arp = tracks.find((t) => t.role === 'arp')
    if (arp) {
      assert.ok(/\.euclid\(5,8\)/.test(arp.code), `euclid arp; got ${arp.code}`)
    }
  }
  console.log('  PR D mix feel swing/euclid/duck: ok')
}

// PR D: applyKit first-paint root is randomSongRoot() from SONG_ROOTS
// (freshStartJam empty + !hasPickedKit → applyKit(..., { randomizeRoot: true })).
// Picker / hasPickedKit reload keep jam.songRoot — see jam-actions-a applyKit.
{
  assert.ok(SONG_ROOTS.includes('f'))
  assert.ok(SONG_ROOTS.length >= 12)
  const seen = new Set<string>()
  for (let i = 0; i < 60; i++) {
    const r = randomSongRoot()
    assert.ok((SONG_ROOTS as readonly string[]).includes(r), `root ${r}`)
    seen.add(r)
  }
  assert.ok(seen.size >= 2, `randomSongRoot variety ${seen.size}`)
  console.log(`  applyKit root pool randomSongRoot (${seen.size} of ${SONG_ROOTS.length}): ok`)
}

// PR D: + Track / addJamTrack generate follows current seed (not ROLE_PRESETS C-minor)
{
  const seed: SongSeed = {
    root: 'f',
    scale: 'mixolydian',
    patternId: 'I_bVII_I',
    walk: [
      { degree: 0, quality: 'maj' },
      { degree: 10, quality: 'maj' },
      { degree: 0, quality: 'maj' },
    ],
  }
  const lead = reshuffleTrack('lead', '', {
    seed,
    shuffle: {
      groove: 'four_on_floor',
      density: 'mid',
      root: 'f',
      scale: 'mixolydian',
    },
  })
  const preset = ROLE_PRESETS.lead.defaultCode
  assert.notEqual(lead, preset, `lead still preset: ${lead}`)
  assert.ok(!lead.includes('c4 eb4 g4 bb4'), `lead still C-minor preset phrase: ${lead}`)
  const pcs = notePcs(lead)
  assert.ok(pcs.length > 0, `lead has notes: ${lead}`)
  const allowed = centerPcs(seed)
  const walkTones = new Set(['f', 'a', 'c', 'eb', 'g', 'bb', 'd'])
  for (const pc of pcs) {
    assert.ok(allowed.has(pc), `lead note ${pc} not in seed; code=${lead}; allowed=${[...allowed]}`)
  }
  assert.ok(
    pcs.some((pc) => walkTones.has(pc)),
    `lead missing walk tones; code=${lead}`,
  )
  console.log(`  add-track lead on F mixolydian seed: ${lead}`)
}


// PR E: walk chips = concert names (not Roman numerals)
{
  const seed: SongSeed = {
    root: 'c',
    scale: 'minor',
    patternId: 'i_bVI_bIII_V',
    walk: [
      { degree: 0, quality: 'min' },
      { degree: 8, quality: 'maj' },
      { degree: 3, quality: 'maj' },
      { degree: 7, quality: 'maj' },
    ],
  }
  assert.deepEqual(walkConcertNames(seed), ['Cm', 'Ab', 'Eb', 'G'])
  const withMinV: SongSeed = {
    ...seed,
    patternId: 'i_bVI_bIII_v',
    walk: [
      { degree: 0, quality: 'min' },
      { degree: 8, quality: 'maj' },
      { degree: 3, quality: 'maj' },
      { degree: 7, quality: 'min' },
    ],
  }
  assert.deepEqual(walkConcertNames(withMinV), ['Cm', 'Ab', 'Eb', 'Gm'])
  const fMaj: SongSeed = {
    root: 'f',
    scale: 'major',
    patternId: 'I_V_vi_IV',
    walk: [
      { degree: 0, quality: 'maj' },
      { degree: 7, quality: 'maj' },
      { degree: 9, quality: 'min' },
      { degree: 5, quality: 'maj' },
    ],
  }
  assert.deepEqual(walkConcertNames(fMaj), ['F', 'C', 'Dm', 'Bb'])
  console.log('  PR E walkConcertNames chips: ok')
}

console.log('ALL SONG-SEED CHECKS PASSED')
