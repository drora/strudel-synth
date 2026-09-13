/**
 * Jam song intensity — 4 discrete levels, remembered per kit.
 * 1 = kit generate (8-feel). 3+ can introduce a pad. 4 = max.
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
  return level === INTENSITY_PAD_LEVEL && !hasPad
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
