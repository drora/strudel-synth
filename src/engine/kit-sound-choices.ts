/**
 * Kit-scoped Sound sheet choices — prioritize the active kit's drumsBank /
 * melodicSounds / special-voice samples so tiles match what Shuffle generates.
 */
import type { TrackRole } from './types'
import type { Kit, SoundChoice } from './kits-types'
import { resolveShuffleProfile } from './kits-types'
import { SOUND_CHOICES } from './kits-sound-choices'
import { resolveDrumVoice, type DrumVoice } from './reshuffle-drums'

const MELODIC_ROLES = new Set<TrackRole>(['bass', 'lead', 'pad', 'arp', 'vox', 'custom'])
const DRUM_ROLES = new Set<TrackRole>(['drums', 'hihats', 'fx'])

function tile(id: string, label: string, sound: string): SoundChoice {
  return { id, label, sound }
}

function rangeTiles(prefix: string, labelPrefix: string, sample: string, from: number, to: number): SoundChoice[] {
  const out: SoundChoice[] = []
  for (let i = from; i <= to; i++) {
    out.push(tile(`${prefix}-${i}`, `${labelPrefix} ${i}`, `${sample}:${i}`))
  }
  return out
}

/** Melodic-style list: kit melodicSounds first, then role globals (dedupe by sound). */
function melodicStyleForRole(role: TrackRole, kit: Kit): SoundChoice[] {
  const profile = resolveShuffleProfile(kit)
  const globals = SOUND_CHOICES[role] ?? SOUND_CHOICES.custom
  const out: SoundChoice[] = []
  const seen = new Set<string>()

  for (const s of profile.melodicSounds) {
    if (seen.has(s)) continue
    seen.add(s)
    const existing = globals.find((c) => c.sound === s)
    out.push(existing ?? tile(`kit-${s}`, s, s))
  }
  for (const c of globals) {
    if (!c.sound || seen.has(c.sound)) continue
    seen.add(c.sound)
    out.push(c)
  }
  return out
}

/** Bank voice: kit.drumsBank tiles first, then the rest (dedupe by id). */
function prioritizeBank(role: TrackRole, drumsBank: string): SoundChoice[] {
  const globals = SOUND_CHOICES[role] ?? []
  const primary = globals.filter((c) => c.bank === drumsBank)
  const rest = globals.filter((c) => c.bank !== drumsBank)
  const seen = new Set<string>()
  const out: SoundChoice[] = []
  for (const c of [...primary, ...rest]) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

/** Kit-native sample tiles for special drum voices (not the global TR bank list). */
function specialVoiceChoices(voice: DrumVoice, role: TrackRole, kit: Kit): SoundChoice[] {
  switch (voice) {
    case 'tabla': {
      if (role === 'drums') return rangeTiles('tabla', 'Tabla', 'tabla', 0, 4)
      if (role === 'hihats') return rangeTiles('tabla2', 'Tabla2', 'tabla2', 0, 3)
      if (role === 'fx') return rangeTiles('tablex', 'Tablex', 'tablex', 0, 1)
      return []
    }
    case 'mridangam': {
      if (role === 'drums') {
        return [
          tile('mrid-tha', 'Tha', 'mridangam_tha'),
          tile('mrid-thom', 'Thom', 'mridangam_thom'),
        ]
      }
      if (role === 'hihats') {
        return [
          tile('mrid-nam', 'Nam', 'mridangam_nam'),
          tile('mrid-ki', 'Ki', 'mridangam_ki'),
        ]
      }
      if (role === 'fx') return [tile('mrid-chaapu', 'Chaapu', 'mridangam_chaapu')]
      return []
    }
    case 'amen': {
      // Amen chops are useful on drums/fx; also offer on hats so the sheet is never empty.
      return rangeTiles('amen', 'Amen', 'amencutup', 0, 8)
    }
    case 'breaks': {
      return [
        ...rangeTiles('breaks165', 'Breaks165', 'breaks165', 0, 4),
        ...rangeTiles('breaks157', 'Breaks157', 'breaks157', 0, 4),
      ]
    }
    case 'gretsch':
      return rangeTiles('gretsch', 'Gretsch', 'gretsch', 0, 2)
    case 'electro':
      return rangeTiles('electro', 'Electro', 'electro1', 0, 2)
    case 'jazz':
      return rangeTiles('jazz', 'Jazz', 'jazz', 0, 2)
    case 'vcsl': {
      if (role === 'hihats') return [tile('vcsl-hh', 'Hihat', 'hihat')]
      const drums = [
        tile('vcsl-bd1', 'Bassdrum 1', 'bassdrum1'),
        tile('vcsl-bd2', 'Bassdrum 2', 'bassdrum2'),
        tile('vcsl-sn-mod', 'Snare modern', 'snare_modern'),
        tile('vcsl-sn-low', 'Snare low', 'snare_low'),
      ]
      if (role === 'drums') return drums
      if (role === 'fx') return drums.slice(2)
      return drums
    }
    case 'perc727': {
      const globals = SOUND_CHOICES[role] ?? []
      const tr727 = globals.filter((c) => c.bank === 'RolandTR727')
      if (tr727.length) return tr727
      return [{ id: '727', label: '727 perc', bank: 'RolandTR727' }]
    }
    case 'nobank':
      // Dirt/uzu mini-notation samples Shuffle writes (no .bank()) — not synths.
      // Uzu Core Clap must list cp/sd/rim/… (not saw/triangle from melodicSounds).
      return nobankNativeChoices(role)
    default:
      return []
  }
}

/** Native dirt sample tiles for nobank kits (uzu/piano/vcsl-keys/…); one path for all. */
function nobankNativeChoices(role: TrackRole): SoundChoice[] {
  if (role === 'drums') {
    return [
      tile('dirt-bd', 'Kick', 'bd'),
      tile('dirt-sd', 'Snare', 'sd'),
    ]
  }
  if (role === 'hihats') {
    return [
      tile('dirt-hh', 'Closed', 'hh'),
      tile('dirt-oh', 'Open', 'oh'),
    ]
  }
  if (role === 'fx') {
    return [
      tile('dirt-cp', 'Clap', 'cp'),
      tile('dirt-sd-fx', 'Snare', 'sd'),
      tile('dirt-rim', 'Rim', 'rim'),
      tile('dirt-perc', 'Perc', 'perc'),
      tile('dirt-cb', 'Cowbell', 'cb'),
      tile('dirt-rd', 'Ride', 'rd'),
    ]
  }
  return []
}

/**
 * Sound sheet tiles for a role given the active kit.
 * - Melodic: kit melodicSounds first, then global role choices.
 * - Drum bank voice: kit.drumsBank first among SOUND_CHOICES[role].
 * - Special voices: kit-native samples only (tabla/amen/…).
 * - Nobank (uzu/piano/vcsl-keys/…): dirt sample tiles (bd/sd/cp/…) by role — not synths.
 * - No kit: unchanged SOUND_CHOICES[role].
 */
export function soundChoicesForKit(role: TrackRole, kit: Kit | null | undefined): SoundChoice[] {
  if (!kit) return SOUND_CHOICES[role] ?? SOUND_CHOICES.custom

  if (MELODIC_ROLES.has(role)) {
    return melodicStyleForRole(role, kit)
  }

  if (DRUM_ROLES.has(role)) {
    const voice = resolveDrumVoice(kit.drumsBank)
    if (voice === 'bank') return prioritizeBank(role, kit.drumsBank)
    return specialVoiceChoices(voice, role, kit)
  }

  return SOUND_CHOICES[role] ?? SOUND_CHOICES.custom
}
