import type { TrackRole } from './types'

export type VibeId = 'techno' | 'lofi' | 'ambient' | 'house'

export type GrooveFamily = 'four_on_floor' | 'breakbeat' | 'halftime' | 'sparse' | 'perc_loop'

export type Density = 'low' | 'mid' | 'high'

export type ScaleKind = 'minor' | 'major' | 'dorian' | 'pentatonic'

export type FxBias = 'dry' | 'roomy' | 'filtered' | 'delay'

export interface VibeInfo {
  id: VibeId
  label: string
}

export interface SoundChoice {
  id: string
  label: string
  bank?: string
  sound?: string
  /** Sample index for drum banks */
  n?: number
}

/** Generated track with Strudel code (runtime only — not stored on Kit). */
export interface KitTrack {
  name: string
  role: TrackRole
  code: string
}

/** Lane layout only — no baked recipes. */
export interface KitTrackLayout {
  name: string
  role: TrackRole
}

/**
 * Coherent generation hints for apply / reload / Shuffle.
 * One groove family per kit; melodic notes stay in root+scale for a generate pass.
 */
export interface KitShuffleProfile {
  groove: GrooveFamily
  density: Density
  /** Root note class for melodic generators, e.g. 'c' */
  root?: string
  /** Prefer minor/major/modal palette */
  scale?: ScaleKind
  /** Preferred synth/sound names for melodic roles */
  melodicSounds?: string[]
  /** Soft FX bias hints */
  fxBias?: FxBias
  /** Prefer `.n(n)` on bank drum lines (RM50 / MC303 curated slots) */
  pinN?: number
}

export interface Kit {
  id: string
  vibe: VibeId
  name: string
  description: string
  bpm: number
  /** Primary drum machine bank for kit shuffle / bank lock */
  drumsBank: string
  tracks: KitTrackLayout[]
  shuffle: KitShuffleProfile
}

/** Vibe-level defaults — kits usually only override groove / density / sounds. */
export const VIBE_SHUFFLE_DEFAULTS: Record<VibeId, Required<Pick<KitShuffleProfile, 'groove' | 'density' | 'root' | 'scale' | 'fxBias'>> & { melodicSounds: string[] }> = {
  techno: {
    groove: 'four_on_floor',
    density: 'mid',
    root: 'c',
    scale: 'minor',
    fxBias: 'filtered',
    melodicSounds: ['sawtooth', 'square', 'triangle'],
  },
  house: {
    groove: 'four_on_floor',
    density: 'mid',
    root: 'c',
    scale: 'major',
    fxBias: 'dry',
    melodicSounds: ['sawtooth', 'square', 'sine', 'piano'],
  },
  lofi: {
    groove: 'halftime',
    density: 'low',
    root: 'c',
    scale: 'minor',
    fxBias: 'roomy',
    melodicSounds: ['triangle', 'sine', 'piano'],
  },
  ambient: {
    groove: 'sparse',
    density: 'low',
    root: 'c',
    scale: 'dorian',
    fxBias: 'roomy',
    melodicSounds: ['sine', 'triangle'],
  },
}

export type ResolvedShuffleProfile = {
  groove: GrooveFamily
  density: Density
  root: string
  scale: ScaleKind
  melodicSounds: string[]
  fxBias: FxBias
  pinN?: number
}

export function resolveShuffleProfile(kit: Kit): ResolvedShuffleProfile {
  const d = VIBE_SHUFFLE_DEFAULTS[kit.vibe]
  const s = kit.shuffle
  return {
    groove: s.groove ?? d.groove,
    density: s.density ?? d.density,
    root: s.root ?? d.root,
    scale: s.scale ?? d.scale,
    melodicSounds: s.melodicSounds?.length ? s.melodicSounds : d.melodicSounds,
    fxBias: s.fxBias ?? d.fxBias,
    pinN: s.pinN,
  }
}
