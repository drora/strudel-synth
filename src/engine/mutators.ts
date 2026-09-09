import type { Track, TrackRole } from './types'
import { setBankInCode, setEffectInCode, parseEffectValue, getBankFromCode } from './code-effects'

export type MutationKind = 'groove' | 'timbre'

export interface MutationCard {
  id: string
  label: string
  detail: string
  kind: MutationKind
  /** Roles this mutation prefers; empty = any */
  roles?: TrackRole[]
  apply: (code: string, role: TrackRole) => string
}

function denserKick(code: string): string {
  if (/bd\*4/.test(code)) return code.replace(/bd\*4/, 'bd*8')
  if (/bd\*2/.test(code)) return code.replace(/bd\*2/, 'bd*4')
  if (/"bd ~ bd ~"/.test(code)) return code.replace(/"bd ~ bd ~"/, '"bd*4"')
  if (/"bd ~ ~ ~"/.test(code)) return code.replace(/"bd ~ ~ ~"/, '"bd ~ bd ~"')
  if (/"bd sd/.test(code)) return code.replace(/s\("bd sd/, 's("bd*4')
  return code.includes('bd') ? code.replace(/s\("([^"]*)"\)/, 's("bd*4")') : code + '.fast(2)'
}

function sparser(code: string): string {
  if (/bd\*8/.test(code)) return code.replace(/bd\*8/, 'bd*4')
  if (/bd\*4/.test(code)) return code.replace(/bd\*4/, 'bd ~ bd ~')
  if (/hh\*16/.test(code)) return code.replace(/hh\*16/, 'hh*8')
  if (/hh\*8/.test(code)) return code.replace(/hh\*8/, 'hh*4')
  return code
}

function busierHats(code: string): string {
  if (/hh\*4/.test(code)) return code.replace(/hh\*4/, 'hh*8')
  if (/hh\*8/.test(code)) return code.replace(/hh\*8/, 'hh*16')
  if (/~ hh ~ hh/.test(code)) return code.replace(/~ hh ~ hh/, 'hh*8')
  if (!code.includes('hh')) return 's("hh*8").gain(0.4)'
  return code
}

function darkerBass(code: string): string {
  const cur = parseEffectValue(code, 'lpf')
  if (cur != null) return setEffectInCode(code, 'lpf', Math.max(80, Math.round(cur * 0.6)))
  return setEffectInCode(code, 'lpf', 350)
}

function brighter(code: string): string {
  const cur = parseEffectValue(code, 'lpf')
  if (cur != null) return setEffectInCode(code, 'lpf', Math.min(12000, Math.round(cur * 1.6)))
  return setEffectInCode(code, 'hpf', 2000)
}

function dirtier(code: string): string {
  const shape = parseEffectValue(code, 'shape')
  if (shape != null) return setEffectInCode(code, 'shape', Math.min(0.9, shape + 0.2))
  return setEffectInCode(code, 'shape', 0.35)
}

function moreRoom(code: string): string {
  const room = parseEffectValue(code, 'room')
  if (room != null) return setEffectInCode(code, 'room', Math.min(1.2, room + 0.25))
  return setEffectInCode(code, 'room', 0.45)
}

function swap808(code: string): string {
  const bank = getBankFromCode(code)
  if (bank === 'RolandTR808') return setBankInCode(code, 'RolandTR909')
  return setBankInCode(code, 'RolandTR808')
}

function swap909(code: string): string {
  return setBankInCode(code, 'RolandTR909')
}

export const MUTATORS: MutationCard[] = [
  {
    id: 'kick-denser',
    label: 'Make kick busier',
    detail: 'More hits · tighter groove',
    kind: 'groove',
    roles: ['drums'],
    apply: (code) => denserKick(code),
  },
  {
    id: 'sparser',
    label: 'Simplify rhythm',
    detail: 'Pull hits out',
    kind: 'groove',
    roles: ['drums', 'hihats', 'fx'],
    apply: (code) => sparser(code),
  },
  {
    id: 'hats-busier',
    label: 'Busier hats',
    detail: 'Faster hat grid',
    kind: 'groove',
    roles: ['hihats'],
    apply: (code) => busierHats(code),
  },
  {
    id: 'bass-darker',
    label: 'Darker bass',
    detail: 'Lower the filter',
    kind: 'timbre',
    roles: ['bass'],
    apply: (code) => darkerBass(code),
  },
  {
    id: 'brighter',
    label: 'Brighter tone',
    detail: 'Open the filter',
    kind: 'timbre',
    roles: ['hihats', 'lead', 'pad', 'arp'],
    apply: (code) => brighter(code),
  },
  {
    id: 'dirtier',
    label: 'Dirtier kit',
    detail: 'Add shape / grit',
    kind: 'timbre',
    roles: ['drums', 'bass', 'fx'],
    apply: (code) => dirtier(code),
  },
  {
    id: 'more-room',
    label: 'Add space',
    detail: 'More reverb',
    kind: 'timbre',
    apply: (code) => moreRoom(code),
  },
  {
    id: 'swap-808',
    label: 'Swap 808 / 909',
    detail: 'Flip drum machine',
    kind: 'timbre',
    roles: ['drums', 'hihats', 'fx'],
    apply: (code) => swap808(code),
  },
  {
    id: 'force-909',
    label: 'Punchier 909',
    detail: 'Move to TR-909',
    kind: 'timbre',
    roles: ['drums', 'hihats', 'fx'],
    apply: (code) => swap909(code),
  },
]

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/** Suggest up to 3 mutation cards relevant to current tracks. Aim ~half timbre. */
export function suggestMutations(tracks: Track[], count = 3): MutationCard[] {
  const roles = new Set(tracks.map((t) => t.role))
  const applicable = MUTATORS.filter(
    (m) => !m.roles || m.roles.some((r) => roles.has(r)),
  )
  const timbre = applicable.filter((m) => m.kind === 'timbre')
  const groove = applicable.filter((m) => m.kind === 'groove')
  const out: MutationCard[] = []
  const tPick = pickN(timbre, Math.ceil(count / 2))
  const gPick = pickN(groove, count - tPick.length)
  out.push(...tPick, ...gPick)
  if (out.length < count) {
    out.push(...pickN(applicable.filter((m) => !out.includes(m)), count - out.length))
  }
  return out.slice(0, count)
}

export function applyMutationToTracks(
  tracks: Track[],
  mutation: MutationCard,
): { trackId: string; code: string } | null {
  const candidates = tracks.filter(
    (t) => !mutation.roles || mutation.roles.includes(t.role),
  )
  const target = candidates[0] ?? tracks[0]
  if (!target) return null
  const next = mutation.apply(target.code, target.role)
  if (next === target.code) return null
  return { trackId: target.id, code: next }
}
