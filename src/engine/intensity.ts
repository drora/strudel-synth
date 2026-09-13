/**
 * Jam song intensity — 4 discrete levels rebuilt from the level-1 generate (never stacked).
 * No gain/LPF/reverb/delay mush. Kit / New kit / Shuffle reset to 1.
 *
 * 1 — as-is. Song as generated. No pattern change, no FX.
 * 2 — double hats only. Hats densify (8→16 fill). Kick, snare, bass, pads, lead stay.
 * 3 — pad → arp → keys → fx cascade (one spawn). Hats stay doubled. First missing role in
 *     that order; keys = a lead lane named Keys; fx even if an FX track already exists.
 *     Going back to 2 drops only the spawned lane.
 * 4 — double kick + snare + bass. Hats stay doubled. bd/kick and sd/snare densify; bass
 *     densifies the same 8→16 way. Not hats again.
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

export function captureIntensitySnap(
  tracks: readonly { id: string; code: string }[],
  spawnedPad: Track | null,
): IntensitySnap {
  return {
    codes: tracks.map((t) => ({ id: t.id, code: t.code })),
    spawnedPad: spawnedPad ? { ...spawnedPad } : null,
  }
}
