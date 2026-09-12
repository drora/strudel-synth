/**
 * Song seed: shared chord walk for a 4-bar jam.
 * Melodic lanes follow the walk. Kick clock + mix card drive drums/hats/fx (PR B).
 */
import type { Density, FxBias, GrooveFamily, ScaleKind, VibeId } from './kits-types'
import type { TrackRole } from './types'
import { NOTE_NAMES, SONG_ROOTS, SONG_SCALES, SCALE_DEGREES, rootIndex } from './note-harmony'
import { DRUM_POOLS } from './reshuffle-pools'

export type WalkCenter = {
  /** Semitones from song home (0, 3, 5, 7, 8, 10…). */
  degree: number
  quality: 'min' | 'maj'
}

export type MixCard = {
  gain: Partial<Record<TrackRole, number>>
  pan: Partial<Record<TrackRole, number>>
  room: Partial<Record<TrackRole, number>>
  delay: Partial<Record<TrackRole, number>>
  bassLpf: number
  kickLpf: number | null
  leadLpf: number | null
  /** Subdivision for Strudel `.swing(n)` (e.g. 4 / 8); false = off */
  swing?: number | false
  /** Also apply swing on arp when swing is set */
  swingArp?: boolean
  /** `.euclid(k, n)` pulses; false = off */
  euclid?: [number, number] | false
  /** Role that receives euclid (hats preferred) */
  euclidRole?: 'hihats' | 'arp'
  /** Sidechain bass from kick: drums `.duck(2)` + bass `.orbit(2)` */
  duck?: boolean
}

