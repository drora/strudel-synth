import { useEffect, useState, useRef } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import {
  getBankFromCode,
  getSoundFromCode,
  getNFromCode,
} from '../../engine/code-effects'
import { liveUpdateEngine, type Quantization } from '../../engine/live-update'

export const PREBAKE_MIN_VISIBLE_MS = 600



export function queueJam(
  reason: 'kit' | 'jam' | 'reshuffle' | 'mute-solo' = 'jam',
  quantization?: Quantization,
) {
  if (!useSessionStore.getState().isPlaying) return
  const q =
    quantization ??
    useUIStore.getState().getEffectiveQuantization(
      useSessionStore.getState().activeTrackId,
    )
  liveUpdateEngine.queueUpdate(q, reason)
}

/** Mix changes (mute/solo/volume) and post-remove compose — never wait on cycle quant. */
export function queueJamImmediate(
  reason: 'kit' | 'jam' | 'reshuffle' | 'mute-solo' = 'mute-solo',
) {
  queueJam(reason, 'immediate')
}

export function trackSoundHint(code: string): string | null {
  const bank = getBankFromCode(code)
  const sound = getSoundFromCode(code)
  const n = getNFromCode(code)
  if (bank) {
    const short = bank
      .replace(/^RolandTR/, '')
      .replace(/^Roland/, '')
      .replace(/^Akai/, '')
      .replace(/^Emu/, '')
      .replace(/^Boss/, '')
      .replace(/^Oberheim/, '')
      .replace(/^Linn/, 'Linn')
    return n != null && n > 0 ? `${short}·n${n}` : short
  }
  return sound
}

/** Hold a boolean true for at least `minMs` after it first becomes true. */
export function useMinVisible(active: boolean, minMs: number): boolean {
  const [visible, setVisible] = useState(active)
  const shownAt = useRef<number | null>(active ? Date.now() : null)

  useEffect(() => {
    if (active) {
      shownAt.current = Date.now()
      setVisible(true)
      return
    }
    if (!visible) return
    const started = shownAt.current ?? Date.now()
    const remaining = Math.max(0, minMs - (Date.now() - started))
    const id = window.setTimeout(() => {
      setVisible(false)
      shownAt.current = null
    }, remaining)
    return () => window.clearTimeout(id)
  }, [active, minMs, visible])

  return visible
}
