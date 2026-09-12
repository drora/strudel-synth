import type { TrackRole } from './types'
import { setBankInCode, setNInCode } from './code-effects'
import type { Density, FxBias, GrooveFamily } from './kits-types'
import { DRUM_POOLS, HAT_POOLS, FX_POOLS } from './reshuffle-pools'
import type { MixCard, SongSeed } from './song-seed'
import { mixChain } from './song-seed'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/** Banks that use sample names in s("...") instead of .bank("TidalDrumMachines"). */
export type DrumVoice =
  | 'bank'
  | 'nobank'
  | 'amen'
  | 'breaks'
  | 'gretsch'
  | 'electro'
  | 'jazz'
  | 'tabla'
  | 'mridangam'
  | 'vcsl'
  | 'perc727'

export function resolveDrumVoice(drumsBank: string): DrumVoice {
  switch (drumsBank) {
    case 'dirt-amen':
      return 'amen'
    case 'clean-breaks':
      return 'breaks'
    case 'dirt-gretsch':
      return 'gretsch'
    case 'dirt-electro':
      return 'electro'
    case 'dirt-jazz':
      return 'jazz'
    case 'dirt-tabla':
      return 'tabla'
    case 'mridangam':
      return 'mridangam'
    case 'vcsl':
      return 'vcsl'
    case 'RolandTR727':
      return 'perc727'
    case 'uzu':
    case 'uzu-wt':
    case 'piano':
    case 'vcsl-keys':
    case 'vcsl-organ':
      return 'nobank'
    default:
      return 'bank'
  }
}

function poolPick(groove: GrooveFamily, density: Density, kind: 'drums' | 'hihats' | 'fx'): string {
  const pools = kind === 'drums' ? DRUM_POOLS : kind === 'hihats' ? HAT_POOLS : FX_POOLS
  return pick(pools[groove][density])
}

/** Rewrite standard bd/hh/cp tokens into special-bank sample names. */
function voicePattern(body: string, voice: DrumVoice, role: TrackRole): string {
  switch (voice) {
    case 'amen': {
      if (role === 'drums') {
        return pick([
          'amencutup:0 amencutup:1 amencutup:2 amencutup:3',
          'amencutup:0 ~ amencutup:2 amencutup:4',
          'amencutup:1 amencutup:3 amencutup:5 amencutup:7',
          'amencutup:0 amencutup:2 ~ amencutup:6',
        ])
      }
      if (role === 'fx') {
        return pick(['~ amencutup:5 ~ amencutup:8', '~ amencutup:4 ~ amencutup:9', 'amencutup:3 ~ amencutup:6 ~'])
      }
      // Hats must use amen voice — never leftover hh.
      return pick(['~ amencutup:3 ~ amencutup:7', 'amencutup:2 ~ amencutup:6 ~', '~ amencutup:8 ~ amencutup:10'])
    }
    case 'breaks': {
      if (role === 'drums') {
        return pick([
          'breaks165:0 breaks165:1 breaks165:2 breaks165:3',
          'breaks165:0 ~ breaks165:2 breaks165:4',
          'breaks157:0 breaks157:1 breaks157:2 breaks157:3',
        ])
      }
      if (role === 'fx') {
        return pick(['~ breaks157:2 ~ breaks157:4', '~ breaks165:5 ~ breaks165:7', 'breaks157:1 ~ breaks157:3 ~'])
      }
      return pick(['~ breaks165:3 ~ breaks165:6', 'breaks157:2 ~ breaks157:5 ~', '~ breaks165:7 ~ breaks165:2'])
    }
    case 'gretsch': {
      return body
        .replace(/\bbd\b/g, 'gretsch:0')
        .replace(/\bsd\b/g, 'gretsch:1')
        .replace(/\bcp\b/g, 'gretsch:1')
        .replace(/\brim\b/g, 'gretsch:1')
        .replace(/\bhh\b/g, 'gretsch:2')
        .replace(/\boh\b/g, 'gretsch:2')
    }
    case 'electro': {
      return body
        .replace(/\bbd\b/g, 'electro1:0')
        .replace(/\bsd\b/g, 'electro1:1')
        .replace(/\bcp\b/g, 'electro1:1')
        .replace(/\brim\b/g, 'electro1:1')
        .replace(/\bhh\b/g, 'electro1:2')
        .replace(/\boh\b/g, 'electro1:2')
    }
    case 'jazz': {
      return body
        .replace(/\bbd\b/g, 'jazz:0')
        .replace(/\bsd\b/g, 'jazz:1')
        .replace(/\bcp\b/g, 'jazz:1')
        .replace(/\brim\b/g, 'jazz:1')
        .replace(/\bhh\b/g, 'jazz:2')
        .replace(/\boh\b/g, 'jazz:2')
    }
    case 'tabla': {
      if (role === 'drums') {
        return pick([
          'tabla:0 ~ tabla:2 ~ tabla:4 ~ tabla:1 ~',
          'tabla:0 tabla:1 ~ tabla:3 ~ tabla:2 ~',
          'tabla:4 ~ tabla:0 ~ tabla:2 tabla:1 ~',
        ])
      }
      if (role === 'hihats') {
        return pick(['~ tabla2:1 ~ tabla2:3', 'tabla2:0 ~ tabla2:2 ~', '~ tabla2:2 ~ tabla2:0'])
      }
      return pick(['~ ~ tablex:0 ~', '~ tablex:0 ~ ~', 'tablex:0 ~ ~ tablex:0'])
    }
    case 'mridangam': {
      if (role === 'drums') {
        return pick([
          'mridangam_tha ~ ~ mridangam_thom',
          'mridangam_tha ~ mridangam_thom ~',
          'mridangam_thom ~ ~ mridangam_tha',
        ])
      }
      if (role === 'hihats') {
        return pick(['~ mridangam_nam ~ mridangam_ki', 'mridangam_nam ~ mridangam_ki ~', '~ mridangam_ki ~ mridangam_nam'])
      }
      return pick(['~ ~ mridangam_chaapu ~', 'mridangam_chaapu ~ ~ ~', '~ mridangam_chaapu ~ ~'])
    }
    case 'vcsl': {
      return body
        .replace(/\bbd\b/g, pick(['bassdrum1', 'bassdrum2']))
        .replace(/\bsd\b/g, pick(['snare_modern', 'snare_low']))
        .replace(/\bcp\b/g, 'snare_modern')
        .replace(/\brim\b/g, 'snare_low')
        .replace(/\bhh\b/g, 'hihat')
        .replace(/\boh\b/g, 'hihat')
    }
    case 'perc727': {
      return body
        .replace(/\bbd\b/g, 'perc')
        .replace(/\bsd\b/g, 'perc')
        .replace(/\bcp\b/g, 'perc')
        .replace(/\brim\b/g, 'perc')
        .replace(/\bhh\b/g, 'sh')
        .replace(/\boh\b/g, 'sh')
    }
    default:
      return body
  }
}

