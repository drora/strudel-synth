import type { Template } from '../../engine/types'
import { ROLE_COLORS } from '../../engine/types'

export const templates: Template[] = [
  {
    id: 'techno',
    name: 'Techno',
    description: 'Dark, driving four-on-the-floor with acid bass and atmospheric pads',
    bpm: 128,
    tracks: [
      {
        name: 'Kick',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd*4").gain(1.2)',
      },
      {
        name: 'Hi-Hats',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("~ hh ~ hh").gain(0.6)',
      },
      {
        name: 'Clap',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("~ cp ~ cp").gain(0.8)',
      },
      {
        name: 'Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("<c2 c2 eb2 f2>")\n  .s("sawtooth")\n  .lpf(800)\n  .lpq(8)\n  .gain(0.7)',
      },
      {
        name: 'Pad',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<c3 eb3 g3, eb3 g3 bb3>")\n  .s("triangle")\n  .lpf(600)\n  .attack(0.1)\n  .release(0.5)\n  .gain(0.3)',
      },
    ],
  },
  {
    id: 'lofi',
    name: 'Lo-Fi',
    description: 'Chill dusty beats with warm chords and vinyl crackle vibes',
    bpm: 85,
    tracks: [
      {
        name: 'Drums',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd ~ ~ bd ~ ~ bd ~").gain(0.9)',
      },
      {
        name: 'Rim',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("~ rim ~ ~ rim ~ ~ rim").gain(0.5)',
      },
      {
        name: 'Hi-Hats',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("hh*8")\n  .gain("0.4 0.2 0.5 0.2 0.4 0.2 0.5 0.3")\n  .lpf(4000)',
      },
      {
        name: 'Chords',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<[c3,eb3,g3] [f3,ab3,c4] [eb3,g3,bb3] [ab3,c4,eb4]>")\n  .s("triangle")\n  .lpf(1200)\n  .gain(0.35)\n  .attack(0.05)\n  .release(0.3)',
      },
      {
        name: 'Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("<c2 f2 eb2 ab2>")\n  .s("sawtooth")\n  .lpf(400)\n  .gain(0.5)',
      },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Stripped-back hypnotic groove with subtle evolving textures',
    bpm: 124,
    tracks: [
      {
        name: 'Kick',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd ~ ~ ~ bd ~ ~ ~").gain(1)',
      },
      {
        name: 'Rim',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("~ ~ rim ~ ~ ~ rim ~").gain(0.6)',
      },
      {
        name: 'Shaker',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("[~ hh]*4").gain(0.3).lpf(6000)',
      },
      {
        name: 'Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("c2 ~ ~ c2 ~ ~ eb2 ~")\n  .s("square")\n  .lpf(500)\n  .gain(0.6)',
      },
      {
        name: 'Texture',
        role: 'lead',
        color: ROLE_COLORS.lead,
        code: 'note("<c4 eb4 g4 bb4>")\n  .s("triangle")\n  .lpf(2000)\n  .gain(0.15)\n  .release(0.8)',
      },
    ],
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop',
    description: 'Boom bap drums with deep 808 bass and jazzy chords',
    bpm: 90,
    tracks: [
      {
        name: 'Kick',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd ~ ~ bd ~ ~ bd ~").gain(1.3)',
      },
      {
        name: 'Snare',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("~ sd ~ ~ ~ sd ~ ~").gain(0.9)',
      },
      {
        name: 'Hi-Hats',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("hh*8")\n  .gain("0.6 0.3 0.7 0.3 0.5 0.3 0.8 0.4")\n  .lpf(5000)',
      },
      {
        name: '808 Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("<c1 ~ c1 ~ eb1 ~ ~ ~>")\n  .s("sine")\n  .gain(1.2)\n  .lpf(200)\n  .decay(0.3)\n  .sustain(0.4)',
      },
      {
        name: 'Keys',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<[eb3,g3,bb3] ~ [f3,ab3,c4] ~>")\n  .s("sine")\n  .room(0.4)\n  .gain(0.25)\n  .attack(0.05)\n  .release(0.4)',
      },
    ],
  },
  {
    id: 'ambient',
    name: 'Ambient',
    description: 'Ethereal pads, gentle textures, and deep space reverb',
    bpm: 72,
    tracks: [
      {
        name: 'Pad',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<[c3,eb3,g3,bb3] [ab2,c3,eb3,g3]>")\n  .s("sine")\n  .room(1.5)\n  .roomsize(4)\n  .gain(0.3)\n  .attack(0.5)\n  .release(2)',
      },
      {
        name: 'Texture',
        role: 'lead',
        color: ROLE_COLORS.lead,
        code: 'note("<c5 eb5 g5 bb5>*2")\n  .s("triangle")\n  .delay(0.6)\n  .delaytime(0.25)\n  .delayfeedback(0.6)\n  .gain(0.12)\n  .room(1)',
      },
      {
        name: 'Sub',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("<c2 ~ ~ ~ ab1 ~ ~ ~>")\n  .s("sine")\n  .gain(0.5)\n  .lpf(120)\n  .attack(0.2)\n  .release(1)',
      },
      {
        name: 'Noise',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("noise")\n  .gain(0.04)\n  .lpf(800)\n  .hpf(300)\n  .room(2)',
      },
    ],
  },
  {
    id: 'dnb',
    name: 'Drum & Bass',
    description: 'Fast breakbeats with rolling bass and sharp percussion',
    bpm: 174,
    tracks: [
      {
        name: 'Break',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd [~ sd] bd [sd ~]").gain(1.1)',
      },
      {
        name: 'Hi-Hats',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("hh*16")\n  .gain("0.5 0.2 0.4 0.2 0.6 0.2 0.3 0.2 0.5 0.2 0.4 0.2 0.7 0.2 0.3 0.2")\n  .lpf(8000)',
      },
      {
        name: 'Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("c2 ~ c2 eb2 ~ c2 ~ g1")\n  .s("sawtooth")\n  .lpf(600)\n  .lpq(5)\n  .gain(0.8)',
      },
      {
        name: 'Pad',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<[c3,eb3,g3] [bb2,d3,f3]>")\n  .s("triangle")\n  .room(0.6)\n  .gain(0.2)\n  .attack(0.1)\n  .release(0.5)',
      },
    ],
  },
  {
    id: 'house',
    name: 'House',
    description: 'Four-on-the-floor groove with funky bass and warm chords',
    bpm: 122,
    tracks: [
      {
        name: 'Kick',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd*4").gain(1.1)',
      },
      {
        name: 'Hats',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("~ hh ~ hh")\n  .gain(0.5)\n  .lpf(7000)',
      },
      {
        name: 'Clap',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("~ cp ~ ~")\n  .gain(0.7)\n  .room(0.3)',
      },
      {
        name: 'Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("c2 ~ c2 c2 ~ c2 eb2 ~")\n  .s("sawtooth")\n  .lpf(900)\n  .gain(0.7)',
      },
      {
        name: 'Chords',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<[c3,e3,g3] [f3,a3,c4] [a2,c3,e3] [g2,b2,d3]>")\n  .s("triangle")\n  .lpf(2000)\n  .room(0.4)\n  .gain(0.25)',
      },
    ],
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Retro 80s vibes with lush pads, gated drums, and neon arps',
    bpm: 118,
    tracks: [
      {
        name: 'Kick',
        role: 'drums',
        color: ROLE_COLORS.drums,
        code: 's("bd*4").gain(1)',
      },
      {
        name: 'Snare',
        role: 'fx',
        color: ROLE_COLORS.fx,
        code: 's("~ sd ~ sd")\n  .gain(0.8)\n  .room(0.5)',
      },
      {
        name: 'Hi-Hats',
        role: 'hihats',
        color: ROLE_COLORS.hihats,
        code: 's("hh*8")\n  .gain("0.5 0.3 0.6 0.3")\n  .lpf(6000)',
      },
      {
        name: 'Bass',
        role: 'bass',
        color: ROLE_COLORS.bass,
        code: 'note("c2 c2 ~ c2 eb2 ~ g1 ~")\n  .s("sawtooth")\n  .lpf(1200)\n  .lpq(4)\n  .gain(0.6)',
      },
      {
        name: 'Arp',
        role: 'arp',
        color: ROLE_COLORS.arp,
        code: 'note("<c4 eb4 g4 bb4 g4 eb4>*4")\n  .s("square")\n  .lpf(3000)\n  .delay(0.4)\n  .delaytime(0.125)\n  .delayfeedback(0.5)\n  .gain(0.3)',
      },
      {
        name: 'Pad',
        role: 'pad',
        color: ROLE_COLORS.pad,
        code: 'note("<[c3,eb3,g3,bb3] [ab2,c3,eb3,g3]>")\n  .s("sawtooth")\n  .lpf(1800)\n  .room(0.8)\n  .gain(0.2)\n  .attack(0.3)\n  .release(1)',
      },
    ],
  },
]
