export type TrackRole = 'drums' | 'hihats' | 'bass' | 'lead' | 'pad' | 'arp' | 'fx' | 'vox' | 'custom'

export interface Track {
  id: string
  name: string
  role: TrackRole
  code: string
  color: string
  muted: boolean
  soloed: boolean
  locked: boolean
  volume: number
  error: string | null
}

export interface Template {
  id: string
  name: string
  description: string
  bpm: number
  tracks: Array<{
    name: string
    role: TrackRole
    code: string
    color: string
  }>
}

export const ROLE_COLORS: Record<TrackRole, string> = {
  drums: '#ff8c42',
  hihats: '#ffcc00',
  bass: '#00e5ff',
  lead: '#ff44cc',
  pad: '#a855f7',
  arp: '#22c55e',
  fx: '#eab308',
  vox: '#f472b6',
  custom: '#94a3b8',
}
