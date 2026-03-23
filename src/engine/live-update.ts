import { useSessionStore } from '../store/session-store'
import { evaluateCode, composeTracks } from './strudel'

export type Quantization = 'immediate' | '1' | '2' | '4'

interface PendingUpdate {
  timestamp: number
  quantization: Quantization
}

class LiveUpdateEngine {
  private pending: PendingUpdate | null = null
  private animFrameId: number | null = null
  private lastCycleInt = -1

  /**
   * Queue a re-evaluation at the next cycle boundary.
   * For 'immediate', evaluates right away.
   */
  queueUpdate(quantization: Quantization = '1') {
    if (quantization === 'immediate') {
      this.applyUpdate()
      return
    }

    this.pending = {
      timestamp: performance.now(),
      quantization,
    }

    if (!this.animFrameId) {
      this.startPolling()
    }
  }

  /**
   * Apply the pending update immediately (compose all tracks, evaluate).
   */
  private async applyUpdate() {
    this.pending = null
    const state = useSessionStore.getState()
    if (!state.isPlaying) return

    try {
      const code = composeTracks(state.tracks, state.bpm)
      await evaluateCode(code)
      // Clear errors on all tracks on success
      state.tracks.forEach((t) => {
        if (t.error) state.setError(t.id, null)
      })
    } catch (err) {
      const activeId = state.activeTrackId
      if (activeId) {
        state.setError(activeId, err instanceof Error ? err.message : String(err))
      }
    }
  }

  /**
   * Poll using rAF to detect cycle boundary crossings.
   * Uses Strudel's global `getTime` if available, otherwise uses a BPM-based
   * estimate from elapsed wall-clock time.
   */
  private startPolling() {
    const tick = () => {
      if (!this.pending) {
        this.animFrameId = null
        return
      }

      const cycle = this.estimateCycle()
      const quantInt = parseInt(this.pending.quantization)
      const boundary = cycle % quantInt

      // Fire when crossing a boundary (fractional near 0)
      if (Math.floor(cycle) !== this.lastCycleInt && boundary < 0.05) {
        this.applyUpdate()
      }
      this.lastCycleInt = Math.floor(cycle)

      this.animFrameId = requestAnimationFrame(tick)
    }

    this.animFrameId = requestAnimationFrame(tick)
  }

  private estimateCycle(): number {
    // Try to use Strudel's scheduler time if available
    if (typeof globalThis.getTime === 'function') {
      try {
        return globalThis.getTime()
      } catch {
        // fallback
      }
    }

    // Estimate from wall-clock and BPM
    const bpm = useSessionStore.getState().bpm
    const cps = bpm / 60 / 4
    const elapsed = performance.now() / 1000
    return elapsed * cps
  }

  /**
   * Cancel any pending update.
   */
  cancel() {
    this.pending = null
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  hasPending(): boolean {
    return this.pending !== null
  }
}

export const liveUpdateEngine = new LiveUpdateEngine()

// Extend globalThis for Strudel's getTime
declare global {
  function getTime(): number
}