function hatGainPattern(density: Density, bias: FxBias): string {
  if (bias === 'roomy' || density === 'low') {
    return pick(['.gain(0.22)', '.gain(0.28)', '.gain(0.18).lpf(4000)', '.gain(0.25).lpf(4500)'])
  }
  if (density === 'high') {
    return pick([
      '.gain(0.35)',
      '.gain("0.8 0.5 0.9 0.5 0.7 0.4 0.8 0.5")',
      '.gain(0.3)',
      '.gain("0.2 0.45 0.2 0.5 0.2 0.45 0.2 0.55")',
    ])
  }
  return pick(['.gain(0.4)', '.gain(0.38)', '.gain(0.45)', '.gain("0.35 0.18 0.4 0.18 0.35 0.18 0.45 0.22")'])
}

function densityGain(density: Density, role: TrackRole): number {
  const base =
    role === 'drums' ? 1.05
    : role === 'hihats' ? 0.4
    : role === 'fx' ? 0.7
    : 0.4
  const mul = density === 'high' ? 1.08 : density === 'low' ? 0.85 : 1
  return +(base * mul).toFixed(2)
}

function finishDrumLine(
  body: string,
  role: TrackRole,
  bank: string | null | undefined,
  voice: DrumVoice,
  density: Density,
  bias: FxBias,
  pinN?: number,
  mix?: MixCard | null,
): string {
  const voiced = voicePattern(body, voice, role)
  let line = `s("${voiced}")`
  const useBank = voice === 'bank' || voice === 'perc727'
  if (useBank && bank) line = setBankInCode(line, bank)
  if (pinN != null && useBank) line = setNInCode(line, pinN)

  if (mix) {
    line += mixChain(role, mix)
    return line
  }

  if (role === 'hihats') {
    line += hatGainPattern(density, bias)
    if (bias === 'filtered') line += pick(['.hpf(4000)', '.hpf(5000)', '.lpf(5000)', ''])
    if (bias === 'roomy') line += pick(['.room(0.5)', '.room(0.7)', '.room(0.6)', ''])
  } else if (role === 'fx') {
    const g = densityGain(density, 'fx')
    line += `.gain(${g})`
    if (bias === 'roomy') line += pick(['.room(0.5)', '.room(0.7)', '.room(0.8)', ''])
    else line += pick(['.room(0.2)', '.room(0.3)', '', ''])
  } else {
    const g = densityGain(density, 'drums')
    line += `.gain(${g})`
    if (bias === 'roomy' || density === 'low') line += pick(['.lpf(800)', '.lpf(600)', '.lpf(700)', ''])
  }
  return line
}


function pickHatForKick(groove: GrooveFamily, density: Density, kick?: string): string {
  const pool = HAT_POOLS[groove][density]
  if (kick && /bd\*4|bd bd bd bd/.test(kick)) {
    const off = pool.filter((p) => /~|oh|\*8|\*16|\(/.test(p))
    if (off.length) return pick(off)
  }
  return pick(pool)
}

function pickFxForKick(groove: GrooveFamily, density: Density, kick?: string): string {
  const pool = FX_POOLS[groove][density]
  if (kick && /\bsd\b/.test(kick)) {
    const noSd = pool.filter((p) => !/\bsd\b/.test(p))
    if (noSd.length) return pick(noSd)
  }
  return pick(pool)
}

export function generateDrumRole(
  role: 'drums' | 'hihats' | 'fx',
  groove: GrooveFamily,
  density: Density,
  bank: string | null | undefined,
  bias: FxBias,
  pinN?: number,
  seed?: SongSeed | null,
): string {
  const voice = bank ? resolveDrumVoice(bank) : 'bank'
  const budgetD = seed?.budget?.[role] ?? density
  const kick = seed?.kickClock
  let body: string
  if (role === 'drums') body = kick ?? poolPick(groove, budgetD, 'drums')
  else if (role === 'hihats') body = pickHatForKick(groove, budgetD, kick)
  else body = pickFxForKick(groove, budgetD, kick)
  return finishDrumLine(body, role, bank, voice, budgetD, bias, pinN, seed?.mix)
}
