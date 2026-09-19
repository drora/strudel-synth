import type { SoundChoice } from './kits-types'

export const SOUND_FAMILY_ORDER = [
  'Synths',
  'Keys',
  'Bass',
  'Guitar',
  'Strings',
  'Winds',
  'Brass',
  'Pads/Choir',
  'World',
  'Organ/WT',
  'Drums/Bank',
  'FX',
  'Mic',
  'Other',
] as const

export type SoundFamily = (typeof SOUND_FAMILY_ORDER)[number]

export interface SoundChoiceGroup {
  family: SoundFamily
  items: SoundChoice[]
}

const has = (value: string, pattern: RegExp) => pattern.test(value)

/** Classify one Sound tile without changing or filtering the source catalog. */
export function soundFamilyForChoice(choice: SoundChoice): SoundFamily {
  const id = (choice.id ?? '').toLowerCase().replace(/[- ]+/g, '_')
  const label = (choice.label ?? '').toLowerCase().replace(/[- ]+/g, '_')
  const sound = (choice.sound ?? '').toLowerCase().replace(/[- ]+/g, '_')
  const bank = (choice.bank ?? '').toLowerCase()
  // Underscore-join so (^|_)…(_|$) anchors work across fields
  const blob = [id, label, sound, bank].filter(Boolean).join('_')

  if (has(blob, /(^|_)jam_mic_|(^|_)rec_/) || sound.startsWith('jam_mic_')) return 'Mic'
  if (choice.bank) return 'Drums/Bank'

  // Dirt / VCSL FX one-shots (exact sounds / ids — avoid psaltery_pluck false positive)
  if (
    ['pad', 'padlong', 'stab', 'hoover', 'pluck', 'juno', 'fm', 'didgeridoo'].includes(sound) ||
    has(id, /^(dirt_pad|padlong|stab|hoover|pluck|juno|dirt_fm|didgeridoo)$/) ||
    has(blob, /gm_fx_|gm_orchestra_hit|gm_timpani|gm_steel_drums/) ||
    has(sound, /^wt_digital_(bad_day|crickets|curses|echoes)$/)
  ) {
    return 'FX'
  }

  // Melodic families before broad drum heuristics (gm_*_jazz must not become Drums)
  if (has(blob, /(^|_)(saw|sawtooth|square|sine|triangle|arpy|sid|super64|gm_lead)(_|$)/)) {
    return 'Synths'
  }
  if (
    has(
      blob,
      /(^|_)(piano|epiano|fmpiano|kawai|steinway|harpsichord|clavinet|clavisynth|celesta|music_box|vibraphone|marimba|xylophone|glockenspiel|tubularbells|tubular_bells|dulcimer|balafon|wineglass)(_|$)/,
    )
  ) {
    return 'Keys'
  }
  if (has(blob, /(^|_)(guitar|gtr|strumstick)(_|$)/)) return 'Guitar'
  if (
    has(
      blob,
      /(^|_)(violin|viola|cello|contrabass|fiddle|pizzicato|strings?|orchestral_harp|folkharp|harp)(_|$)/,
    )
  ) {
    return 'Strings'
  }
  if (has(blob, /(^|_)(trumpet|trombone|tuba|french_horn|brass)(_|$)/)) return 'Brass'
  if (
    has(
      blob,
      /(^|_)(sax|saxello|bassoon|oboe|english_horn|clarinet|piccolo|flute|recorder|blown_bottle|whistle|ocarina|shakuhachi)(_|$)/,
    )
  ) {
    return 'Winds'
  }
  if (
    has(
      blob,
      /(^|_)(gm_pad|choir|voice_oohs|synth_choir|hmm|speechless|breath|diphone)(_|$)/,
    )
  ) {
    return 'Pads/Choir'
  }
  if (
    has(
      blob,
      /(^|_)(sitar|dantranh|psaltery|shamisen|koto|kalimba|bagpipe|shanai|banjo|accordion|harmonica)(_|$)/,
    )
  ) {
    return 'World'
  }
  if (
    has(blob, /(^|_)(organ|pipeorgan|bandoneon|wavetable)(_|$)/) ||
    has(sound, /^wt_/) ||
    has(id, /^wt_/)
  ) {
    return 'Organ/WT'
  }
  if (
    has(
      blob,
      /(^|_)(acoustic_bass|electric_bass|fretless_bass|slap_bass|synth_bass|jvbass|jungbass|wobble)(_|$)/,
    ) ||
    (has(blob, /(^|_)bass(_|$)/) && !has(blob, /recorder/))
  ) {
    return 'Bass'
  }

  // Drum / bank samples after melodic checks
  if (
    has(sound, /^(tabla|tabla2|tablex|mridangam|amencutup|breaks165|breaks157|gretsch|electro1|jazz)(:|_|\d|$)/) ||
    has(
      id,
      /^(tabla|tabla2|tablex|mrid|amen|breaks|gretsch|electro|jazz|vcsl_|dirt_bd|dirt_sd|dirt_hh|dirt_oh|dirt_cp|dirt_rim|dirt_perc|dirt_cb|dirt_rd|727)/,
    ) ||
    has(
      blob,
      /(^|_)(bassdrum|snare|hihat|dirt_bd|dirt_sd|dirt_hh|dirt_oh|dirt_cp|dirt_rim|dirt_perc|dirt_cb|dirt_rd)(_|:|$)/,
    )
  ) {
    return 'Drums/Bank'
  }

  return 'Other'
}

/** Group in stable family order while preserving catalog order and every tile. */
export function groupSoundChoices(choices: readonly SoundChoice[]): SoundChoiceGroup[] {
  const buckets = new Map<SoundFamily, SoundChoice[]>()
  for (const choice of choices) {
    const family = soundFamilyForChoice(choice)
    const items = buckets.get(family)
    if (items) items.push(choice)
    else buckets.set(family, [choice])
  }

  return SOUND_FAMILY_ORDER.flatMap((family) => {
    const items = buckets.get(family)
    return items?.length ? [{ family, items }] : []
  })
}

/** Alias kept for call sites / docs. */
export const groupSoundChoicesByFamily = groupSoundChoices
