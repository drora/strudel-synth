import type { TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'
import { setBankInCode, setSoundInCode, setNInCode, getBankFromCode, getSoundFromCode, getNFromCode } from './code-effects'
import { KITS_A } from './kits-data-a'
import { KITS_B } from './kits-data-b'
import { KITS_C } from './kits-data-c'
import { KITS_D } from './kits-data-d'
import { KITS_E } from './kits-data-e'
import { KITS_F } from './kits-data-f'
import type {
  VibeId,
  VibeInfo,
  SoundChoice,
  KitTrack,
  KitTrackLayout,
  KitShuffleProfile,
  Kit,
  GrooveFamily,
  Density,
  ScaleKind,
  FxBias,
  ResolvedShuffleProfile,
} from './kits-types'
import { VIBE_SHUFFLE_DEFAULTS, resolveShuffleProfile } from './kits-types'
import { generateKitTracks } from './reshuffle'

export type {
  VibeId,
  VibeInfo,
  SoundChoice,
  KitTrack,
  KitTrackLayout,
  KitShuffleProfile,
  Kit,
  GrooveFamily,
  Density,
  ScaleKind,
  FxBias,
  ResolvedShuffleProfile,
}
export { VIBE_SHUFFLE_DEFAULTS, resolveShuffleProfile, generateKitTracks }

export const VIBES: VibeInfo[] = [
  { id: 'techno', label: 'Techno' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'house', label: 'House' },
]

export const KITS: Kit[] = [...KITS_A, ...KITS_B, ...KITS_C, ...KITS_D, ...KITS_E, ...KITS_F]

export function listVibes(): VibeInfo[] {
  return VIBES
}

export function getKitsForVibe(vibe: VibeId): Kit[] {
  return KITS.filter((k) => k.vibe === vibe)
}

export function getKit(id: string): Kit | undefined {
  return KITS.find((k) => k.id === id)
}

/**
 * Build a Template by *generating* fresh track code from the kit shuffle profile
 * + lane layout. Every call yields related-but-new patterns (not baked recipes).
 */
export function kitToTemplate(kit: Kit): Template {
  const tracks = generateKitTracks(kit)
  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    bpm: kit.bpm,
    tracks: tracks.map((t) => ({
      name: t.name,
      role: t.role,
      code: t.code,
      color: ROLE_COLORS[t.role],
    })),
  }
}

export { SOUND_CHOICES } from './kits-sound-choices'


/** True when code currently reflects this Sound sheet choice (bank/sound/n). */
export function matchSoundChoice(code: string, choice: SoundChoice): boolean {
  const bank = getBankFromCode(code)
  const sound = getSoundFromCode(code)
  const n = getNFromCode(code)

  if (choice.bank) {
    if (bank !== choice.bank) return false
    if (choice.n != null) return n === choice.n
    // Base bank tile: selected when n is unset or 0 (default hit)
    return n == null || n === 0
  }
  if (choice.sound) {
    return sound === choice.sound
  }
  return false
}

export function applySoundChoiceToCode(code: string, choice: SoundChoice): string {
  let next = code
  if (choice.bank) next = setBankInCode(next, choice.bank)
  if (choice.sound) {
    // Prefer .sound() for synths; drum lines often use s("bd") + bank
    if (/\.sound\(/.test(next) || /note\(/.test(next)) {
      next = setSoundInCode(next, choice.sound)
    } else if (!/\.bank\(/.test(next) && choice.bank) {
      next = setBankInCode(next, choice.bank)
    } else if (choice.sound) {
      next = setSoundInCode(next, choice.sound)
    }
  }
  if (choice.n != null) next = setNInCode(next, choice.n)
  return next
}

export function detectKitBank(tracks: { role: TrackRole; code: string }[]): string | null {
  const drum = tracks.find((t) => t.role === 'drums' || t.role === 'hihats' || t.role === 'fx')
  return drum ? getBankFromCode(drum.code) : null
}