export type SongSeed = {
  root: string
  scale: ScaleKind
  walk: WalkCenter[]
  patternId: string
  /** Raw kick mini-notation (before voicing). Hats/fx fill around this. */
  kickClock?: string
  budget?: Partial<Record<TrackRole, Density>>
  mix?: MixCard
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function buildBudget(density: Density): Partial<Record<TrackRole, Density>> {
  if (density === 'high') {
    return { drums: 'mid', hihats: 'high', fx: 'mid', bass: 'mid', lead: 'low', pad: 'low', arp: 'mid' }
  }
  if (density === 'low') {
    return { drums: 'low', hihats: 'low', fx: 'low', bass: 'mid', lead: 'low', pad: 'low', arp: 'low' }
  }
  return { drums: 'mid', hihats: 'mid', fx: 'mid', bass: 'mid', lead: 'mid', pad: 'low', arp: 'mid' }
}

export function buildMixCard(
  bias: FxBias,
  groove: GrooveFamily = 'four_on_floor',
  density: Density = 'mid',
): MixCard {
  const gain: MixCard['gain'] = {
    drums: 1.0, hihats: 0.32, fx: 0.55, bass: 0.6, pad: 0.26, lead: 0.2, arp: 0.2, vox: 0.18,
  }
  const pan: MixCard['pan'] = {
    drums: 0, bass: 0, pad: 0, hihats: 0.15, fx: -0.12, lead: 0.18, arp: 0.1,
  }
  const room: MixCard['room'] = {}
  const delay: MixCard['delay'] = {}
  let kickLpf: number | null = null
  let leadLpf: number | null = null
  const bassLpf = 360
  if (bias === 'roomy') {
    room.pad = 0.55
    room.fx = 0.5
    room.hihats = 0.35
    kickLpf = 900
  } else if (bias === 'delay') {
    delay.lead = 0.22
    delay.arp = 0.18
  } else if (bias === 'filtered') {
    leadLpf = 1400
    kickLpf = 2000
  }

  // Feel / richer FX (existing Strudel methods only)
  const swingLike = groove === 'breakbeat' || groove === 'halftime'
  const fourSwing =
    groove === 'four_on_floor' && density !== 'low' && Math.random() < 1 / 3
  let swing: number | false = false
  let swingArp = false
  if (swingLike || fourSwing) {
    // Real Strudel `.swing(n)` takes a subdivision (not 0–1 amount).
    swing = pick([4, 8, 8])
    swingArp = Math.random() < 0.45
  }

  let euclid: [number, number] | false = false
  let euclidRole: 'hihats' | 'arp' | undefined
  if (Math.random() < 0.4 || bias === 'roomy') {
    euclid = pick([[3, 8], [5, 8], [3, 16]] as [number, number][])
    euclidRole = Math.random() < 0.7 ? 'hihats' : 'arp'
  }

  const duck = Math.random() < 0.45

  return {
    gain, pan, room, delay, bassLpf, kickLpf, leadLpf,
    swing, swingArp, euclid, euclidRole, duck,
  }
}

/** Fill missing feel fields on an older mix card without clobbering set values. */
function ensureMixFeel(
  mix: MixCard,
  groove: GrooveFamily,
  density: Density,
  bias: FxBias,
): MixCard {
  if (
    mix.swing !== undefined &&
    mix.euclid !== undefined &&
    mix.duck !== undefined
  ) {
    return mix
  }
  const rolled = buildMixCard(bias, groove, density)
  return {
    ...mix,
    swing: mix.swing !== undefined ? mix.swing : rolled.swing,
    swingArp: mix.swingArp !== undefined ? mix.swingArp : rolled.swingArp,
    euclid: mix.euclid !== undefined ? mix.euclid : rolled.euclid,
    euclidRole: mix.euclidRole !== undefined ? mix.euclidRole : rolled.euclidRole,
    duck: mix.duck !== undefined ? mix.duck : rolled.duck,
  }
}

export function hydrateSeed(
  seed: SongSeed,
  opts?: { density?: Density; groove?: GrooveFamily; fxBias?: FxBias },
): SongSeed {
  const density = opts?.density ?? 'mid'
  const groove = opts?.groove ?? 'four_on_floor'
  const fxBias = opts?.fxBias ?? 'dry'
  const mixReady =
    seed.mix &&
    seed.mix.swing !== undefined &&
    seed.mix.euclid !== undefined &&
    seed.mix.duck !== undefined
  if (seed.kickClock && seed.budget && mixReady) return seed
  const mix = seed.mix
    ? ensureMixFeel(seed.mix, groove, density, fxBias)
    : buildMixCard(fxBias, groove, density)
  return {
    ...seed,
    kickClock: seed.kickClock ?? pick(DRUM_POOLS[groove][density]),
    budget: seed.budget ?? buildBudget(density),
    mix,
  }
}

export function mixChain(role: TrackRole, mix?: MixCard | null): string {
  if (!mix) return ''
  let s = ''
  const g = mix.gain[role]
  if (g != null) s += `.gain(${g})`
  const p = mix.pan[role]
  if (p != null && p !== 0) s += `.pan(${p})`
  const r = mix.room[role]
  if (r != null) s += `.room(${r})`
  const d = mix.delay[role]
  if (d != null) s += `.delay(${d}).delaytime(0.125)`
  if (role === 'bass') s += `.lpf(${mix.bassLpf})`
  if (role === 'drums' && mix.kickLpf != null) s += `.lpf(${mix.kickLpf})`
  if ((role === 'lead' || role === 'pad') && mix.leadLpf != null) s += `.lpf(${mix.leadLpf})`

  // Richer feel FX (Strudel natives)
  if (role === 'drums' && mix.duck) s += `.duck(2).duckattack(0.12)`
  if (role === 'bass' && mix.duck) s += `.orbit(2)`
  if (role === 'hihats' && mix.swing) s += `.swing(${mix.swing})`
  if (role === 'arp' && mix.swing && mix.swingArp) s += `.swing(${mix.swing})`
  if (mix.euclid) {
    const [k, n] = mix.euclid
    const target = mix.euclidRole ?? 'hihats'
    if (role === target) s += `.euclid(${k},${n})`
  }
  return s
}

type WalkPattern = { id: string; centers: WalkCenter[] }

const I: WalkCenter = { degree: 0, quality: 'min' }
const Imaj: WalkCenter = { degree: 0, quality: 'maj' }
const bII: WalkCenter = { degree: 1, quality: 'maj' }
const ii: WalkCenter = { degree: 2, quality: 'min' }
const II: WalkCenter = { degree: 2, quality: 'maj' }
const bIII: WalkCenter = { degree: 3, quality: 'maj' }
const iv: WalkCenter = { degree: 5, quality: 'min' }
const IV: WalkCenter = { degree: 5, quality: 'maj' }
const v: WalkCenter = { degree: 7, quality: 'min' }
const V: WalkCenter = { degree: 7, quality: 'maj' }
const bVI: WalkCenter = { degree: 8, quality: 'maj' }
const vi: WalkCenter = { degree: 9, quality: 'min' }
const bVII: WalkCenter = { degree: 10, quality: 'maj' }

/** Neighbor lists (legal centers) per scale. */
export const NEIGHBORS: Record<ScaleKind, WalkCenter[]> = {
  minor: [I, iv, v, bIII, bVI, bVII, V],
  major: [Imaj, IV, V, vi, ii],
  dorian: [I, IV, v, bIII, bVII],
  pentatonic: [
    { degree: 0, quality: 'min' },
    { degree: 3, quality: 'maj' },
    { degree: 5, quality: 'min' },
    { degree: 7, quality: 'min' },
    { degree: 10, quality: 'maj' },
  ],
  mixolydian: [Imaj, IV, bVII, V, ii, v],
  phrygian: [I, bII, bVII, bIII, iv, bVI],
  lydian: [Imaj, II, V, vi],
  harmonic_minor: [I, V, iv, bVI, bIII],
}

/**
 * Walk patterns. Minor cadence V (maj @ 7) only as last center.
 * Harmonic minor treats maj V as native (allowed anywhere).
 * [i V i] encoded as ending on V so the loop pulls back to i.
 */
export const WALK_PATTERNS: Record<ScaleKind, WalkPattern[]> = {
  minor: [
    { id: 'hold_i_i', centers: [I, I] },
    { id: 'fifth_i_v_i', centers: [I, v, I] },
    { id: 'cadence_i_V_i', centers: [I, I, V] },
    { id: 'i_iv_v_i', centers: [I, iv, v, I] },
    { id: 'i_bVI_bIII_v', centers: [I, bVI, bIII, v] },
    { id: 'i_bVI_bIII_V', centers: [I, bVI, bIII, V] },
    { id: 'i_bVII_bVI_v', centers: [I, bVII, bVI, v] },
  ],
  major: [
    { id: 'I_V_I', centers: [Imaj, V, Imaj] },
    { id: 'I_V_vi_IV', centers: [Imaj, V, vi, IV] },
    { id: 'I_vi_IV_V', centers: [Imaj, vi, IV, V] },
    { id: 'I_IV_V_I', centers: [Imaj, IV, V, Imaj] },
  ],
  dorian: [
    { id: 'i_IV_i', centers: [I, IV, I] },
    { id: 'i_bVII_IV_i', centers: [I, bVII, IV, I] },
    { id: 'i_IV_v_i', centers: [I, IV, v, I] },
  ],
  pentatonic: [
    { id: 'i_v_i', centers: [I, v, I] },
    { id: 'i_bVII_v_i', centers: [I, bVII, v, I] },
    { id: 'i_iv_v_i', centers: [I, iv, v, I] },
  ],
  mixolydian: [
    { id: 'I_bVII_I', centers: [Imaj, bVII, Imaj] },
    { id: 'I_IV_bVII_I', centers: [Imaj, IV, bVII, Imaj] },
    { id: 'I_bVII_IV_I', centers: [Imaj, bVII, IV, Imaj] },
  ],
  phrygian: [
    { id: 'i_bII_i', centers: [I, bII, I] },
    { id: 'i_bVII_i', centers: [I, bVII, I] },
    { id: 'i_bII_bVII_i', centers: [I, bII, bVII, I] },
  ],
  lydian: [
    { id: 'I_II_I', centers: [Imaj, II, Imaj] },
    { id: 'I_V_I', centers: [Imaj, V, Imaj] },
    { id: 'I_II_V_I', centers: [Imaj, II, V, Imaj] },
  ],
  harmonic_minor: [
    { id: 'i_V_i', centers: [I, V, I] },
    { id: 'i_iv_V_i', centers: [I, iv, V, I] },
    { id: 'i_bVI_V_i', centers: [I, bVI, V, I] },
  ],
}

function weightPatterns(
  scale: ScaleKind,
  vibe?: VibeId,
  density?: Density,
): WalkPattern[] {
  const base = WALK_PATTERNS[scale]
  if (!base.length) return base
  // Soft vibe/density weighting: ambient/low prefer shorter holds; high prefer longer walks.
  if (density === 'low' || vibe === 'ambient' || vibe === 'lofi') {
    const short = base.filter((p) => p.centers.length <= 3)
    return short.length ? [...short, ...short, ...base] : base
  }
  if (density === 'high') {
    const long = base.filter((p) => p.centers.length >= 4)
    return long.length ? [...long, ...long, ...base] : base
  }
  return base
}

export function rollSeed(opts: {
  root: string
  scale: ScaleKind
  vibe?: VibeId
  density?: Density
  groove?: GrooveFamily
  fxBias?: FxBias
}): SongSeed {
  const patterns = weightPatterns(opts.scale, opts.vibe, opts.density)
  const pat = pick(patterns)
  const density = opts.density ?? 'mid'
  const groove = opts.groove ?? 'four_on_floor'
  const kickPool = DRUM_POOLS[groove][density]
  return {
    root: opts.root,
    scale: opts.scale,
    walk: pat.centers.map((c) => ({ ...c })),
    patternId: pat.id,
    kickClock: pick(kickPool),
    budget: buildBudget(density),
    mix: buildMixCard(opts.fxBias ?? 'dry', groove, density),
  }
}

/**
 * Root-only: keep walk degrees.
 * Scale change: pick a same-length (or any) walk from the new scale table.
 */
export function retargetSeed(seed: SongSeed, root: string, scale: ScaleKind): SongSeed {
  if (seed.scale === scale) {
    return {
      ...seed,
      root,
      walk: seed.walk.map((c) => ({ ...c })),
      kickClock: seed.kickClock,
      budget: seed.budget,
      mix: seed.mix,
    }
  }
  const patterns = WALK_PATTERNS[scale]
  const sameLen = patterns.filter((p) => p.centers.length === seed.walk.length)
  const pool = sameLen.length ? sameLen : patterns
  const pat = pick(pool)
  return {
    root,
    scale,
    walk: pat.centers.map((c) => ({ ...c })),
    patternId: pat.id,
    kickClock: seed.kickClock,
    budget: seed.budget,
    mix: seed.mix,
  }
}

export function randomSongRoot(avoid?: string): string {
  const pool = avoid ? SONG_ROOTS.filter((r) => r !== avoid) : [...SONG_ROOTS]
  return pick(pool.length ? [...pool] : [...SONG_ROOTS])
}

export function randomSongScale(avoid?: ScaleKind): ScaleKind {
  const pool = avoid ? SONG_SCALES.filter((s) => s !== avoid) : [...SONG_SCALES]
  return pick(pool.length ? pool : [...SONG_SCALES])
}


/** Display spelling for a walk center root (concert pitch in song key). */
export function formatConcertChord(root: string, center: WalkCenter): string {
  const pc = (rootIndex(root) + center.degree) % 12
  const raw = NOTE_NAMES[pc]!
  const display =
    raw.length === 1 ? raw.toUpperCase() : raw[0]!.toUpperCase() + raw.slice(1)
  return center.quality === 'min' ? `${display}m` : display
}

/** Short concert-name chips for songSeed.walk (e.g. Cm · Ab · Eb · G). */
export function walkConcertNames(seed: Pick<SongSeed, 'root' | 'walk'>): string[] {
  return seed.walk.map((c) => formatConcertChord(seed.root, c))
}

export function centerTriadNotes(root: string, center: WalkCenter, octave: number): string[] {
  const base = (rootIndex(root) + center.degree) % 12
  const third = center.quality === 'maj' ? 4 : 3
  return [0, third, 7].map((off) => {
    const pc = (base + off) % 12
    const bump = base + off >= 12 ? 1 : 0
    return `${NOTE_NAMES[pc]}${octave + bump}`
  })
}

/** Triad tones + one in-scale neighbor. V (maj) bar includes raised 7th of HOME. */
export function centerMelodyNotes(
  root: string,
  scale: ScaleKind,
  center: WalkCenter,
  octave: number,
): string[] {
  const triad = centerTriadNotes(root, center, octave)
  const r = rootIndex(root)
  const degs = SCALE_DEGREES[scale]
  const isCadenceV = center.quality === 'maj' && center.degree === 7

  let neighbor: string
  if (isCadenceV) {
    // Raised 7th of home (leading tone) — do not include flattened 7th this bar.
    const leadPc = (r + 11) % 12
    neighbor = `${NOTE_NAMES[leadPc]}${octave}`
  } else {
    const triadPcs = new Set(
      triad.map((n) => {
        const m = n.match(/^([a-g]#?|[a-g]b)/i)
        return m ? rootIndex(m[1]!) : -1
      }),
    )
    const candidates = degs
      .map((d) => (r + d) % 12)
      .filter((pc) => !triadPcs.has(pc))
    // Prefer a neighbor near the center root
    const centerPc = (r + center.degree) % 12
    candidates.sort(
      (a, b) =>
        Math.min(Math.abs(a - centerPc), 12 - Math.abs(a - centerPc)) -
        Math.min(Math.abs(b - centerPc), 12 - Math.abs(b - centerPc)),
    )
    const pickPc = candidates[0] ?? (r + degs[1]!) % 12
    // Exclude flattened 7th only on cadence; otherwise natural scale neighbor
    neighbor = `${NOTE_NAMES[pickPc]}${octave}`
  }

  const out = [...triad, neighbor]
  if (isCadenceV) {
    const flat7 = (r + 10) % 12
    return out.filter((n) => {
      const m = n.toLowerCase().match(/^([a-g](?:#|b)?)/)
      if (!m) return true
      return rootIndex(m[1]!) !== flat7
    })
  }
  return out
}

/** All pitch-class names that belong to the seed walk (for smoke asserts). */
export function seedPitchClasses(seed: SongSeed): Set<string> {
  const pcs = new Set<string>()
  for (const c of seed.walk) {
    for (const n of centerMelodyNotes(seed.root, seed.scale, c, 3)) {
      const m = n.toLowerCase().match(/^([a-g](?:#|b)?)/)
      if (m) pcs.add(m[1]!)
    }
  }
  return pcs
}

export function isLegalWalk(scale: ScaleKind, walk: WalkCenter[]): boolean {
  const allowed = NEIGHBORS[scale]
  const key = (c: WalkCenter) => `${c.degree}:${c.quality}`
  const ok = new Set(allowed.map(key))
  /** Scales where maj V is a normal (or native) neighbor — allowed anywhere. */
  const majVAnywhere = new Set<ScaleKind>([
    'major',
    'mixolydian',
    'lydian',
    'harmonic_minor',
  ])
  for (let i = 0; i < walk.length; i++) {
    const c = walk[i]!
    if (!ok.has(key(c))) return false
    const isMajV = c.quality === 'maj' && c.degree === 7
    if (!isMajV) continue
    // Cadence V (maj @ 7) is special only in natural minor — must be last.
    if (scale === 'minor') {
      if (i !== walk.length - 1) return false
      continue
    }
    if (majVAnywhere.has(scale)) continue
    // no maj V on dorian / pentatonic / phrygian
    return false
  }
  return true
}
