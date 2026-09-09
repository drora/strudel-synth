import type { TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'
import { setBankInCode, setSoundInCode, setNInCode, getBankFromCode } from './code-effects'
import { KITS_A } from './kits-data-a'
import { KITS_B } from './kits-data-b'
import { KITS_C } from './kits-data-c'
import type { VibeId, VibeInfo, SoundChoice, KitTrack, Kit } from './kits-types'

export type { VibeId, VibeInfo, SoundChoice, KitTrack, Kit }

export const VIBES: VibeInfo[] = [
  { id: 'techno', label: 'Techno' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'house', label: 'House' },
]

export const KITS: Kit[] = [...KITS_A, ...KITS_B, ...KITS_C]

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
