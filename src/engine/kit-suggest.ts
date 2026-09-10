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

function suggestDrumHits(kit: Kit, profile: ResolvedShuffleProfile, role: TrackRole | null | undefined): KitSuggestion[] {
  const pools = poolsForRole(role)
  const patterns = pools[profile.groove][profile.density]
  const hits = extractHits(patterns)
  const voiceExtra = voiceSampleHints(kit.drumsBank, role)
  const out: KitSuggestion[] = []
  const seen = new Set<string>()

  for (const h of [...hits, ...voiceExtra]) {
    if (seen.has(h)) continue
    seen.add(h)
    out.push({
      label: h,
      type: 'text',
      detail: kit.drumsBank,
      info: `Kit drum hit · ${profile.groove}/${profile.density}`,
      boost: 80,
    })
  }

  // Common dirt vocabulary as soft fallback (still below kit hits if already present)
  for (const h of ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'perc', 'sh', 'rd', 'cb', 'ht', 'mt', 'lt']) {
    if (seen.has(h)) continue
    seen.add(h)
    out.push({
      label: h,
      type: 'text',
      detail: 'drum',
      info: 'Drum hit',
      boost: 10,
    })
  }
  return out
}

/** Build in-scale melodic motif pool (same families as reshuffle lead/bass/arp). */
function melodicMotifPool(
  profile: ResolvedShuffleProfile,
  role: TrackRole | null | undefined,
): string[] {
  const degs = SCALE_DEGREES[profile.scale]
  const oct = role === 'bass' ? 2 : role === 'arp' ? 3 : 4
  // Stable degree order for filling — sample which notes, not chaotic reordering of the scale itself
  const ns = degs.slice(0, Math.min(7, degs.length)).map((d) => noteAt(profile.root, d, oct))
  const pickDegs = sampleN(ns, Math.min(6, ns.length))
  const [a, b, c, d, e, f] = [
    pickDegs[0] ?? ns[0]!,
    pickDegs[1] ?? ns[1] ?? ns[0]!,
    pickDegs[2] ?? ns[2] ?? ns[0]!,
    pickDegs[3] ?? ns[3] ?? ns[1] ?? ns[0]!,
    pickDegs[4] ?? ns[4] ?? ns[2] ?? ns[0]!,
    pickDegs[5] ?? ns[5] ?? ns[3] ?? ns[0]!,
  ]
  const density = profile.density
  const low = [
    `${a} ~ ~ ${b}`,
    `<${a} ~ ${b}>`,
    `<${a} ~ ${a} ${b}>`,
    `${a} ${b} ${c}`,
    `<${a} ${b}>`,
    `${a} ~ ${b} ~`,
    `<${a} ${b} ${a} ~>`,
  ]
  const high = [
    `<${a} ${b} ${c} ${d}>*2`,
    `<${a} ${b} ${c}>*3`,
    `<${a} ~ ${a} ${b}>`,
    `${a} ~ ${b} ~ ${c} ${d}`,
    `<${a} ${b} ${c} ${d} ${e} ${f}>`,
    `${a} ${b} ${c} ${d}`,
    `<~ ${a} ${b} ${c}>*2`,
    `<${a} ${b}>*4`,
  ]
  const mid = [
    `<${a} ${b} ${c} ${d}>*2`,
    `<${a} ~ ${a} ${b}>`,
    `${a} ~ ${b} ~ ${c}`,
    `<${a} ${b} ${c}>*3`,
    `${a} ${b} ${c} ${d}`,
    `<${a} ${b} ${c} ${d} ${e}>`,
    `~ ${a} ~ ${b} ${c}`,
    `<${a} ${b} ${a} ${c}>`,
  ]
  return density === 'low' ? low : density === 'high' ? high : mid
}

/** Melodic lead/bass/arp motif fragments — sampled each open from profile pools. */
function suggestMelodicPatternFragments(
  profile: ResolvedShuffleProfile,
  role: TrackRole | null | undefined,
): KitSuggestion[] {
  const density = profile.density
  const shapes = sampleN(melodicMotifPool(profile, role), 6)
  return shapes.map((p, i) => ({
    label: p,
    type: 'text' as const,
    detail: `${profile.root} ${profile.scale}`,
    info: `Kit melodic fragment · ${density}`,
    boost: 55 - i,
  }))
}

