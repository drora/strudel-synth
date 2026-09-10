import type { TrackRole } from './types'
import type { SoundChoice } from './kits-types'
import { DRUM_SOUND_CHOICES } from './kits-sound-choices-drums'
import { MELODIC_SOUND_CHOICES } from './kits-sound-choices-melodic'

/** Curated per-role sound choices for the Sound sheet. */
export const SOUND_CHOICES: Record<TrackRole, SoundChoice[]> = {
  ...DRUM_SOUND_CHOICES,
  ...MELODIC_SOUND_CHOICES,
} as Record<TrackRole, SoundChoice[]>
