import type { TrackRole } from './types'

export type VibeId = 'techno' | 'lofi' | 'ambient' | 'house'

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

export interface KitTrack {
  name: string
  role: TrackRole
  code: string
}

export interface Kit {
  id: string
  vibe: VibeId
  name: string
  description: string
  bpm: number
  /** Primary drum machine bank for lock-kit shuffle */
  drumsBank: string
  tracks: KitTrack[]
}
