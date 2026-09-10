/**
 * Read-only suggestion helpers for CodeMirror autocomplete.
 * Same shuffle profile + drumsBank as kit apply / reshuffle — ranked neighbor ideas,
 * never whole-track regeneration.
 */
import type { TrackRole } from './types'
import type { Kit, ResolvedShuffleProfile, ScaleKind } from './kits-types'
import { resolveShuffleProfile } from './kits-types'
import { DRUM_POOLS, HAT_POOLS, FX_POOLS } from './reshuffle-pools'
import { resolveDrumVoice } from './reshuffle-drums'
import { SOUND_CHOICES } from './kits-sound-choices'

export type KitSuggestContext = 'note' | 'sample' | 'bank' | 'sound' | 'pattern' | 'scale'

export interface KitSuggestion {
  label: string
  detail?: string
  info?: string
  /** CodeMirror boost — higher ranks first */
  boost: number
  type?: 'text' | 'keyword' | 'variable'
}

const DRUM_ROLES: TrackRole[] = ['drums', 'hihats', 'fx']

const SCALE_DEGREES: Record<ScaleKind, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
}

/** Match reshuffle note spelling so suggestions stay in-groove with generated code. */
const NOTE_NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']

/** Pitch-class index for any common Strudel note spelling (c#, cs, db, …). */
const SPELLING_TO_PC: Record<string, number> = {
  c: 0,
  'c#': 1, cs: 1, db: 1,
  d: 2,
  'd#': 3, ds: 3, eb: 3,
  e: 4, fb: 4,
  f: 5,
  'f#': 6, fs: 6, gb: 6,
  g: 7,
  'g#': 8, gs: 8, ab: 8,
  a: 9,
  'a#': 10, as: 10, bb: 10,
  b: 11, cb: 11,
}

/** `pc|octave` key, or null if not a note label. */
export function notePitchKey(label: string): string | null {
  const m = String(label).trim().toLowerCase().match(/^([a-g](?:#|b|s)?)(\d+)$/)
  if (!m) return null
  const pc = SPELLING_TO_PC[m[1]!]
  if (pc === undefined) return null
  return `${pc}|${m[2]}`
}

function isCanonicalSpelling(label: string): boolean {
  const base = label.replace(/\d+$/, '').toLowerCase()
  return (NOTE_NAMES as readonly string[]).includes(base)
}

function rootIndex(root: string): number {
  const r = root.toLowerCase().replace('♯', '#').replace('♭', 'b')
  const idx = NOTE_NAMES.indexOf(r)
  if (idx >= 0) return idx
  const map: Record<string, number> = {
    db: 1, d: 2, eb: 3, e: 4, f: 5, gb: 6, g: 7, ab: 8, a: 9, bb: 10, b: 11, c: 0,
    cs: 1, ds: 3, fs: 6, gs: 8, as: 10,
  }
  return map[r] ?? 0
}

function noteAt(root: string, degree: number, octave: number): string {
  const semis = (rootIndex(root) + degree + 120) % 12
  return `${NOTE_NAMES[semis]}${octave}`
}

function profileOf(kit: Kit | null | undefined): ResolvedShuffleProfile | null {
  if (!kit) return null
  return resolveShuffleProfile(kit)
}

function extractHits(patterns: string[]): string[] {
  const hits = new Set<string>()
  for (const p of patterns) {
    for (const tok of p.match(/[a-zA-Z_][\w:]*/g) ?? []) {
      hits.add(tok)
    }
  }
  return [...hits]
}

function poolsForRole(role: TrackRole | null | undefined) {
  if (role === 'hihats') return HAT_POOLS
  if (role === 'fx') return FX_POOLS
  return DRUM_POOLS
}

/** Fisher–Yates sample — re-roll neighbors each completion open (not full-line regen). */
function sampleN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr]
  const take = Math.min(n, copy.length)
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, take)
}

function voiceSampleHints(drumsBank: string, role: TrackRole | null | undefined): string[] {
  const voice = resolveDrumVoice(drumsBank)
  switch (voice) {
    case 'amen':
      return ['amencutup']
    case 'breaks':
      return ['breaks165', 'breaks157']
    case 'gretsch':
      return ['gretsch']
    case 'electro':
      return role === 'hihats' ? ['hh', 'oh'] : ['bd', 'sd', 'cp', 'hh']
    case 'jazz':
      return ['jazz']
    case 'tabla':
      return ['tabla']
    case 'mridangam':
      return ['mridangam']
    case 'vcsl':
      return ['east', 'west', 'drum']
    case 'perc727':
      return ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'perc']
    case 'nobank':
      return []
    default:
      return []
  }
}

function suggestNotes(profile: ResolvedShuffleProfile, role: TrackRole | null | undefined): KitSuggestion[] {
  const degs = SCALE_DEGREES[profile.scale]
  const preferredOct =
    role === 'bass' ? [1, 2, 3]
    : role === 'pad' ? [3, 4]
    : role === 'arp' ? [3, 4, 5]
    : [3, 4, 5]
  const out: KitSuggestion[] = []
  const seen = new Set<string>()

  for (const oct of preferredOct) {
    for (let i = 0; i < degs.length; i++) {
      const label = noteAt(profile.root, degs[i]!, oct)
      if (seen.has(label)) continue
      seen.add(label)
      const boost = 70 - i - (preferredOct.indexOf(oct) * 3)
      out.push({
        label,
        type: 'text',
        detail: `${profile.root} ${profile.scale}`,
        info: `In-kit scale · ${profile.root} ${profile.scale}`,
        boost: Math.max(40, boost),
      })
      // Aliases (cs/db/…) stay in chromatic pool; dedupeNotesByPitch collapses by pitch.
    }
  }
  return out
}
