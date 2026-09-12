/** Kit suggestion builders (notes/samples/patterns/sounds). */
import type { TrackRole } from './types'
import type { Kit, ResolvedShuffleProfile, ScaleKind } from './kits-types'
import { SOUND_CHOICES } from './kits-sound-choices'
import {
  type KitSuggestContext,
  type KitSuggestion,
  DRUM_ROLES,
  SCALE_DEGREES,
  profileOf,
  noteAt,
  poolsForRole,
  sampleN,
  extractHits,
  voiceSampleHints,
} from './kit-suggest-core'
import { rootIndex } from './note-harmony'
import { centerMelodyNotes, type WalkCenter } from './song-seed'

/** Pitch-classes of walk triad tones (root, 3rd, 5th per center). */
function walkTriadPcs(root: string, walk: WalkCenter[]): { walk: Set<number>; home: Set<number> } {
  const r = rootIndex(root)
  const walkPcs = new Set<number>()
  const homePcs = new Set<number>()
  for (const c of walk) {
    const base = (r + c.degree) % 12
    const third = c.quality === 'maj' ? 4 : 3
    const pcs = [base, (base + third) % 12, (base + 7) % 12]
    for (const pc of pcs) {
      walkPcs.add(pc)
      if (c.degree === 0) homePcs.add(pc)
    }
  }
  return { walk: walkPcs, home: homePcs }
}

function suggestNotes(
  profile: ResolvedShuffleProfile,
  role: TrackRole | null | undefined,
  walk?: WalkCenter[] | null,
): KitSuggestion[] {
  const degs = SCALE_DEGREES[profile.scale]
  const preferredOct =
    role === 'bass' ? [1, 2, 3]
    : role === 'pad' ? [3, 4]
    : role === 'arp' ? [3, 4, 5]
    : [3, 4, 5]
  const out: KitSuggestion[] = []
  const seen = new Set<string>()
  const r = rootIndex(profile.root)
  const triad = walk && walk.length > 0 ? walkTriadPcs(profile.root, walk) : null

  for (const oct of preferredOct) {
    for (let i = 0; i < degs.length; i++) {
      const deg = degs[i]!
      const label = noteAt(profile.root, deg, oct)
      if (seen.has(label)) continue
      seen.add(label)
      const pc = (r + deg) % 12
      let boost = 70 - i - (preferredOct.indexOf(oct) * 3)
      let detail = `${profile.root} ${profile.scale}`
      let info = `Song scale · ${profile.root} ${profile.scale}`
      if (triad?.walk.has(pc)) {
        // Soft +25 band; ignore scale-index so bVII isn't buried under I at later octaves
        boost = 70 + 25 - (preferredOct.indexOf(oct) * 3)
        if (triad.home.has(pc)) boost += 3
        detail = 'walk'
        info = `Song walk · ${profile.root} ${profile.scale}`
      }
      out.push({
        label,
        type: 'text',
        detail,
        info,
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
  walk?: WalkCenter[] | null,
): string[] {
  const degs = SCALE_DEGREES[profile.scale]
  const oct = role === 'bass' ? 2 : role === 'arp' ? 3 : 4
  // Prefer walk triad/melody tones when a song walk is present; else scale degrees
  let ns: string[]
  if (walk && walk.length > 0) {
    const seen = new Set<string>()
    ns = []
    for (const c of walk) {
      for (const n of centerMelodyNotes(profile.root, profile.scale, c, oct)) {
        if (seen.has(n)) continue
        seen.add(n)
        ns.push(n)
      }
    }
    if (ns.length === 0) {
      ns = degs.slice(0, Math.min(7, degs.length)).map((d) => noteAt(profile.root, d, oct))
    }
  } else {
    // Stable degree order for filling — sample which notes, not chaotic reordering of the scale itself
    ns = degs.slice(0, Math.min(7, degs.length)).map((d) => noteAt(profile.root, d, oct))
  }
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
  walk?: WalkCenter[] | null,
): KitSuggestion[] {
  const density = profile.density
  const shapes = sampleN(melodicMotifPool(profile, role, walk), 6)
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
  walk?: WalkCenter[] | null,
): KitSuggestion[] {
  if (role && !DRUM_ROLES.includes(role)) {
    return suggestMelodicPatternFragments(profile, role, walk)
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
    mixolydian: ['mixolydian', 'mixo'],
    phrygian: ['phrygian'],
    lydian: ['lydian'],
    harmonic_minor: ['harmonic minor', 'harmonic_minor', 'harm minor'],
  }
  return (aliases[profile.scale] ?? [profile.scale]).map((label, i) => ({
    label,
    type: 'text' as const,
    detail: 'song scale',
    info: `Active song scale · ${profile.root} ${profile.scale}`,
    boost: 90 - i * 5,
  }))
}

/** Optional song-level root/scale/walk — mirrors jam-actions songAwareShuffle. */
export type KitSuggestHarmony = {
  root: string
  scale: ScaleKind
  walk?: WalkCenter[]
}

/**
 * Ranked neighbor suggestions from the active kit shuffle profile.
 * Soft bias only — callers should merge with global/curated fallbacks.
 * When `harmony` is set (songRoot/songScale), note/scale/motif suggestions
 * use that root+scale while keeping kit groove/density/melodicSounds/banks.
 */
export function suggestFromKitProfile(
  kit: Kit | null | undefined,
  role: TrackRole | null | undefined,
  context: KitSuggestContext,
  harmony?: KitSuggestHarmony | null,
): KitSuggestion[] {
  if (!kit) return []
  const base = profileOf(kit)
  if (!base) return []
  const profile = harmony
    ? { ...base, root: harmony.root, scale: harmony.scale }
    : base

  const walk = harmony?.walk
  switch (context) {
    case 'note':
      // Single-pitch labels only — multi-token motifs belong in pattern / s( sample contexts
      return suggestNotes(profile, role, walk)
    case 'sample': {
      if (!role || DRUM_ROLES.includes(role)) {
        return [
          ...suggestDrumHits(kit, profile, role),
          ...suggestPatternFragments(profile, role, walk),
        ]
      }
      // Melodic s("…"): sounds first, plus sampled motif neighbors (not for note())
      return [
        ...suggestMelodicSounds(profile, role),
        ...suggestMelodicPatternFragments(profile, role, walk),
      ]
    }
    case 'sound':
      return suggestMelodicSounds(profile, role)
    case 'bank':
      return suggestBanks(kit)
    case 'pattern':
      return suggestPatternFragments(profile, role, walk)
    case 'scale':
      return suggestScaleNames(profile)
    default:
      return []
  }
}
