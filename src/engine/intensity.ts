/**
 * Jam song intensity — 4 discrete levels rebuilt from the level-1 generate (never stacked).
 * No gain/LPF/reverb/delay mush. Kit / New kit / Shuffle reset to 1.
 *
 * 1 — as-is. Song as generated. No pattern change, no FX.
 * 2 — double hats only. Hats densify (8→16 fill). Kick, snare, bass, pads, lead stay.
 * 3 — pad, or arp if a pad already exists. Hats stay doubled. Spawn a pad lane if none;
 *     if a pad already exists, spawn an arp instead. Going back to 2 drops only the spawned lane.
 * 4 — double kick + snare + bass. Hats stay doubled. bd/kick and sd/snare densify; bass
 *     densifies the same 8→16 way. Not hats again.
 */
import type { Track } from './types'

export const INTENSITY_MIN = 1
export const INTENSITY_MAX = 4
/** Enter 3 = add pad if missing. Leave 3 downward = drop spawned pad. */
export const INTENSITY_PAD_LEVEL = 3

export type IntensityLevel = 1 | 2 | 3 | 4

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

/** Level 3+: Pad if none, Arp if a pad lane already exists. */
export function intensitySpawnRole(hasPad: boolean): 'pad' | 'arp' {
  return hasPad ? 'arp' : 'pad'
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