function suggestPatternFragments(
  profile: ResolvedShuffleProfile,
  role: TrackRole | null | undefined,
): KitSuggestion[] {
  if (role && !DRUM_ROLES.includes(role)) {
    return suggestMelodicPatternFragments(profile, role)
  }
  const pools = poolsForRole(role)
  const patterns = pools[profile.groove][profile.density]
  // Sample neighbors from the same groove/density pool reshuffle uses
  return sampleN(patterns, 6).map((p, i) => ({
    label: p,
    type: 'text' as const,
    detail: `${profile.groove}`,
    info: `Kit groove fragment · ${profile.groove}/${profile.density}`,
    boost: 55 - i,
  }))
}

/**
 * Rotating “try this” motif neighbors for note("...") — below stable scale notes.
 * Re-sampled each completion open; never replaces the ranked scale set.
 */
function suggestSampledMotifNeighbors(
  profile: ResolvedShuffleProfile,
  role: TrackRole | null | undefined,
): KitSuggestion[] {
  const motifs = sampleN(melodicMotifPool(profile, role), 3)
  return motifs.map((p, i) => ({
    label: p,
    type: 'text' as const,
    detail: 'try this',
    info: `Shuffle neighbor · ${profile.root} ${profile.scale} · ${profile.density}`,
    boost: 28 - i,
  }))
}

function suggestMelodicSounds(profile: ResolvedShuffleProfile, role: TrackRole | null | undefined): KitSuggestion[] {
  const out: KitSuggestion[] = []
  const seen = new Set<string>()

  for (const s of profile.melodicSounds) {
    if (seen.has(s)) continue
    seen.add(s)
    out.push({
      label: s,
      type: 'keyword',
      detail: 'kit sound',
      info: `Kit melodicSounds · ${profile.root} ${profile.scale}`,
      boost: 90,
    })
  }

  if (role && SOUND_CHOICES[role]) {
    for (const choice of SOUND_CHOICES[role]) {
      const id = choice.sound
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({
        label: id,
        type: 'keyword',
        detail: choice.label,
        info: `Sound choice · ${choice.label}`,
        boost: 35,
      })
    }
  }
  return out
}

function suggestBanks(kit: Kit): KitSuggestion[] {
  return [
    {
      label: kit.drumsBank,
      type: 'text',
      detail: 'kit bank',
      info: `Active kit drumsBank · ${kit.name}`,
      boost: 99,
    },
  ]
}

function suggestScaleNames(profile: ResolvedShuffleProfile): KitSuggestion[] {
  const aliases: Record<ScaleKind, string[]> = {
    minor: ['minor', 'aeolian'],
    major: ['major', 'ionian'],
    dorian: ['dorian'],
    pentatonic: ['pentatonic', 'minor pentatonic'],
  }
  return (aliases[profile.scale] ?? [profile.scale]).map((label, i) => ({
    label,
    type: 'text' as const,
    detail: 'kit scale',
    info: `Active kit scale · ${profile.root} ${profile.scale}`,
    boost: 90 - i * 5,
  }))
}

/**
 * Ranked neighbor suggestions from the active kit shuffle profile.
 * Soft bias only — callers should merge with global/curated fallbacks.
 */
export function suggestFromKitProfile(
  kit: Kit | null | undefined,
  role: TrackRole | null | undefined,
  context: KitSuggestContext,
): KitSuggestion[] {
  if (!kit) return []
  const profile = profileOf(kit)
  if (!profile) return []

  switch (context) {
    case 'note':
      // Stable ranked scale notes + lightly sampled motif neighbors (not full-line regen)
      return [...suggestNotes(profile, role), ...suggestSampledMotifNeighbors(profile, role)]
    case 'sample': {
      if (!role || DRUM_ROLES.includes(role)) {
        return [
          ...suggestDrumHits(kit, profile, role),
          ...suggestPatternFragments(profile, role),
        ]
      }
      return suggestMelodicSounds(profile, role)
    }
    case 'sound':
      return suggestMelodicSounds(profile, role)
    case 'bank':
      return suggestBanks(kit)
    case 'pattern':
      return suggestPatternFragments(profile, role)
    case 'scale':
      return suggestScaleNames(profile)
    default:
      return []
  }
}

