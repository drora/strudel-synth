/**
 * Defer New kit / Shuffle / Dice to the current song-loop boundary while playing.
 *
 * Same boundary as A/B punch and the walk chips: next cycleInt where
 * cycleInt % walkLen === 0 (walkLen = songSeed.walk.length, clamped 1–4).
 * Not the user's Update quantization. Stopped callers do not use this queue.
 */
import { liveUpdateEngine } from './live-update'
import { useSessionStore } from '../store/session-store'
import { shouldFireAbBoundary, walkLoopCycles } from './ab-punch'

export type SongApplyFn = () => void

let rafId = 0
let lastCycleInt = -1
let pendingApply: SongApplyFn | null = null
let pendingWalkLen = 1

export function hasPendingSongAtLoopEnd(): boolean {
  return pendingApply != null
}

export function cancelSongAtLoopEnd(): void {
  pendingApply = null
  pendingWalkLen = 1
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  lastCycleInt = -1
}

/** Run pending apply now (pause/stop). Returns true if something flushed. */
export function flushSongAtLoopEnd(): boolean {
  if (!pendingApply) return false
  const fn = pendingApply
  cancelSongAtLoopEnd()
  fn()
  return true
}

/**
 * Queue apply at the next walk-loop boundary while playing.
 * Replaces any prior pending kit/shuffle/dice. Does not touch the A/B queue.
 */
export function queueSongAtLoopEnd(opts: {
  walkLen: number
  apply: SongApplyFn
}): void {
  cancelSongAtLoopEnd()
  pendingWalkLen = walkLoopCycles(opts.walkLen)
  pendingApply = opts.apply
  lastCycleInt = Math.floor(liveUpdateEngine.getCurrentCycle())

  const tick = () => {
    if (!pendingApply) {
      rafId = 0
      return
    }
    if (!useSessionStore.getState().isPlaying) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const cycle = liveUpdateEngine.getCurrentCycle()
    const { fire, cycleInt } = shouldFireAbBoundary(cycle, lastCycleInt, pendingWalkLen)
    if (fire) {
      const fn = pendingApply
      cancelSongAtLoopEnd()
      fn()
      return
    }
    lastCycleInt = cycleInt
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

/** Test helper: force one poll tick (after faking getCurrentCycle / isPlaying). */
export function __songPunchPollOnceForTest(): void {
  if (!pendingApply) return
  if (!useSessionStore.getState().isPlaying) return
  const cycle = liveUpdateEngine.getCurrentCycle()
  const { fire, cycleInt } = shouldFireAbBoundary(cycle, lastCycleInt, pendingWalkLen)
  if (fire) {
    const fn = pendingApply
    cancelSongAtLoopEnd()
    fn()
    return
  }
  lastCycleInt = cycleInt
}
