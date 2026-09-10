import type { Density, GrooveFamily } from './kits-types'

const DRUM_POOLS: Record<GrooveFamily, Record<Density, string[]>> = {
  four_on_floor: {
    low: ['bd ~ bd ~', 'bd*4', 'bd ~ ~ ~ bd ~ bd ~'],
    mid: ['bd*4', 'bd ~ bd ~ bd ~ bd ~', 'bd*2 [~ bd] bd ~', 'bd bd bd bd'],
    high: ['bd*4', 'bd [bd ~] bd bd', 'bd*4', 'bd bd [bd bd] bd'],
  },
  breakbeat: {
    low: ['bd ~ ~ bd ~ ~ bd ~', 'bd ~ sd ~ bd ~ ~ sd', 'bd ~ ~ ~ bd bd ~ ~'],
    mid: ['bd sd [~ bd] sd', 'bd [~ bd] sd ~', 'bd ~ sd bd sd ~ bd sd', '[bd ~] [bd bd] sd ~', 'bd*2 sd [~ bd] [sd cp]'],
    high: ['bd [bd bd] sd bd', '[bd bd] sd [bd ~] sd', 'bd sd:2 [~ bd] cp', '[bd sd] [~ bd] [sd ~] [bd sd]', 'bd*2 [~ sd] bd sd'],
  },
  halftime: {
    low: ['bd ~ ~ ~ bd ~ ~ ~', 'bd ~ ~ bd ~ ~ ~ ~', 'bd ~ ~ ~ ~ ~ bd ~'],
    mid: ['bd ~ ~ bd ~ bd ~ ~', 'bd ~ ~ ~ bd ~ bd ~', 'bd ~ bd ~ ~ ~ bd ~'],
    high: ['bd ~ ~ bd ~ ~ bd ~', 'bd ~ bd ~ bd ~ ~ ~', 'bd ~ ~ bd bd ~ ~ ~'],
  },
  sparse: {
    low: ['bd ~ ~ ~', 'bd ~ ~ ~ ~ ~ ~ ~', '~ ~ bd ~'],
    mid: ['bd ~ ~ ~', 'bd ~ ~ bd ~ ~ ~ ~', 'bd ~ ~ ~ ~ ~ bd ~'],
    high: ['bd ~ ~ bd ~ ~ ~ ~', 'bd ~ ~ ~ bd ~ ~ ~', 'bd ~ bd ~ ~ ~ ~ ~'],
  },
  perc_loop: {
    low: ['perc ~ ~ perc', 'perc ~ ~ ~', 'bd ~ perc ~'],
    mid: ['perc*4', 'perc ~ perc ~', '[perc ~] perc ~ perc'],
    high: ['perc*4', 'perc perc ~ perc', '[perc perc] ~ perc perc'],
  },
}

const HAT_POOLS: Record<GrooveFamily, Record<Density, string[]>> = {
  four_on_floor: {
    low: ['~ hh ~ hh', 'hh*4', 'hh hh oh hh'],
    mid: ['hh*8', '[hh oh]*4', 'hh*8', 'hh hh oh hh hh hh oh hh', '~ hh ~ hh'],
    high: ['hh*16', 'hh*8', 'hh*12', '[hh hh] [~ oh] hh hh', 'hh(7,16)'],
  },
  breakbeat: {
    low: ['hh*4', '~ hh ~ hh', 'hh(3,8)'],
    mid: ['hh*8', 'hh(5,8)', '[hh oh] hh hh hh', 'hh*8 oh*2'],
    high: ['hh*16', 'hh*12', 'hh(7,16)', 'oh hh*3 oh hh*3'],
  },
  halftime: {
    low: ['~ hh ~ ~', '~ hh ~ hh', 'hh*4'],
    mid: ['hh*8', '~ hh ~ hh', 'hh*4 oh hh*2'],
    high: ['hh*8', 'hh*8', '[~ hh] hh [hh oh] hh'],
  },
  sparse: {
    low: ['~ hh ~ ~', '~ ~ hh ~', 'hh*4'],
    mid: ['~ hh ~ ~', 'hh*4', '~ ~ hh ~'],
    high: ['hh*4', '~ hh ~ hh', 'hh*8'],
  },
  perc_loop: {
    low: ['sh*4', '~ sh ~ sh', 'hh*4'],
    mid: ['sh*8', 'hh*8', '[sh ~]*4'],
    high: ['sh*8', 'hh*16', 'sh*8 hh*4'],
  },
}

const FX_POOLS: Record<GrooveFamily, Record<Density, string[]>> = {
  four_on_floor: {
    low: ['~ cp ~ ~', '~ ~ cp ~', '~ cp ~ cp'],
    mid: ['~ cp ~ cp', '~ sd ~ sd', '~ cp ~ cp'],
    high: ['~ cp ~ cp', 'cp ~ cp ~', '~ cp cp cp'],
  },
  breakbeat: {
    low: ['~ sd ~ ~', '~ rim ~ ~', '~ ~ cp ~'],
    mid: ['~ sd ~ ~ ~ sd ~ ~', '~ rim ~ ~ rim ~ ~ rim', '~ sd ~ cp'],
    high: ['~ sd ~ sd', 'sd ~ [~ sd] ~', '~ cp ~ rim ~ cp ~ ~'],
  },
  halftime: {
    low: ['~ ~ cp ~', '~ ~ sd ~', '~ rim ~ ~'],
    mid: ['~ ~ cp ~ ~ ~ cp ~', '~ sd ~ ~ ~ sd ~ ~', '~ ~ rim ~'],
    high: ['~ ~ cp ~ ~ ~ cp ~', '~ sd ~ ~ sd ~ ~ ~', '~ rim ~ rim'],
  },
  sparse: {
    low: ['~ ~ oh ~', '~ ~ cp ~', '~ ~ rd ~'],
    mid: ['~ ~ oh ~', '~ ~ cp ~', '~ ~ rd ~'],
    high: ['~ oh ~ ~', '~ ~ cp ~', '~ rd ~ oh'],
  },
  perc_loop: {
    low: ['~ perc ~ ~', '~ ~ perc ~', '~ cb ~ ~'],
    mid: ['~ perc ~ perc', '~ cb ~ perc', '~ perc ~ ~'],
    high: ['perc ~ perc ~', '~ perc perc ~', 'cb ~ perc ~'],
  },
}


export { DRUM_POOLS, HAT_POOLS, FX_POOLS }