/** Loose completion shape for merge (CodeMirror Completion-compatible). */
export type Suggestable = {
  label: string
  boost?: number
  detail?: string
  info?: unknown
  type?: string
}

/**
 * One completion per pitch+octave. Prefer reshuffle NOTE_NAMES spelling (c#, eb, …)
 * over cs/db aliases unless `prefix` clearly wants the alias (e.g. typed `cs`).
 */
export function dedupeNotesByPitch(
  items: readonly Suggestable[],
  opts?: { prefix?: string },
): Suggestable[] {
  const prefix = (opts?.prefix ?? '').toLowerCase()
  const byKey = new Map<string, Suggestable>()
  const passthrough: Suggestable[] = []

  for (const raw of items) {
    const key = notePitchKey(raw.label)
    if (!key) {
      passthrough.push({ ...raw, boost: raw.boost ?? 0 })
      continue
    }
    const pc = Number(key.split('|')[0])
    const oct = key.split('|')[1]!
    const base = raw.label.replace(/\d+$/, '').toLowerCase()
    const canonical = `${NOTE_NAMES[pc]!}${oct}`
    const boost = raw.boost ?? 0
    const prefixWantsThisAlias =
      prefix.length > 0 &&
      !isCanonicalSpelling(raw.label) &&
      base.startsWith(prefix) &&
      !NOTE_NAMES[pc]!.startsWith(prefix)

    let candidate: Suggestable = { ...raw, boost }
    if (!prefixWantsThisAlias && !isCanonicalSpelling(raw.label)) {
      candidate = {
        ...candidate,
        label: canonical,
        info:
          typeof raw.info === 'string'
            ? raw.info
            : `Note ${NOTE_NAMES[pc]!.toUpperCase()}${oct}`,
      }
    }

    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, candidate)
      continue
    }
    const prevBoost = prev.boost ?? 0
    const prevBase = prev.label.replace(/\d+$/, '').toLowerCase()
    const candBase = candidate.label.replace(/\d+$/, '').toLowerCase()
    const prevMatches = prefix.length === 0 || prev.label.toLowerCase().startsWith(prefix)
    const candMatches = prefix.length === 0 || candidate.label.toLowerCase().startsWith(prefix)

    if (candMatches && !prevMatches) {
      byKey.set(key, candidate)
    } else if (candMatches === prevMatches) {
      if (boost > prevBoost) {
        byKey.set(key, candidate)
      } else if (boost === prevBoost) {
        if (isCanonicalSpelling(candidate.label) && !isCanonicalSpelling(prev.label)) {
          byKey.set(key, candidate)
        } else if (prefixWantsThisAlias && !isCanonicalSpelling(candidate.label)) {
          byKey.set(key, candidate)
        }
      } else if (prefixWantsThisAlias && candBase.startsWith(prefix) && !prevBase.startsWith(prefix)) {
        byKey.set(key, candidate)
      }
    }
  }

  let out = [...byKey.values(), ...passthrough]
  if (prefix) {
    const matched = out.filter((x) => x.label.toLowerCase().startsWith(prefix))
    if (matched.length > 0) out = matched
  }
  return out.sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
}

/** Merge kit-biased suggestions over a base list; higher boost wins on duplicate labels. */
export function mergeKitSuggestions(
  base: readonly Suggestable[],
  kitOnes: KitSuggestion[],
): Suggestable[] {
  const byLabel = new Map()
  for (const b of base) {
    byLabel.set(b.label, { ...b, boost: b.boost ?? 0 })
  }
  for (const k of kitOnes) {
    const prev = byLabel.get(k.label)
    if (!prev || (prev.boost ?? 0) < k.boost) {
      byLabel.set(k.label, {
        ...prev,
        label: k.label,
        type: k.type ?? prev?.type ?? 'text',
        detail: k.detail ?? prev?.detail,
        info: k.info ?? (typeof prev?.info === 'string' ? prev.info : prev?.info),
        boost: k.boost,
      })
    }
  }
  return [...byLabel.values()].sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
}
