import type { TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'
import { setBankInCode, setSoundInCode, getBankFromCode } from './code-effects'

export type VibeId = 'techno' | 'lofi' | 'ambient' | 'house'

export interface VibeInfo {
  id: VibeId
  label: string
}

export interface SoundChoice {
  id: string
  label: string
  bank?: string
  sound?: string
  /** Sample index for drum banks */
  n?: number
}

export interface KitTrack {
  name: string
  role: TrackRole
  code: string
}

export interface Kit {
  id: string
  vibe: VibeId
  name: string
  description: string
  bpm: number
  /** Primary drum machine bank for lock-kit shuffle */
  drumsBank: string
  tracks: KitTrack[]
}

export const VIBES: VibeInfo[] = [
  { id: 'techno', label: 'Techno' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'house', label: 'House' },
]

export const KITS: Kit[] = [
  // —— Techno ——
  {
    id: 'techno-punch909',
    vibe: 'techno',
    name: 'Punch 909',
    description: 'Classic punchy TR-909 kit',
    bpm: 128,
    drumsBank: 'RolandTR909',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR909").gain(1.15)' },
      { name: 'Hi-Hats', role: 'hihats', code: 's("~ hh ~ hh").bank("RolandTR909").gain(0.55)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR909").gain(0.85)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 c2 eb2 f2>").sound("sawtooth").lpf(700).lpq(6).gain(0.7)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,eb3,g3] [eb3,g3,bb3]>").sound("triangle").lpf(550).room(0.4).gain(0.28)' },
    ],
  },
  {
    id: 'techno-boom808',
    vibe: 'techno',
    name: 'Boom 808',
    description: 'Deep 808 body, darker hats',
    bpm: 130,
    drumsBank: 'RolandTR808',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR808").gain(1.25)' },
      { name: 'Hi-Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR808").gain(0.35).hpf(4000)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR808").room(0.2).gain(0.75)' },
      { name: 'Bass', role: 'bass', code: 'note("<c1 ~ c1 ~ eb1 ~ g1 ~>").sound("sine").lpf(180).gain(1.1)' },
      { name: 'Lead', role: 'lead', code: 'note("<c4 eb4 g4 bb4>*2").sound("square").lpf(1800).delay(0.2).gain(0.25)' },
    ],
  },
  {
    id: 'techno-crisp-linn',
    vibe: 'techno',
    name: 'Crisp Linn',
    description: 'Tight LinnDrum percussion',
    bpm: 126,
    drumsBank: 'LinnDrum',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd sd [~ bd] sd").bank("LinnDrum").gain(1.05)' },
      { name: 'Hi-Hats', role: 'hihats', code: 's("hh*16").bank("LinnDrum").gain(0.28)' },
      { name: 'Rim', role: 'fx', code: 's("~ rim ~ rim").bank("LinnDrum").gain(0.6)' },
      { name: 'Bass', role: 'bass', code: 'note("c2 ~ eb2 ~ f2 ~ g2 ~").sound("square").lpf(450).gain(0.65)' },
      { name: 'Arp', role: 'arp', code: 'note("<c3 eb3 g3 bb3>*8").sound("triangle").delay(0.4).delaytime(0.125).gain(0.22)' },
    ],
  },
  {
    id: 'techno-soft-cr78',
    vibe: 'techno',
    name: 'Soft CR78',
    description: 'Vintage Compurhythm texture',
    bpm: 120,
    drumsBank: 'RolandCompurhythm78',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ bd ~").bank("RolandCompurhythm78").gain(1.0)' },
      { name: 'Hi-Hats', role: 'hihats', code: 's("[hh oh] hh hh").bank("RolandCompurhythm78").gain(0.4)' },
      { name: 'Perc', role: 'fx', code: 's("~ cb ~ perc").bank("RolandCompurhythm78").room(0.35).gain(0.5)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 eb2 f2 ab2>").sound("triangle").lpf(600).gain(0.6)' },
      { name: 'Pad', role: 'pad', code: 'note("[c3,eb3,g3]").sound("sine").room(0.7).attack(0.2).gain(0.3)' },
    ],
  },
  // —— Lo-fi ——
  {
    id: 'lofi-dusty808',
    vibe: 'lofi',
    name: 'Dusty 808',
    description: 'Soft boom-bap 808',
    bpm: 85,
    drumsBank: 'RolandTR808',
    tracks: [
      { name: 'Drums', role: 'drums', code: 's("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(0.95)' },
      { name: 'Rim', role: 'fx', code: 's("~ rim ~ ~ rim ~ ~ rim").bank("RolandTR808").gain(0.45)' },
      { name: 'Hi-Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR808").gain("0.35 0.18 0.4 0.18 0.35 0.18 0.45 0.22").lpf(4500)' },
      { name: 'Chords', role: 'pad', code: 'note("<[c3,eb3,g3] [f3,ab3,c4] [eb3,g3,bb3] [ab3,c4,eb4]>").sound("triangle").lpf(1100).gain(0.32).attack(0.05)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 f2 eb2 ab2>").sound("sawtooth").lpf(380).gain(0.5)' },
    ],
  },
  {
    id: 'lofi-vinyl-linn',
    vibe: 'lofi',
    name: 'Vinyl Linn',
    description: 'Crisp breaks, warm keys',
    bpm: 88,
    drumsBank: 'LinnDrum',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ bd ~ bd ~ ~").bank("LinnDrum").gain(1.0)' },
      { name: 'Snare', role: 'fx', code: 's("~ sd ~ ~ ~ sd ~ ~").bank("LinnDrum").gain(0.8)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("LinnDrum").gain(0.3).lpf(5000)' },
      { name: 'Keys', role: 'pad', code: 'note("<[c3,e3,g3] [a2,c3,e3]>").sound("sine").room(0.5).lpf(1400).gain(0.28)' },
      { name: 'Bass', role: 'bass', code: 'note("c2 ~ ~ g1 ~ ~ eb2 ~").sound("triangle").lpf(320).gain(0.55)' },
    ],
  },
  {
    id: 'lofi-soft-cr78',
    vibe: 'lofi',
    name: 'Tape CR78',
    description: 'Round vintage kit',
    bpm: 80,
    drumsBank: 'RolandCompurhythm78',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ bd ~").bank("RolandCompurhythm78").gain(0.9)' },
      { name: 'Hats', role: 'hihats', code: 's("~ hh ~ hh").bank("RolandCompurhythm78").gain(0.35).lpf(3500)' },
      { name: 'Perc', role: 'fx', code: 's("~ ~ cp ~").bank("RolandCompurhythm78").room(0.4).gain(0.5)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,eb3,g3,bb3] [f3,ab3,c4]>").sound("sine").room(0.8).attack(0.3).gain(0.25)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ eb2 ~>").sound("sine").lpf(250).gain(0.6)' },
    ],
  },
  {
    id: 'lofi-909-chill',
    vibe: 'lofi',
    name: 'Chill 909',
    description: '909 swung soft',
    bpm: 92,
    drumsBank: 'RolandTR909',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ ~ bd ~ bd ~").bank("RolandTR909").gain(0.85)' },
      { name: 'Clap', role: 'fx', code: 's("~ ~ cp ~ ~ ~ cp ~").bank("RolandTR909").gain(0.55)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR909").gain(0.25).lpf(4000)' },
      { name: 'Lead', role: 'lead', code: 'note("<c4 eb4 g4>*2").sound("triangle").room(0.45).gain(0.2)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 g1 eb2 f2>").sound("sawtooth").lpf(420).gain(0.48)' },
    ],
  },
  // —— Ambient ——
  {
    id: 'ambient-soft-sine',
    vibe: 'ambient',
    name: 'Soft Sine',
    description: 'Sparse pulse + wide pads',
    bpm: 70,
    drumsBank: 'RolandCompurhythm78',
    tracks: [
      { name: 'Pulse', role: 'drums', code: 's("bd ~ ~ ~").bank("RolandCompurhythm78").gain(0.45).lpf(800)' },
      { name: 'Shimmer', role: 'hihats', code: 's("~ hh ~ ~").bank("RolandCompurhythm78").gain(0.15).room(0.8)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,eb3,g3,bb3] [ab2,c3,eb3,g3]>").sound("sine").room(0.95).attack(0.8).release(1.2).gain(0.35)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ ~ ~>").sound("sine").lpf(200).attack(0.4).gain(0.4)' },
      { name: 'Lead', role: 'lead', code: 'note("<c5 ~ eb5 ~>").sound("triangle").room(0.7).delay(0.4).gain(0.12)' },
    ],
  },
  {
    id: 'ambient-drone909',
    vibe: 'ambient',
    name: 'Drone 909',
    description: 'Distant 909 + evolving wash',
    bpm: 75,
    drumsBank: 'RolandTR909',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ ~ ~ ~ ~ ~").bank("RolandTR909").gain(0.5).lpf(600)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*4").bank("RolandTR909").gain(0.12).room(0.6)' },
      { name: 'Pad', role: 'pad', code: 'note("[c2,g2,c3]").sound("sawtooth").lpf(400).room(0.9).attack(1).gain(0.22)' },
      { name: 'Arp', role: 'arp', code: 'note("<c4 eb4 g4 bb4>*4").sound("sine").delay(0.5).room(0.5).gain(0.15)' },
      { name: 'FX', role: 'fx', code: 's("~ ~ oh ~").bank("RolandTR909").room(0.7).gain(0.25)' },
    ],
  },
  {
    id: 'ambient-linn-mist',
    vibe: 'ambient',
    name: 'Linn Mist',
    description: 'Soft percussion haze',
    bpm: 68,
    drumsBank: 'LinnDrum',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ bd ~ ~ ~ ~").bank("LinnDrum").gain(0.4).lpf(700)' },
      { name: 'Hats', role: 'hihats', code: 's("~ ~ hh ~").bank("LinnDrum").gain(0.18).room(0.5)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,e3,g3] [d3,f3,a3]>").sound("triangle").room(0.85).attack(0.6).gain(0.3)' },
      { name: 'Bass', role: 'bass', code: 'note("c2").sound("sine").lpf(180).gain(0.35)' },
      { name: 'Lead', role: 'lead', code: 'note("<g4 ~ a4 ~ c5 ~>").sound("sine").room(0.6).gain(0.14)' },
    ],
  },
  {
    id: 'ambient-808-bloom',
    vibe: 'ambient',
    name: '808 Bloom',
    description: 'Sub bloom + airy hats',
    bpm: 72,
    drumsBank: 'RolandTR808',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ ~").bank("RolandTR808").gain(0.7).lpf(500)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR808").gain(0.1).hpf(6000)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,eb3,g3] [f3,ab3,c4]>").sound("sine").room(1).attack(1).gain(0.32)' },
      { name: 'Bass', role: 'bass', code: 'note("<c1 ~ ~ eb1>").sound("sine").lpf(150).gain(0.7)' },
      { name: 'FX', role: 'fx', code: 's("~ ~ cp ~").bank("RolandTR808").room(0.8).gain(0.2)' },
    ],
  },
  // —— House ——
  {
    id: 'house-classic909',
    vibe: 'house',
    name: 'Classic 909',
    description: 'Four-on-floor 909 house',
    bpm: 122,
    drumsBank: 'RolandTR909',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR909").gain(1.2)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR909").gain("0.2 0.45 0.2 0.5 0.2 0.45 0.2 0.55")' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR909").gain(0.9)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ eb2 ~ f2 ~ g2 ~>").sound("sawtooth").lpf(500).gain(0.7)' },
      { name: 'Keys', role: 'pad', code: 'note("<[c3,e3,g3] [f3,a3,c4]>").sound("square").lpf(1600).room(0.3).gain(0.25)' },
    ],
  },
  {
    id: 'house-chic808',
    vibe: 'house',
    name: 'Chic 808',
    description: 'Disco-tinged 808',
    bpm: 118,
    drumsBank: 'RolandTR808',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR808").gain(1.15)' },
      { name: 'Hats', role: 'hihats', code: 's("[hh oh]*4").bank("RolandTR808").gain(0.4)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR808").gain(0.8)' },
      { name: 'Bass', role: 'bass', code: 'note("c2 eb2 f2 g2").sound("square").lpf(550).gain(0.65)' },
      { name: 'Lead', role: 'lead', code: 'note("<c5 eb5 g5>*2").sound("triangle").delay(0.25).gain(0.22)' },
    ],
  },
  {
    id: 'house-linn-groove',
    vibe: 'house',
    name: 'Linn Groove',
    description: 'Organic house pocket',
    bpm: 120,
    drumsBank: 'LinnDrum',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("LinnDrum").gain(1.1)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("LinnDrum").gain(0.38)' },
      { name: 'Snare', role: 'fx', code: 's("~ sd ~ sd").bank("LinnDrum").gain(0.75)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 c2 g1 g1>").sound("sawtooth").lpf(480).lpq(4).gain(0.68)' },
      { name: 'Pad', role: 'pad', code: 'note("[c3,e3,g3]").sound("sine").room(0.4).gain(0.22)' },
    ],
  },
  {
    id: 'house-cr78-disco',
    vibe: 'house',
    name: 'CR78 Disco',
    description: 'Retro four-on-floor',
    bpm: 116,
    drumsBank: 'RolandCompurhythm78',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandCompurhythm78").gain(1.05)' },
      { name: 'Hats', role: 'hihats', code: 's("hh hh oh hh").bank("RolandCompurhythm78").gain(0.42)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandCompurhythm78").gain(0.7)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ f2 ~ g2 ~ eb2 ~>").sound("triangle").lpf(520).gain(0.6)' },
      { name: 'Keys', role: 'lead', code: 'note("<c4 e4 g4 a4>").sound("square").lpf(2000).room(0.25).gain(0.2)' },
    ],
  },
  // —— Expanded banks (707 / 606 / 505 / MPC / SP-12 / LM-1 / DR-110 / 727 / DMX / RZ-1) ——
  {
    id: 'techno-acid707',
    vibe: 'techno',
    name: 'Acid 707',
    description: 'Sharp TR-707 techno with acid bass',
    bpm: 132,
    drumsBank: 'RolandTR707',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR707").gain(1.2)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR707").gain(0.4).hpf(5000)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR707").gain(0.85)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 c2 eb2 g1>").sound("sawtooth").lpf(900).lpq(12).gain(0.72)' },
      { name: 'Lead', role: 'lead', code: 'note("<c4 ~ eb4 g4>*2").sound("square").lpf(2200).delay(0.2).gain(0.22)' },
    ],
  },
  {
    id: 'techno-minimal606',
    vibe: 'techno',
    name: 'Minimal 606',
    description: 'Sparse TR-606 ticks and snare',
    bpm: 128,
    drumsBank: 'RolandTR606',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ bd ~").bank("RolandTR606").gain(1.1)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR606").gain(0.32)' },
      { name: 'Snare', role: 'fx', code: 's("~ sd ~ sd").bank("RolandTR606").gain(0.7)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ ~ g1>").sound("square").lpf(400).gain(0.68)' },
      { name: 'Pad', role: 'pad', code: 'note("[c3,eb3,g3]").sound("triangle").lpf(700).room(0.45).gain(0.24)' },
    ],
  },
  {
    id: 'techno-dmx-punch',
    vibe: 'techno',
    name: 'DMX Punch',
    description: 'Oberheim DMX body, industrial edge',
    bpm: 124,
    drumsBank: 'OberheimDMX',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("OberheimDMX").gain(1.15)' },
      { name: 'Hats', role: 'hihats', code: 's("~ hh ~ hh").bank("OberheimDMX").gain(0.5)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("OberheimDMX").gain(0.8)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 eb2 f2 g2>").sound("sawtooth").lpf(550).gain(0.7)' },
      { name: 'Lead', role: 'lead', code: 'note("<c5 ~ g4 ~>").sound("square").delay(0.3).gain(0.2)' },
    ],
  },
  {
    id: 'lofi-mpc60',
    vibe: 'lofi',
    name: 'MPC60 Dust',
    description: 'Classic MPC60 boom-bap pocket',
    bpm: 86,
    drumsBank: 'AkaiMPC60',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ bd ~ ~ bd ~").bank("AkaiMPC60").gain(1.0)' },
      { name: 'Snare', role: 'fx', code: 's("~ sd ~ ~ ~ sd ~ ~").bank("AkaiMPC60").gain(0.75)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("AkaiMPC60").gain(0.28).lpf(4800)' },
      { name: 'Keys', role: 'pad', code: 'note("<[c3,eb3,g3] [f3,ab3,c4]>").sound("piano").lpf(1600).room(0.4).gain(0.3)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ f2 ~>").sound("sine").lpf(280).gain(0.55)' },
    ],
  },
  {
    id: 'lofi-sp12',
    vibe: 'lofi',
    name: 'SP-12 Grain',
    description: 'E-mu SP-12 crunch and warm keys',
    bpm: 90,
    drumsBank: 'EmuSP12',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ bd ~ ~ bd ~ ~").bank("EmuSP12").gain(0.95)' },
      { name: 'Rim', role: 'fx', code: 's("~ rim ~ ~ rim ~ ~ ~").bank("EmuSP12").gain(0.5)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("EmuSP12").gain(0.26).lpf(4200)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,e3,g3] [a2,c3,e3]>").sound("triangle").room(0.55).lpf(1300).gain(0.28)' },
      { name: 'Bass', role: 'bass', code: 'note("c2 ~ g1 ~ eb2 ~ f2 ~").sound("sawtooth").lpf(360).gain(0.5)' },
    ],
  },
  {
    id: 'lofi-casio-rz1',
    vibe: 'lofi',
    name: 'Casio RZ-1',
    description: 'Toy-box RZ-1 lo-fi swing',
    bpm: 82,
    drumsBank: 'CasioRZ1',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ bd ~ ~ ~ ~").bank("CasioRZ1").gain(0.9)' },
      { name: 'Clap', role: 'fx', code: 's("~ ~ cp ~ ~ ~ cp ~").bank("CasioRZ1").gain(0.55)' },
      { name: 'Hats', role: 'hihats', code: 's("~ hh ~ hh").bank("CasioRZ1").gain(0.32).lpf(3800)' },
      { name: 'Piano', role: 'pad', code: 'note("<[c3,eb3,g3] [ab2,c3,eb3]>").sound("piano").room(0.6).attack(0.08).gain(0.26)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ eb2 ~>").sound("triangle").lpf(300).gain(0.5)' },
    ],
  },
  {
    id: 'ambient-lm1-haze',
    vibe: 'ambient',
    name: 'LM-1 Haze',
    description: 'Soft Linn LM-1 in the fog',
    bpm: 66,
    drumsBank: 'LinnLM1',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ ~").bank("LinnLM1").gain(0.4).lpf(750)' },
      { name: 'Hats', role: 'hihats', code: 's("~ hh ~ ~").bank("LinnLM1").gain(0.16).room(0.7)' },
      { name: 'Shaker', role: 'fx', code: 's("~ ~ sh ~").bank("LinnLM1").room(0.5).gain(0.22)' },
      { name: 'Pad', role: 'pad', code: 'note("<[c3,eb3,g3,bb3] [f3,ab3,c4]>").sound("sine").room(0.95).attack(0.9).gain(0.32)' },
      { name: 'Piano', role: 'lead', code: 'note("<c5 ~ eb5 ~>").sound("piano").room(0.7).gain(0.14)' },
    ],
  },
  {
    id: 'ambient-dr110-soft',
    vibe: 'ambient',
    name: 'DR-110 Soft',
    description: 'Boss DR-110 pulse under wide piano',
    bpm: 64,
    drumsBank: 'BossDR110',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd ~ ~ ~ ~ ~ ~ ~").bank("BossDR110").gain(0.45).lpf(650)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*4").bank("BossDR110").gain(0.12).room(0.55)' },
      { name: 'Ride', role: 'fx', code: 's("~ ~ rd ~").bank("BossDR110").room(0.75).gain(0.2)' },
      { name: 'Piano', role: 'pad', code: 'note("<[c3,e3,g3] [d3,f3,a3]>").sound("piano").room(0.9).attack(0.5).gain(0.28)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ ~ ~>").sound("sine").lpf(180).attack(0.4).gain(0.38)' },
    ],
  },
  {
    id: 'house-classic707',
    vibe: 'house',
    name: 'Classic 707',
    description: 'Four-on-floor TR-707 house',
    bpm: 122,
    drumsBank: 'RolandTR707',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR707").gain(1.18)' },
      { name: 'Hats', role: 'hihats', code: 's("hh*8").bank("RolandTR707").gain("0.22 0.48 0.22 0.52 0.22 0.48 0.22 0.55")' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR707").gain(0.88)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 ~ eb2 ~ f2 ~ g2 ~>").sound("sawtooth").lpf(520).gain(0.68)' },
      { name: 'Keys', role: 'pad', code: 'note("<[c3,e3,g3] [f3,a3,c4]>").sound("piano").lpf(1800).room(0.28).gain(0.24)' },
    ],
  },
  {
    id: 'house-505-groove',
    vibe: 'house',
    name: '505 Groove',
    description: 'Light TR-505 house pocket',
    bpm: 120,
    drumsBank: 'RolandTR505',
    tracks: [
      { name: 'Kick', role: 'drums', code: 's("bd*4").bank("RolandTR505").gain(1.1)' },
      { name: 'Hats', role: 'hihats', code: 's("[hh oh]*4").bank("RolandTR505").gain(0.4)' },
      { name: 'Clap', role: 'fx', code: 's("~ cp ~ cp").bank("RolandTR505").gain(0.78)' },
      { name: 'Bass', role: 'bass', code: 'note("c2 eb2 f2 g2").sound("square").lpf(560).gain(0.62)' },
      { name: 'Lead', role: 'lead', code: 'note("<c5 eb5 g5>*2").sound("triangle").delay(0.22).gain(0.2)' },
    ],
  },
  {
    id: 'house-727-latin',
    vibe: 'house',
    name: '727 Latin',
    description: 'TR-727 percussion house (perc + shaker)',
    bpm: 118,
    drumsBank: 'RolandTR727',
    tracks: [
      { name: 'Perc', role: 'drums', code: 's("perc*4").bank("RolandTR727").gain(0.85)' },
      { name: 'Shaker', role: 'hihats', code: 's("sh*8").bank("RolandTR727").gain(0.45)' },
      { name: 'Conga', role: 'fx', code: 's("~ perc ~ perc").bank("RolandTR727").room(0.25).gain(0.55)' },
      { name: 'Bass', role: 'bass', code: 'note("<c2 c2 g1 g1>").sound("sawtooth").lpf(480).gain(0.65)' },
      { name: 'Pad', role: 'pad', code: 'note("[c3,e3,g3]").sound("sine").room(0.35).gain(0.22)' },
    ],
  },
]

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
    { id: '808', label: '808 boom', bank: 'RolandTR808' },
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
  return next
}

export function detectKitBank(tracks: { role: TrackRole; code: string }[]): string | null {
  const drum = tracks.find((t) => t.role === 'drums' || t.role === 'hihats' || t.role === 'fx')
  return drum ? getBankFromCode(drum.code) : null
}
