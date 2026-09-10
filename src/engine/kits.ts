import type { TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'
import { setBankInCode, setSoundInCode, setNInCode, getBankFromCode, getSoundFromCode, getNFromCode } from './code-effects'
import { KITS_A } from './kits-data-a'
import { KITS_B } from './kits-data-b'
import { KITS_C } from './kits-data-c'
import { KITS_D } from './kits-data-d'
import { KITS_E } from './kits-data-e'
import { KITS_F } from './kits-data-f'
import type { VibeId, VibeInfo, SoundChoice, KitTrack, Kit } from './kits-types'

export type { VibeId, VibeInfo, SoundChoice, KitTrack, Kit }

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

export function kitToTemplate(kit: Kit): Template {
  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    bpm: kit.bpm,
    tracks: kit.tracks.map((t) => ({
      name: t.name,
      role: t.role,
      code: t.code,
      color: ROLE_COLORS[t.role],
    })),
  }
}

/** Curated per-role sound choices for the Sound sheet. */
export const SOUND_CHOICES: Record<TrackRole, SoundChoice[]> = {
  drums: [
    { id: '909', label: '909 punch', bank: 'RolandTR909' },
    { id: '909-alt', label: '909 alt hit', bank: 'RolandTR909', n: 1 },
    { id: '808', label: '808 boom', bank: 'RolandTR808' },
    { id: '808-alt', label: '808 alt hit', bank: 'RolandTR808', n: 1 },
    { id: '707', label: '707 sharp', bank: 'RolandTR707' },
    { id: '606', label: '606 tick', bank: 'RolandTR606' },
    { id: '505', label: '505 light', bank: 'RolandTR505' },
    { id: 'mpc60', label: 'MPC60', bank: 'AkaiMPC60' },
    { id: 'sp12', label: 'SP-12', bank: 'EmuSP12' },
    { id: 'linn', label: 'Linn crisp', bank: 'LinnDrum' },
    { id: 'lm1', label: 'LM-1', bank: 'LinnLM1' },
    { id: 'dr110', label: 'DR-110', bank: 'BossDR110' },
    { id: 'dmx', label: 'DMX', bank: 'OberheimDMX' },
    { id: 'cr78', label: 'CR78 soft', bank: 'RolandCompurhythm78' },
    { id: 'lm2', label: 'LM-2', bank: 'LinnLM2' },
    { id: 'drumulator', label: 'Drumulator', bank: 'EmuDrumulator' },
    { id: 'drumtraks', label: 'DrumTraks', bank: 'SequentialCircuitsDrumtracks' },
    { id: 'r8', label: 'R-8', bank: 'RolandR8' },
    { id: 'sds5', label: 'SDS5', bank: 'SimmonsSDS5' },
    { id: 'dr550', label: 'DR-550', bank: 'BossDR550' },
    { id: 'sr16', label: 'SR-16', bank: 'AlesisSR16' },
    { id: '626', label: '626', bank: 'RolandTR626' },
    { id: 'xr10', label: 'XR-10', bank: 'AkaiXR10' },
    { id: 'rm50', label: 'RM-50', bank: 'YamahaRM50' },
    { id: 'mc303', label: 'MC-303', bank: 'RolandMC303' },
    { id: 'mfb512', label: 'MFB-512', bank: 'MFB512' },
    { id: 'dpm48', label: 'DPM-48', bank: 'SakataDPM48' },
    { id: 'spacedrum', label: 'Space Drum', bank: 'ViscoSpaceDrum' },
  ],
  hihats: [
    { id: '909', label: '909 hats', bank: 'RolandTR909' },
    { id: '808', label: '808 hats', bank: 'RolandTR808' },
    { id: '707', label: '707 hats', bank: 'RolandTR707' },
    { id: '606', label: '606 hats', bank: 'RolandTR606' },
    { id: '505', label: '505 hats', bank: 'RolandTR505' },
    { id: 'mpc60', label: 'MPC60 hats', bank: 'AkaiMPC60' },
    { id: 'sp12', label: 'SP-12 hats', bank: 'EmuSP12' },
    { id: 'linn', label: 'Linn hats', bank: 'LinnDrum' },
    { id: 'lm1', label: 'LM-1 hats', bank: 'LinnLM1' },
    { id: 'cr78', label: 'CR78 hats', bank: 'RolandCompurhythm78' },
    { id: 'lm2', label: 'LM-2 hats', bank: 'LinnLM2' },
    { id: 'drumulator', label: 'Drumulator hats', bank: 'EmuDrumulator' },
    { id: 'r8', label: 'R-8 hats', bank: 'RolandR8' },
    { id: 'sr16', label: 'SR-16 hats', bank: 'AlesisSR16' },
    { id: '626', label: '626 hats', bank: 'RolandTR626' },
    { id: 'rm50', label: 'RM-50 hats', bank: 'YamahaRM50' },
    { id: 'mc303', label: 'MC-303 hats', bank: 'RolandMC303' },
    { id: 'dr550', label: 'DR-550 hats', bank: 'BossDR550' },
  ],
  fx: [
    { id: '909', label: '909 clap', bank: 'RolandTR909' },
    { id: '808', label: '808 clap', bank: 'RolandTR808' },
    { id: '707', label: '707 clap', bank: 'RolandTR707' },
    { id: '505', label: '505 clap', bank: 'RolandTR505' },
    { id: 'mpc60', label: 'MPC60 snare', bank: 'AkaiMPC60' },
    { id: 'sp12', label: 'SP-12 rim', bank: 'EmuSP12' },
    { id: '727', label: '727 perc', bank: 'RolandTR727' },
    { id: 'linn', label: 'Linn snare', bank: 'LinnDrum' },
    { id: 'dmx', label: 'DMX clap', bank: 'OberheimDMX' },
    { id: 'cr78', label: 'CR78 perc', bank: 'RolandCompurhythm78' },
    { id: 'lm2', label: 'LM-2 clap', bank: 'LinnLM2' },
    { id: 'drumulator', label: 'Drumulator clap', bank: 'EmuDrumulator' },
    { id: 'r8', label: 'R-8 clap', bank: 'RolandR8' },
    { id: 'sr16', label: 'SR-16 snare', bank: 'AlesisSR16' },
    { id: '626', label: '626 clap', bank: 'RolandTR626' },
    { id: 'rm50', label: 'RM-50 clap', bank: 'YamahaRM50' },
    { id: 'mc303', label: 'MC-303 clap', bank: 'RolandMC303' },
    { id: 'sds5', label: 'SDS5 snare', bank: 'SimmonsSDS5' },
    { id: 'mfb512', label: 'MFB-512 clap', bank: 'MFB512' },
  ],
  bass: [
    { id: 'saw', label: 'Saw bass', sound: 'sawtooth' },
    { id: 'square', label: 'Square bass', sound: 'square' },
    { id: 'sine', label: 'Sine sub', sound: 'sine' },
    { id: 'tri', label: 'Triangle', sound: 'triangle' },
  ],
  lead: [
    { id: 'square', label: 'Square lead', sound: 'square' },
    { id: 'saw', label: 'Saw lead', sound: 'sawtooth' },
    { id: 'tri', label: 'Soft tri', sound: 'triangle' },
    { id: 'sine', label: 'Sine lead', sound: 'sine' },
    { id: 'piano', label: 'Piano lead', sound: 'piano' },
  ],
  pad: [
    { id: 'sine', label: 'Sine pad', sound: 'sine' },
    { id: 'tri', label: 'Tri pad', sound: 'triangle' },
    { id: 'saw', label: 'Saw pad', sound: 'sawtooth' },
    { id: 'square', label: 'Square pad', sound: 'square' },
    { id: 'piano', label: 'Piano pad', sound: 'piano' },
  ],
  arp: [
    { id: 'tri', label: 'Tri arp', sound: 'triangle' },
    { id: 'sine', label: 'Sine arp', sound: 'sine' },
    { id: 'square', label: 'Square arp', sound: 'square' },
    { id: 'saw', label: 'Saw arp', sound: 'sawtooth' },
  ],
  vox: [
    { id: 'mouth', label: 'Mouth', sound: 'mouth' },
  ],
  custom: [
    { id: 'saw', label: 'Saw', sound: 'sawtooth' },
    { id: 'sine', label: 'Sine', sound: 'sine' },
  ],
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
