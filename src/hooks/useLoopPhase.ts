import { useEffect, useState } from 'react'
import { liveUpdateEngine } from '../engine/live-update'
import { useSessionStore } from '../store/session-store'

export interface LoopPhase {
  /** Absolute fractional cycle from scheduler (or cps estimate). */
  cycle: number
  /** Phase within the current cycle [0, 1). */
  phase: number
  /** Integer cycle count. */
  cycleInt: number
}

/**
 * Soft phone-friendly loop phase for the Jam BPM ring.
 * Prefers Strudel scheduler `getTime()` via liveUpdateEngine; falls back to cps + play epoch.
 */
export function useLoopPhase(enabled: boolean): LoopPhase {
  const [phase, setPhase] = useState<LoopPhase>({ cycle: 0, phase: 0, cycleInt: 0 })

  useEffect(() => {
    if (!enabled) {
      setPhase({ cycle: 0, phase: 0, cycleInt: 0 })
      return
    }
    let raf = 0
    const tick = () => {
      const cycle = liveUpdateEngine.getCurrentCycle()
      const cycleInt = Math.floor(cycle)
      const frac = cycle - cycleInt
      setPhase({ cycle, phase: frac, cycleInt })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  return phase
}

/** Subscribe helper when you only need isPlaying gating from the store. */
export function usePlayingLoopPhase(): LoopPhase {
  const isPlaying = useSessionStore((s) => s.isPlaying)
  return useLoopPhase(isPlaying)
}
