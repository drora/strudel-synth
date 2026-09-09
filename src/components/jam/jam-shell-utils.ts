import { useEffect, useState, useRef } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import {
  getBankFromCode,
  getSoundFromCode,
} from '../../engine/code-effects'
import { liveUpdateEngine } from '../../engine/live-update'

export const PREBAKE_MIN_VISIBLE_MS = 600



export function queueJam(reason: 'kit' | 'jam' | 'reshuffle' | 'mute-solo' = 'jam') {
  if (!useSessionStore.getState().isPlaying) return
  const q = useUIStore.getState().getEffectiveQuantization(
    useSessionStore.getState().activeTrackId,
  )
  liveUpdateEngine.queueUpdate(q, reason)
}

export function trackSoundHint(code: string): string | null {
  return getBankFromCode(code) ?? getSoundFromCode(code)
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
