/**
 * Song seed: shared chord walk for a 4-bar jam.
 * Melodic lanes follow the walk; drums/hats/fx stay on role pools (PR B).
 */
import type { Density, ScaleKind, VibeId } from './kits-types'
import { NOTE_NAMES, SONG_ROOTS, SCALE_DEGREES, rootIndex } from './note-harmony'

export type WalkCenter = {
  /** Semitones from song home (0, 3, 5, 7, 8, 10…). */
  degree: number
  quality: 'min' | 'maj'
}

export type SongSeed = {
  root: string
  scale: ScaleKind
  walk: WalkCenter[]
  patternId: string
}

type WalkPattern = { id: string; centers: WalkCenter[] }

const I: WalkCenter = { degree: 0, quality: 'min' }
const Imaj: WalkCenter = { degree: 0, quality: 'maj' }
const ii: WalkCenter = { degree: 2, quality: 'min' }
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
}

/**
 * Walk patterns. Minor cadence V (maj @ 7) only as last center.
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
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
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
}): SongSeed {
  const patterns = weightPatterns(opts.scale, opts.vibe, opts.density)
  const pat = pick(patterns)
  return {
    root: opts.root,
    scale: opts.scale,
    walk: pat.centers.map((c) => ({ ...c })),
    patternId: pat.id,
  }
}

/**
 * Root-only: keep walk degrees.
 * Scale change: pick a same-length (or any) walk from the new scale table.
 */
export function retargetSeed(seed: SongSeed, root: string, scale: ScaleKind): SongSeed {
  if (seed.scale === scale) {
    return { ...seed, root, walk: seed.walk.map((c) => ({ ...c })) }
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
  }
}

export function randomSongRoot(): string {
  return pick([...SONG_ROOTS])
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
  for (let i = 0; i < walk.length; i++) {
    const c = walk[i]!
    if (!ok.has(key(c))) return false
    // Cadence V (maj @ 7) is special only in minor — must be last.
    // On major, V is a normal dominant neighbor.
    if (scale === 'minor' && c.quality === 'maj' && c.degree === 7) {
      if (i !== walk.length - 1) return false
    }
    if (scale !== 'minor' && scale !== 'major' && c.quality === 'maj' && c.degree === 7) {
      return false // no maj V on dorian/pentatonic
    }
  }
  return true
}
