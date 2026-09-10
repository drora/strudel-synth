import type { Kit } from './kits-types'

export const KITS_D: Kit[] = [

  // —— Rank A cherry-picks ——
  {
    id: 'house-lm2-pocket',
    vibe: 'house',
    name: 'LM-2 Pocket',
    description: 'Punchy Linn LM-2 house pocket',
    bpm: 120,
    drumsBank: 'LinnLM2',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("LinnLM2").gain(1.15)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("LinnLM2").gain(0.4)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("LinnLM2").gain(0.85)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 c2 g1 g1>").sound("sawtooth").lpf(500).lpq(4).gain(0.68)' },
      { name: 'Pad', role: 'pad', code: 'note("[c3,e3,g3]").sound("sine").room(0.35).gain(0.22)' },
    ],
  },
]
