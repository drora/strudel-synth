/**
 * Defer A/B arrangement punch to the current song-loop boundary.
 *
 * "Loop end" = next integer cycle where cycleInt % walkLen === 0, using the
 * same walk length the Jam walk chips use (cycleInt % walk.length). That is the
 * melodic phrase length (1–4 drum cycles), not the user's Update quantization.
 */
import { liveUpdateEngine } from './live-update'
import { useSessionStore } from '../store/session-store'

export type AbApplyFn = () => void

let rafId = 0
let lastCycleInt = -1
let pendingApply: AbApplyFn | null = null
let pendingWalkLen = 1

/** Clamp to Jam walk N ∈ {1,2,3,4}. */
export function walkLoopCycles(seedLen: number | null | undefined): number {
  const n = Math.trunc(seedLen ?? 1) || 1
  return Math.max(1, Math.min(4, n))
}

/**
 * Same boundary predicate as live-update's quant poller, but aligned to walkLen.
 * Fire at the start of a walk period (= end of the previous walk loop).
 */
export function shouldFireAbBoundary(
  cycle: number,
  prevCycleInt: number,
  walkLen: number,
): { fire: boolean; cycleInt: number } {
  const n = walkLoopCycles(walkLen)
  const cycleInt = Math.floor(cycle)
  const frac = cycle - cycleInt
  const onBoundary = frac < 0.08
  const crossed = cycleInt !== prevCycleInt
  const aligned = n === 1 || cycleInt % n === 0
  return { fire: crossed && onBoundary && aligned, cycleInt }
}

export function hasPendingAbAtLoopEnd(): boolean {
  return pendingApply != null
}

export function cancelAbAtLoopEnd(): void {
  pendingApply = null
  pendingWalkLen = 1
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  lastCycleInt = -1
}

/** Run pending apply now (e.g. pause/stop). Returns true if something flushed. */
export function flushAbAtLoopEnd(): boolean {
  if (!pendingApply) return false
  const fn = pendingApply
  cancelAbAtLoopEnd()
  fn()
  return true
}

/**
 * Queue apply at the next walk-loop boundary while playing.
 * Replaces any prior pending punch. No-op schedule if apply is missing.
 */
export function queueAbAtLoopEnd(opts: {
  walkLen: number
  apply: AbApplyFn
}): void {
  cancelAbAtLoopEnd()
  pendingWalkLen = walkLoopCycles(opts.walkLen)
  pendingApply = opts.apply
  lastCycleInt = Math.floor(liveUpdateEngine.getCurrentCycle())

  const tick = () => {
    if (!pendingApply) {
      rafId = 0
      return
    }
    // Still waiting — playback may have paused; jam-store/playback flush separately.
    if (!useSessionStore.getState().isPlaying) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const cycle = liveUpdateEngine.getCurrentCycle()
    const { fire, cycleInt } = shouldFireAbBoundary(cycle, lastCycleInt, pendingWalkLen)
    if (fire) {
      const fn = pendingApply
      cancelAbAtLoopEnd()
      fn()
      return
    }
    lastCycleInt = cycleInt
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

/** Test helper: force one poll tick (after faking getCurrentCycle / isPlaying). */
export function __abPunchPollOnceForTest(): void {
  if (!pendingApply) return
  if (!useSessionStore.getState().isPlaying) return
  const cycle = liveUpdateEngine.getCurrentCycle()
  const { fire, cycleInt } = shouldFireAbBoundary(cycle, lastCycleInt, pendingWalkLen)
  if (fire) {
    const fn = pendingApply
    cancelAbAtLoopEnd()
    fn()
    return
  }
  lastCycleInt = cycleInt
}
