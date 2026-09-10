import { useLayoutEffect, useRef, useState } from 'react'
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

type PhaseListener = (p: LoopPhase) => void

let rafId = 0
let listenerCount = 0
const listeners = new Set<PhaseListener>()
let latest: LoopPhase = { cycle: 0, phase: 0, cycleInt: 0 }

function readPhase(): LoopPhase {
  const cycle = liveUpdateEngine.getCurrentCycle()
  const cycleInt = Math.floor(cycle)
  return { cycle, phase: cycle - cycleInt, cycleInt }
}

function ensureLoop() {
  if (rafId) return
  const tick = () => {
    latest = readPhase()
    for (const l of listeners) l(latest)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function stopLoopIfIdle() {
  if (listenerCount > 0) return
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  latest = { cycle: 0, phase: 0, cycleInt: 0 }
}

/** Subscribe to phase without React — ideal for painting chip borders. */
export function subscribeLoopPhase(listener: PhaseListener): () => void {
  listeners.add(listener)
  listenerCount++
  ensureLoop()
  listener(latest)
  return () => {
    listeners.delete(listener)
    listenerCount = Math.max(0, listenerCount - 1)
    stopLoopIfIdle()
  }
}

/**
 * Soft phone-friendly loop phase for the Jam BPM ring / chips.
 * Prefers Strudel scheduler via liveUpdateEngine; one shared RAF for all subscribers.
 */
export function useLoopPhase(enabled: boolean): LoopPhase {
  const [phase, setPhase] = useState<LoopPhase>(latest)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useLayoutEffect(() => {
    if (!enabled) {
      setPhase({ cycle: 0, phase: 0, cycleInt: 0 })
      return
    }
    // Publish to React at most ~every other frame to cut commit lag while staying smooth
    let skip = false
    return subscribeLoopPhase((p) => {
      skip = !skip
      if (!skip) setPhase(p)
    })
  }, [enabled])

  return enabled ? phase : { cycle: 0, phase: 0, cycleInt: 0 }
}

/** Subscribe helper when you only need isPlaying gating from the store. */
export function usePlayingLoopPhase(): LoopPhase {
  const isPlaying = useSessionStore((s) => s.isPlaying)
  return useLoopPhase(isPlaying)
}

/** Stable callback form for ref-driven paints (chips). */
export function useLoopPhaseCallback(
  enabled: boolean,
  onPhase: (phase: number) => void,
) {
  const cb = useRef(onPhase)
  cb.current = onPhase
  useLayoutEffect(() => {
    if (!enabled) {
      cb.current(0)
      return
    }
    return subscribeLoopPhase((p) => cb.current(p.phase))
  }, [enabled])
}
