/**
 * Song-level scale/root remap + per-track octave shifts for melodic note(...) code.
 * Drums / hihats / fx sample lanes are ignored by callers.
 */
import type { TrackRole } from './types'
import type { ScaleKind } from './kits-types'

export const MELODIC_ROLES = new Set<TrackRole>([
  'bass',
  'lead',
  'pad',
  'arp',
  'vox',
  'custom',
])

export const SONG_ROOTS = [
  'c',
  'c#',
  'd',
  'eb',
  'e',
  'f',
  'f#',
  'g',
  'ab',
  'a',
  'bb',
  'b',
] as const

export const SONG_SCALES: ScaleKind[] = ['minor', 'major', 'dorian', 'pentatonic']

export const SCALE_DEGREES: Record<ScaleKind, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
}

/** Match reshuffle / kit-suggest spelling. */
export const NOTE_NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']

const SPELLING_TO_PC: Record<string, number> = {
  c: 0,
  'c#': 1,
  cs: 1,
  db: 1,
  d: 2,
  'd#': 3,
  ds: 3,
  eb: 3,
  e: 4,
  fb: 4,
  f: 5,
  'f#': 6,
  fs: 6,
  gb: 6,
  g: 7,
  'g#': 8,
  gs: 8,
  ab: 8,
  a: 9,
  'a#': 10,
  as: 10,
  bb: 10,
  b: 11,
  cb: 11,
}

const NOTE_TOKEN_RE = /([a-gA-G](?:#|b|s)?)(-?\d+)/g

export function isMelodicRole(role: TrackRole): boolean {
  return MELODIC_ROLES.has(role)
}

export function rootIndex(root: string): number {
  const r = root.toLowerCase().replace('♯', '#').replace('♭', 'b')
  if (r in SPELLING_TO_PC) return SPELLING_TO_PC[r]!
  const idx = NOTE_NAMES.indexOf(r)
  return idx >= 0 ? idx : 0
}

export function parseNoteToken(token: string): { pc: number; octave: number } | null {
  const m = String(token).trim().toLowerCase().match(/^([a-g](?:#|b|s)?)(-?\d+)$/)
  if (!m) return null
  const pc = SPELLING_TO_PC[m[1]!]
  if (pc === undefined) return null
  return { pc, octave: Number(m[2]) }
}

export function formatNote(pc: number, octave: number): string {
  const p = ((pc % 12) + 12) % 12
  return `${NOTE_NAMES[p]}${octave}`
}

/** Rewrite balanced note(...) argument bodies. */
export function rewriteNoteCallArgs(
  code: string,
  mapInner: (inner: string) => string,
): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const idx = code.indexOf('note(', i)
    if (idx < 0) {
      out += code.slice(i)
      break
    }
    out += code.slice(i, idx)
    const start = idx + 'note('.length
    let depth = 1
    let j = start
    while (j < code.length && depth > 0) {
      const ch = code[j]!
      if (ch === '(') depth++
      else if (ch === ')') depth--
      j++
    }
    const inner = code.slice(start, j - 1)
    out += `note(${mapInner(inner)})`
    i = j
  }
  return out
}

function mapNoteTokens(inner: string, map: (pc: number, octave: number, raw: string) => string): string {
  return inner.replace(NOTE_TOKEN_RE, (raw, name: string, octStr: string) => {
    const pc = SPELLING_TO_PC[name.toLowerCase()]
    if (pc === undefined) return raw
    return map(pc, Number(octStr), raw)
  })
}

/** Shift every note(...) pitch by ±N octaves (keep Sound/bank untouched). */
export function shiftNotesByOctaves(code: string, deltaOctaves: number): string {
  if (!deltaOctaves || !code.includes('note(')) return code
  return rewriteNoteCallArgs(code, (inner) =>
    mapNoteTokens(inner, (pc, octave) => formatNote(pc, octave + deltaOctaves)),
  )
}

function nearestDegree(rel: number, degs: number[]): number {
  let best = degs[0]!
  let bestDist = 99
  for (const d of degs) {
    const dist = Math.min(Math.abs(d - rel), 12 - Math.abs(d - rel))
    if (dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  return best
}

/**
 * Transpose by root delta, then quantize into the target scale.
 * Keeps rhythm/structure; only rewrites note name tokens inside note(...).
 */
export function remapNotesToHarmony(
  code: string,
  fromRoot: string,
  fromScale: ScaleKind,
  toRoot: string,
  toScale: ScaleKind,
): string {
  if (!code.includes('note(')) return code
  if (fromRoot === toRoot && fromScale === toScale) return code

  const fromR = rootIndex(fromRoot)
  const toR = rootIndex(toRoot)
  const rootDelta = toR - fromR
  const toDegs = SCALE_DEGREES[toScale]

  return rewriteNoteCallArgs(code, (inner) =>
    mapNoteTokens(inner, (pc, octave) => {
      const midi = pc + octave * 12 + rootDelta
      let newOct = Math.floor(midi / 12)
      let newPc = ((midi % 12) + 12) % 12
      const rel = ((newPc - toR) % 12 + 12) % 12
      const deg = nearestDegree(rel, toDegs)
      newPc = (toR + deg) % 12
      // Prefer staying near the transposed register
      const candidate = newPc + newOct * 12
      if (candidate - midi > 6) newOct -= 1
      else if (midi - candidate > 6) newOct += 1
      return formatNote(newPc, newOct)
    }),
  )
}

export function clampTrackOctave(n: number): number {
  return Math.max(-3, Math.min(3, Math.trunc(n)))
}
