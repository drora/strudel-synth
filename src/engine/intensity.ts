/**
 * Jam song intensity — chained levels (not independent rebuilds from L1).
 * No gain/LPF/reverb/delay mush. Kit / New kit / Shuffle reset to 1.
 *
 * 1 — as-is. Song as generated. No pattern change, no FX.
 * 2 — L1 + hat densify (8→16 fill / euclid bump). Kick, snare, bass, pads, lead stay.
 *     In-level hat edits are kept in snap[2] and ride into L3/L4.
 * 3 — L2 + pad → arp → keys → fx cascade (one spawn). No extra pattern densify.
 *     Going back to 2 drops only the spawned lane. Pad/spawn edits persist 3↔4.
 * 4 — L3 + kick/snare/bass/keys/fx densify only (no hat/euclid re-run). Same L3 spawn
 *     (shared; no reshuffle). Edits on that lane persist across 3↔4.
 */
import type { Track } from './types'

export const INTENSITY_MIN = 1
export const INTENSITY_MAX = 4
/** Enter 3 = spawn one cascade lane. Leave 3 downward = drop spawned lane. */
export const INTENSITY_PAD_LEVEL = 3

export type IntensityLevel = 1 | 2 | 3 | 4

export type IntensitySpawnRole = 'pad' | 'arp' | 'lead' | 'fx'

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

/** L3 and L4 share the same spawned lane; moving between them must not reshuffle it. */
export function intensityLevelsShareSpawn(from: number, to: number): boolean {
  return from >= INTENSITY_PAD_LEVEL && to >= INTENSITY_PAD_LEVEL
}

export function captureIntensitySnap(
  tracks: readonly { id: string; code: string }[],
  spawnedPad: Track | null,
): IntensitySnap {
  return {
    codes: tracks.map((t) => ({ id: t.id, code: t.code })),
    spawnedPad: spawnedPad ? { ...spawnedPad } : null,
  }
}
