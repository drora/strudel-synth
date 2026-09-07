import { useSessionStore } from '../store/session-store'
import { evaluateCode, composeTracks } from './strudel'

export type Quantization = 'immediate' | '1' | '2' | '4'
export type UpdateStatus = 'idle' | 'dirty' | 'queued' | 'applied' | 'error'

export type QueueReason =
  | 'manual'
  | 'lock'
  | 'effects'
  | 'mute-solo'
  | 'reshuffle'
  | 'hotkey'

interface PendingUpdate {
  quantization: Quantization
  reason: QueueReason
  queuedAt: number
}

type StatusListener = (status: UpdateStatus, meta?: { reason?: QueueReason; error?: string }) => void

/**
 * Single entry point for every playback mutation.
 * All paths (Ctrl+Enter, Update, Lock, effects, mute/solo) must go through queueUpdate.
 */
class LiveUpdateEngine {
  private pending: PendingUpdate | null = null
  private animFrameId: number | null = null
  private lastCycleInt = -1
  private playEpochSec: number | null = null
  private status: UpdateStatus = 'idle'
  private listeners = new Set<StatusListener>()
  private appliedFlashTimer: ReturnType<typeof setTimeout> | null = null

  /** Call when playback starts so wall-clock fallback is relative to play, not page load. */
  markPlayStarted() {
    this.playEpochSec = performance.now() / 1000
    this.lastCycleInt = -1
    // Prefer aligning to Strudel's clock if already running
    const now = this.readSchedulerCycle()
    if (now != null) {
      this.lastCycleInt = Math.floor(now)
    }
  }

  markPlayStopped() {
    this.cancel()
    this.playEpochSec = null
    this.setStatus('idle')
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  markDirty() {
    if (this.status === 'queued') return
    this.setStatus('dirty')
  }

  /**
   * Queue a re-evaluation at the next cycle boundary (or immediately).
   */
  queueUpdate(
    quantization: Quantization = '1',
    reason: QueueReason = 'manual',
  ) {
    const state = useSessionStore.getState()
    if (!state.isPlaying) {
      // Not playing: apply as a start if caller expects sound; otherwise no-op.
      // Callers that want to start playback should use PlayButton / evaluateAll.
      return
    }

    if (quantization === 'immediate') {
      void this.applyUpdate(reason)
      return
    }

    this.pending = {
      quantization,
      reason,
      queuedAt: performance.now(),
    }
    this.setStatus('queued', { reason })

    if (!this.animFrameId) {
      this.startPolling()
    }
  }

  /** Evaluate current session composition right now (used for first Play). */
  async evaluateNow(reason: QueueReason = 'manual'): Promise<void> {
    await this.applyUpdate(reason)
  }

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

  /** Current cycle position (fractional). */
  getCurrentCycle(): number {
    return this.estimateCycle()
  }

  private setStatus(status: UpdateStatus, meta?: { reason?: QueueReason; error?: string }) {
    this.status = status
    for (const l of this.listeners) l(status, meta)
  }

  private async applyUpdate(reason: QueueReason = 'manual') {
    this.pending = null
    const state = useSessionStore.getState()
    if (!state.isPlaying && reason !== 'manual') {
      // mute-solo etc. only while playing
    }

    try {
      const code = composeTracks(state.tracks, state.bpm)
      await evaluateCode(code)
      state.tracks.forEach((t) => {
        if (t.error) state.setError(t.id, null)
      })
      this.setStatus('applied', { reason })
      if (this.appliedFlashTimer) clearTimeout(this.appliedFlashTimer)
      this.appliedFlashTimer = setTimeout(() => {
        if (this.status === 'applied') this.setStatus('idle')
      }, 220)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const activeId = state.activeTrackId
      if (activeId) state.setError(activeId, msg)
      this.setStatus('error', { reason, error: msg })
    }
  }

  private startPolling() {
    const tick = () => {
      if (!this.pending) {
        this.animFrameId = null
        return
      }

      const cycle = this.estimateCycle()
      const quantInt = Math.max(1, parseInt(this.pending.quantization, 10) || 1)
      const cycleInt = Math.floor(cycle)
      const frac = cycle - cycleInt

      // Fire once when we cross an integer multiple of quantInt near the boundary
      const onBoundary = frac < 0.08
      const crossed = cycleInt !== this.lastCycleInt
      const aligned = quantInt === 1 || cycleInt % quantInt === 0

      if (crossed && onBoundary && aligned) {
        const reason = this.pending.reason
        void this.applyUpdate(reason)
      }

      this.lastCycleInt = cycleInt
      this.animFrameId = requestAnimationFrame(tick)
    }

    this.animFrameId = requestAnimationFrame(tick)
  }

  private readSchedulerCycle(): number | null {
    const g = globalThis as typeof globalThis & {
      getTime?: () => number
      // some Strudel builds expose scheduler clock differently
      strudelMirror?: { scheduler?: { now?: () => number } }
    }
    if (typeof g.getTime === 'function') {
      try {
        const t = g.getTime()
        if (typeof t === 'number' && Number.isFinite(t)) return t
      } catch {
        /* fall through */
      }
    }
    return null
  }

  private estimateCycle(): number {
    const fromScheduler = this.readSchedulerCycle()
    if (fromScheduler != null) return fromScheduler

    const bpm = useSessionStore.getState().bpm
    const cps = bpm / 60 / 4
    const epoch = this.playEpochSec
    if (epoch == null) {
      // Not playing / unknown — return 0 so we don't spuriously fire
      return 0
    }
    const elapsed = performance.now() / 1000 - epoch
    return Math.max(0, elapsed * cps)
  }
}

export const liveUpdateEngine = new LiveUpdateEngine()

declare global {
  function getTime(): number
}
