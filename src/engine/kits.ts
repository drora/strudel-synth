import type { TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'
import { setBankInCode, setSoundInCode, setNInCode, getBankFromCode, getSoundFromCode, getNFromCode, primarySSample, rewriteSPatternSample } from './code-effects'
import { applyVoiceClipToCode } from './voice-profile'
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
import type { SongSeed } from './song-seed'

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
export function kitToTemplate(kit: Kit, seed?: SongSeed): Template {
  const tracks = generateKitTracks(kit, seed)
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


/** Sample-voice choice (tabla:0, amencutup:3, mridangam_tha, bd/cp, dirt FX hits, …) — no .bank(). */
function isSampleVoiceChoice(choice: SoundChoice): boolean {
  if (!choice.sound || choice.bank) return false
  const s = choice.sound
  return (
    s.includes(':') ||
    /^(tabla2?|tablex|amencutup|breaks\d+|gretsch|electro1|jazz|mridangam_|bassdrum\d*|snare_|hihat)/.test(s) ||
    /^(bd|sd|cp|hh|oh|rim|perc|cb|rd)$/.test(s) ||
    // Dirt one-shots on the FX sheet (moved off melodic pad/lead)
    /^(pad|padlong|stab|hoover|pluck|juno)$/.test(s)
  )
}

/** Drop bank/n/sound when switching a drum line to a dirt sample voice. */
function stripBankVoiceExtras(code: string): string {
  return code
    .replace(/\.bank\(\s*["'][^"']+["']\s*\)/g, '')
    .replace(/\.n\(\s*\d+\s*\)/g, '')
    .replace(/\.sound\(\s*["'][^"']+["']\s*\)/g, '')
}

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
    if (sound === choice.sound) return true
    // Sample-voice: only primary (first non-rest) hit is "selected" — not every token in a mixed pattern
    return primarySSample(code) === choice.sound
  }
  return false
}

export function applySoundChoiceToCode(code: string, choice: SoundChoice, role?: TrackRole): string {
  let next = code
  if (choice.bank) next = setBankInCode(next, choice.bank)
  if (choice.sound) {
    if (
      isSampleVoiceChoice(choice) &&
      /\bs\(\s*["'][^"']+["']\s*\)/.test(next) &&
      !/\bnote\(/.test(next)
    ) {
      // Dirt FX one-shots: whole s("…") becomes the sample; special voices keep pattern shape
      if (/^(pad|padlong|stab|hoover|pluck|juno)$/.test(choice.sound)) {
        next = next.replace(/\bs\(\s*["'][^"']+["']\s*\)/, `s("${choice.sound}")`)
      } else {
        next = rewriteSPatternSample(next, choice.sound)
      }
      next = stripBankVoiceExtras(next)
    } else if (/\.sound\(/.test(next) || /note\(/.test(next)) {
      // Prefer .sound() for synths; drum lines often use s("bd") + bank
      next = setSoundInCode(next, choice.sound)
    } else if (!/\.bank\(/.test(next) && choice.bank) {
      next = setBankInCode(next, choice.bank)
    } else {
      next = setSoundInCode(next, choice.sound)
    }
  }
  if (choice.n != null) next = setNInCode(next, choice.n)
  if (choice.sound && role) next = applyVoiceClipToCode(next, choice.sound, role)
  return next
}

export function detectKitBank(tracks: { role: TrackRole; code: string }[]): string | null {
  const drum = tracks.find((t) => t.role === 'drums' || t.role === 'hihats' || t.role === 'fx')
  return drum ? getBankFromCode(drum.code) : null
}
