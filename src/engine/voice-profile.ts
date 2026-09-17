/**
 * Per-voice gain + length profiles for sample loudness balance and stack-risk
 * (wash) auto-clip. Synths / unknowns default to gain 1, length held (no clip).
 */
import type { TrackRole } from './types'
import { parseEffectValue, setEffectInCode, removeEffectFromCode } from './code-effects'

export type VoiceLength = 'short' | 'held' | 'wash'
export type VoiceProfile = { gain: number; length: VoiceLength }

/** Default clip fractions we may auto-apply (and clear when leaving wash). */
const AUTO_CLIP_DEFAULTS = new Set([0.2, 0.35, 0.55])

export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  // wash (stack-risk long samples)
  padlong: { gain: 0.4, length: 'wash' },
  pad: { gain: 0.45, length: 'wash' },
  sax: { gain: 0.65, length: 'wash' },
  gtr: { gain: 0.7, length: 'wash' },
  saxello: { gain: 0.65, length: 'wash' },
  organ_8inch: { gain: 0.55, length: 'wash' },
  organ_full: { gain: 0.55, length: 'wash' },
  organ_4inch: { gain: 6, length: 'wash' },
  pipeorgan_loud: { gain: 0.5, length: 'wash' },
  pipeorgan_quiet: { gain: 1, length: 'wash' },
  wineglass: { gain: 12, length: 'wash' },
  wineglass_slow: { gain: 12, length: 'wash' },
  recorder_alto_sus: { gain: 6, length: 'wash' },
  recorder_bass_sus: { gain: 6, length: 'wash' },
  recorder_soprano_sus: { gain: 6, length: 'wash' },
  recorder_tenor_sus: { gain: 6, length: 'wash' },
  psaltery_bow: { gain: 0.7, length: 'wash' },
  // GM soundfonts (bowed strings) — stack-risk; auto-clip on melodic roles
  gm_string_ensemble_1: { gain: 0.5, length: 'wash' },
  gm_cello: { gain: 0.6, length: 'wash' },
  gm_violin: { gain: 0.7, length: 'wash' },

  // short — Dirt FX / one-shots (gain cuts for loud hits)
  hoover: { gain: 0.4, length: 'short' },
  stab: { gain: 0.5, length: 'short' },
  juno: { gain: 0.7, length: 'short' },
  pluck: { gain: 0.85, length: 'short' },
  arpy: { gain: 1, length: 'short' },
  jungbass: { gain: 0.75, length: 'short' },
  jvbass: { gain: 0.85, length: 'short' },
  wobble: { gain: 0.8, length: 'short' },
  bass: { gain: 0.85, length: 'short' },
  hmm: { gain: 1, length: 'short' },
  breath: { gain: 1, length: 'short' },
  diphone: { gain: 1, length: 'short' },
  speechless: { gain: 5, length: 'short' },

  // quiet sample boosts (was QUIET_SAMPLE_GAIN)
  marimba: { gain: 8, length: 'short' },
  glockenspiel: { gain: 8, length: 'short' },
  harp: { gain: 6, length: 'short' },
  folkharp: { gain: 6, length: 'short' },
  dantranh: { gain: 6, length: 'short' },
  ocarina: { gain: 6, length: 'short' },
  ocarina_small: { gain: 8, length: 'short' },
  wt_digital_basique: { gain: 5, length: 'short' },
}

const DEFAULT_PROFILE: VoiceProfile = { gain: 1, length: 'held' }

export function voiceKey(sound: string): string {
  return (sound.split(':')[0] ?? '').toLowerCase()
}

export function voiceProfile(sound: string): VoiceProfile {
  return VOICE_PROFILES[voiceKey(sound)] ?? DEFAULT_PROFILE
}

/** Compose / pad amp multiplier — keep this name for callers. */
export function sampleGainBoost(sound: string): number {
  return voiceProfile(sound).gain
}

/**
 * Auto-clip fraction for stack-risk wash samples, or null if none.
 * Synths / short / held → null. FX one-shots → null even if wash-tagged.
 */
export function defaultClipForVoice(sound: string, role: TrackRole): number | null {
  const profile = voiceProfile(sound)
  if (profile.length !== 'wash') return null
  if (role === 'lead' || role === 'arp' || role === 'bass') return 0.2
  if (role === 'pad') return 0.55
  if (role === 'custom' || role === 'vox') return 0.35
  // fx / drums / hihats — one-shots or non-melodic; no auto-clip
  return null
}

/** Shuffle suffix fragment: `.clip(n)` or empty. */
export function clipSuffix(sound: string, role: TrackRole): string {
  const n = defaultClipForVoice(sound, role)
  return n == null ? '' : `.clip(${n})`
}

/**
 * Apply or clear auto-clip for a voice swap.
 * - wash + no existing clip → set default
 * - wash + existing clip → leave (user override)
 * - leaving wash: remove only if clip is exactly one of our defaults
 */
export function applyVoiceClipToCode(code: string, sound: string, role: TrackRole): string {
  const want = defaultClipForVoice(sound, role)
  const cur = parseEffectValue(code, 'clip')
  if (want != null) {
    if (cur == null) return setEffectInCode(code, 'clip', want)
    return code
  }
  // Not wash (or role that skips clip): clear our auto defaults only
  if (cur != null && AUTO_CLIP_DEFAULTS.has(cur)) {
    return removeEffectFromCode(code, 'clip')
  }
  return code
}
