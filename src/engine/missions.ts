import type { Track } from './types'
import {
  MUTATORS,
  applyMutationToTracks,
  suggestMutations,
  type MutationCard,
} from './mutators'

export interface MissionCard {
  id: string
  label: string
  detail: string
  /** Soft goal copy shown on the card */
  goal: string
  mutation: MutationCard
}

/** Mission framing over existing mutators — same apply path as mutation cards. */
const MISSION_COPY: Record<string, { label: string; goal: string; detail?: string }> = {
  'kick-denser': {
    label: 'Busy kick',
    goal: 'Pack more kick hits',
    detail: 'Groove mission',
  },
  sparser: {
    label: 'Leave space',
    goal: 'Thin the rhythm grid',
    detail: 'Groove mission',
  },
  'hats-busier': {
    label: 'Hat energy',
    goal: 'Push the hats faster',
    detail: 'Groove mission',
  },
  'bass-darker': {
    label: 'Sub darkness',
    goal: 'Filter the bass down',
    detail: 'Timbre mission',
  },
  brighter: {
    label: 'Open the top',
    goal: 'Brighten a melodic track',
    detail: 'Timbre mission',
  },
  dirtier: {
    label: 'Add grit',
    goal: 'Shape / dirt on drums or bass',
    detail: 'Timbre mission',
  },
  'more-room': {
    label: 'Widen the room',
    goal: 'Push reverb up a notch',
    detail: 'Timbre mission',
  },
  'swap-808': {
    label: 'Flip the kit',
    goal: 'Swap 808 ↔ 909 bank',
    detail: 'Timbre mission',
  },
  'force-909': {
    label: '909 punch',
    goal: 'Lock drums to TR-909',
    detail: 'Timbre mission',
  },
}

function toMission(m: MutationCard): MissionCard {
  const copy = MISSION_COPY[m.id]
  return {
    id: `mission-${m.id}`,
    label: copy?.label ?? m.label,
    detail: copy?.detail ?? m.detail,
    goal: copy?.goal ?? m.detail,
    mutation: m,
  }
}

/** Deal 1–2 mission cards relevant to current tracks. */
export function suggestMissions(tracks: Track[], count = 2): MissionCard[] {
  const n = Math.max(1, Math.min(2, count))
  const base = suggestMutations(tracks, Math.max(n, 3))
  const picked: MutationCard[] = []
  for (const m of base) {
    if (picked.length >= n) break
    if (!picked.some((p) => p.id === m.id)) picked.push(m)
  }
  if (picked.length < n) {
    for (const m of MUTATORS) {
      if (picked.length >= n) break
      if (!picked.some((p) => p.id === m.id)) picked.push(m)
    }
  }
  return picked.map(toMission)
}

export function applyMissionToTracks(
  tracks: Track[],
  mission: MissionCard,
): { trackId: string; code: string } | null {
  return applyMutationToTracks(tracks, mission.mutation)
}
