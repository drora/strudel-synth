import type { TrackRole } from './types'
import { ROLE_COLORS } from './types'

export interface RolePreset {
  role: TrackRole
  label: string
  icon: string
  defaultCode: string
  color: string
}

export const ROLE_PRESETS: Record<TrackRole, RolePreset> = {
  drums: {
    role: 'drums',
    label: 'Drums',
    icon: '🥁',
    color: ROLE_COLORS.drums,
    defaultCode: 's("bd sd [~ bd] sd").bank("RolandTR808")',
  },
  hihats: {
    role: 'hihats',
    label: 'Hi-Hats',
    icon: '🎩',
    color: ROLE_COLORS.hihats,
    defaultCode: 's("hh*8").gain(0.3).bank("RolandTR808")',
  },
  bass: {
    role: 'bass',
    label: 'Bass',
    icon: '🎸',
    color: ROLE_COLORS.bass,
    defaultCode: 'note("c2 ~ c2 ~ eb2 ~ g1 ~").sound("sawtooth").lpf(500).lpq(3)',
  },
  lead: {
    role: 'lead',
    label: 'Lead',
    icon: '🎹',
    color: ROLE_COLORS.lead,
    defaultCode: 'note("<c4 eb4 g4 bb4>*2").sound("square").room(0.3).delay(0.2)',
  },
  pad: {
    role: 'pad',
    label: 'Pad',
    icon: '🌊',
    color: ROLE_COLORS.pad,
    defaultCode: 'note("[c3,eb3,g3]").sound("sine").room(0.8).gain(0.3)',
  },
  arp: {
    role: 'arp',
    label: 'Arp',
    icon: '✨',
    color: ROLE_COLORS.arp,
    defaultCode: 'note("<c3 eb3 g3 bb3>*8").sound("triangle").delay(0.5).delaytime(0.125)',
  },
  fx: {
    role: 'fx',
    label: 'FX/Perc',
    icon: '💥',
    color: ROLE_COLORS.fx,
    defaultCode: 's("cp rim").bank("RolandTR808").room(0.5)',
  },
  vox: {
    role: 'vox',
    label: 'Vox',
    icon: '🎤',
    color: ROLE_COLORS.vox,
    defaultCode: 's("mouth").room(0.3).lpf(4000)',
  },
  custom: {
    role: 'custom',
    label: 'Custom',
    icon: '⚡',
    color: ROLE_COLORS.custom,
    defaultCode: '// Write your Strudel code here\nsilence',
  },
}
