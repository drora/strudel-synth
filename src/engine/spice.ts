/**
 * One-tap Spice — FX/timbre nudges only (same tune, spiced up).
 * Never rewrite s()/note() patterns, groove density, banks, or reshuffle.
 */
import type { Track } from './types'
import { parseEffectValue, setEffectInCode } from './code-effects'

export type SpiceNudge = {
  id: string
  /** Short peek label, e.g. "room" / "darker" */
  label: string
  apply: (code: string) => string
}

const NUDGES: SpiceNudge[] = [
  {
    id: 'darker',
    label: 'darker',
    apply: (code) => {
      const cur = parseEffectValue(code, 'lpf')
      if (cur != null) return setEffectInCode(code, 'lpf', Math.max(80, Math.round(cur * 0.65)))
      return setEffectInCode(code, 'lpf', 400)
    },
  },
  {
    id: 'brighter',
    label: 'brighter',
    apply: (code) => {
      const lpf = parseEffectValue(code, 'lpf')
      if (lpf != null) return setEffectInCode(code, 'lpf', Math.min(12000, Math.round(lpf * 1.5)))
      const hpf = parseEffectValue(code, 'hpf')
      if (hpf != null) return setEffectInCode(code, 'hpf', Math.min(6000, Math.round(hpf * 1.25)))
      return setEffectInCode(code, 'hpf', 180)
    },
  },
  {
    id: 'shape',
    label: 'shape',
    apply: (code) => {
      const shape = parseEffectValue(code, 'shape')
      if (shape != null) return setEffectInCode(code, 'shape', Math.min(0.85, +(shape + 0.15).toFixed(2)))
      return setEffectInCode(code, 'shape', 0.3)
    },
  },
  {
    id: 'room',
    label: 'room',
    apply: (code) => {
      const room = parseEffectValue(code, 'room')
      if (room != null) return setEffectInCode(code, 'room', Math.min(1.1, +(room + 0.2).toFixed(2)))
      return setEffectInCode(code, 'room', 0.4)
    },
  },
  {
    id: 'delay',
    label: 'delay',
    apply: (code) => {
      const delay = parseEffectValue(code, 'delay')
      if (delay != null) return setEffectInCode(code, 'delay', Math.min(0.85, +(delay + 0.12).toFixed(2)))
      return setEffectInCode(code, 'delay', 0.22)
    },
  },
  {
    id: 'gain-up',
    label: 'gain',
    apply: (code) => {
      const gain = parseEffectValue(code, 'gain')
      if (gain != null) return setEffectInCode(code, 'gain', Math.min(1.4, +(gain * 1.12).toFixed(2)))
      return setEffectInCode(code, 'gain', 0.85)
    },
  },
]

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/**
 * Apply one random FX nudge to a track. Prefer `preferTrackId` (active), else any track.
 * Returns null only if no track / no nudge changes code.
 */
export function applySpiceToTracks(
  tracks: readonly Track[],
  preferTrackId?: string | null,
): { trackId: string; code: string; label: string } | null {
  if (tracks.length === 0) return null

  const preferred = preferTrackId
    ? tracks.find((t) => t.id === preferTrackId)
    : undefined
  const order = preferred
    ? [preferred, ...shuffleInPlace(tracks.filter((t) => t.id !== preferred.id))]
    : shuffleInPlace([...tracks])

  const nudges = shuffleInPlace([...NUDGES])

  for (const track of order) {
    for (const nudge of nudges) {
      const next = nudge.apply(track.code)
      if (next !== track.code) {
        return { trackId: track.id, code: next, label: nudge.label }
      }
    }
  }
  return null
}
