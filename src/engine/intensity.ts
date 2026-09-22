/**
 * Intensity cache — HARD CONTRACT (four partial overlays, never a full-jam tape).
 *
 * Owns (only ids that snap may store):
 * - L1: kit tracks from generate. Base code.
 * - L2: only hat-recipe tracks (hihats, hat tokens on drums, euclid hats). Never snare/kick/bass-only.
 * - L3: only the extra spawn. Same id. Never kit tracks.
 * - L4: only densify-recipe tracks (kick/bass/kit Keys; skip snare/rim/clap backbeat). Not hats. Not spawn.
 *
 * Play: composite L1 → L2 overlay if ≥2 → L3 spawn if ≥3 → L4 densify if 4.
 * A level must not rewrite a track it never owned.
 *
 * Edit at N: save last edit on N only if N owns that track. Invalidate that track in every
 * snap above N. Never write downward.
 *
 * Enter M: for each track M owns, if overlay invalidated or missing, recalculate M's recipe
 * from last lower edit; else keep the overlay (in-level edit persists).
 *
 * Spawn: 3→2 drops; 2→3 restores L3 spawn (L3 edits). First 3→4 or 3→4 after L3 pad edit
 * (L4 spawn invalidated): L4 starts from last L3 pad. L4-only pad stays on 4; 4→3 is L3.
 *
 * No mush FX. Kit / New kit / Shuffle reset to 1.
 */
import type { Track, TrackRole } from './types'

export const INTENSITY_MIN = 1
export const INTENSITY_MAX = 4
/** Enter 3 = spawn one cascade lane. Leave 3 downward = drop spawned lane. */
export const INTENSITY_PAD_LEVEL = 3

export type IntensityLevel = 1 | 2 | 3 | 4

export type IntensitySpawnRole = 'pad' | 'arp' | 'lead' | 'fx'

/**
 * Partial overlay for one intensity tier — not a full session dump.
 * `codes` = only tracks this level owns; `spawnedPad` = L3 spawn or L4-only pad slot.
 */
export type IntensitySnap = {
  codes: { id: string; code: string }[]
  spawnedPad: Track | null
}

export function clampIntensity(n: number): IntensityLevel {
  if (n <= 1) return 1
  if (n >= 4) return 4
  return Math.round(n) as IntensityLevel
}

export function nextIntensity(level: number, dir: 1 | -1): IntensityLevel {
  return clampIntensity(level + dir)
}

export function shouldSpawnIntensityPad(level: IntensityLevel, hasPad: boolean): boolean {
  return level >= INTENSITY_PAD_LEVEL && !hasPad
}

/** Keys lane = name match (not every lead). Kit "Lead" is not Keys. */
export function isKeysTrack(t: { name: string }): boolean {
  return /keys|piano|rhodes|epiano|clav/i.test(t.name)
}

/** Snare / rim / clap backbeat lanes — L4 densify must leave these alone. */
export function isSnareBackbeatTrack(t: { name: string }): boolean {
  return /snare|rim|clap|\bsd\b|\bcp\b|\brs\b/i.test(t.name)
}

/** Level 3+: first missing in pad → arp → keys(lead) → fx. */
export function intensitySpawnRole(flags: {
  hasPad: boolean
  hasArp: boolean
  hasKeys: boolean
}): IntensitySpawnRole {
  if (!flags.hasPad) return 'pad'
  if (!flags.hasArp) return 'arp'
  if (!flags.hasKeys) return 'lead'
  return 'fx'
}

export function shouldSpawnIntensityLane(level: IntensityLevel, alreadySpawned: boolean): boolean {
  return level >= INTENSITY_PAD_LEVEL && !alreadySpawned
}

export function shouldDropSpawnedPad(level: IntensityLevel): boolean {
  return level < INTENSITY_PAD_LEVEL
}

/** L3 and L4 share the same spawned lane id; moving between them must not reshuffle it. */
export function intensityLevelsShareSpawn(from: number, to: number): boolean {
  return from >= INTENSITY_PAD_LEVEL && to >= INTENSITY_PAD_LEVEL
}

/** Capture a partial overlay (caller decides which tracks belong). */
export function captureIntensitySnap(
  tracks: readonly { id: string; code: string }[],
  spawnedPad: Track | null,
): IntensitySnap {
  return {
    codes: tracks.map((t) => ({ id: t.id, code: t.code })),
    spawnedPad: spawnedPad ? { ...spawnedPad } : null,
  }
}

/** L1 base = all kit tracks, never the spawn lane. */
export function captureL1BaseSnap(
  tracks: readonly { id: string; code: string }[],
  spawnId: string | null,
): IntensitySnap {
  return {
    codes: tracks.filter((t) => t.id !== spawnId).map((t) => ({ id: t.id, code: t.code })),
    spawnedPad: null,
  }
}

/** True when L2 hat-recipe would change this track. */
export function intensityL2TouchesTrack(
  role: TrackRole,
  l1Code: string,
  densifyL2: (code: string, role: TrackRole) => string,
): boolean {
  if (role === 'hihats') return true
  if (role === 'drums') return densifyL2(l1Code, role) !== l1Code
  return false
}

/** True when L4 densify-recipe would change this track (not hats; not snare/rim/clap). */
export function intensityL4TouchesTrack(
  role: TrackRole,
  keys: boolean,
  baseCode: string,
  densifyL4: (code: string, role: TrackRole) => string,
  track?: { name: string },
): boolean {
  if (role === 'hihats') return false
  if (track && isSnareBackbeatTrack(track)) return false
  if (role === 'drums' || role === 'bass' || role === 'fx' || keys) {
    return densifyL4(baseCode, role) !== baseCode
  }
  return false
}

export function snapCodeMap(snap: IntensitySnap | undefined): Map<string, string> {
  return new Map((snap?.codes ?? []).map((c) => [c.id, c.code]))
}

export function upsertSnapCode(
  codes: { id: string; code: string }[],
  id: string,
  code: string,
): { id: string; code: string }[] {
  const next = codes.map((c) => ({ ...c }))
  const idx = next.findIndex((c) => c.id === id)
  if (idx >= 0) next[idx] = { id, code }
  else next.push({ id, code })
  return next
}

/** Drop track T (and spawn if same id) from a snap. */
export function stripTrackFromSnap(snap: IntensitySnap, trackId: string): IntensitySnap {
  return {
    codes: snap.codes.filter((c) => c.id !== trackId),
    spawnedPad: snap.spawnedPad?.id === trackId ? null : snap.spawnedPad,
  }
}

export const INTENSITY_LEVELS_ABOVE: Record<IntensityLevel, IntensityLevel[]> = {
  1: [2, 3, 4],
  2: [3, 4],
  3: [4],
  4: [],
}
