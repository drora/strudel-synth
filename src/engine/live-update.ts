import { useSessionStore } from '../store/session-store'
import { evaluateCode, composeTracks, getSchedulerCycle } from './strudel'
import { getAudioContext } from './audio-context'

export type Quantization = 'immediate' | '1' | '2' | '4'
export type UpdateStatus = 'idle' | 'dirty' | 'queued' | 'applied' | 'error'

export type QueueReason =
  | 'manual'
  | 'lock'
  | 'effects'
  | 'mute-solo'
  | 'reshuffle'
  | 'hotkey'
  | 'kit'
  | 'jam'
  | 'section'

interface PendingUpdate {
  quantization: Quantization
  reason: QueueReason
  queuedAt: number
}

export interface BoundaryInfo {
  /** Pending quantization integer (1/2/4); null if idle or immediate. */
  quantInt: number | null
  /** Fractional progress [0,1) within the current quant window toward the next fire boundary. */
  progress: number
  /** Absolute cycle time of the next aligned boundary (estimate). */
  nextBoundary: number
  /** Current absolute cycle. */
  cycle: number
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
  /** AudioContext.currentTime at play start — preferred wall/audio fallback epoch. */
  private playEpochAudio: number | null = null
  private status: UpdateStatus = 'idle'
  private listeners = new Set<StatusListener>()
  private appliedFlashTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Call when playback is audibly starting (after evaluate).
   * Wall/audio epochs align to hearing; scheduler.now() is preferred when available.
   */
  markPlayStarted() {
    this.playEpochSec = performance.now() / 1000
    try {
      this.playEpochAudio = getAudioContext().currentTime
    } catch {
      this.playEpochAudio = null
    }
    this.lastCycleInt = -1
    const now = this.readSchedulerCycle()
    if (now != null) {
      this.lastCycleInt = Math.floor(now)
    }
  }

  markPlayStopped() {
    this.cancel()
    this.playEpochSec = null
    this.playEpochAudio = null
    this.setStatus('idle')
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  getPending(): PendingUpdate | null {
    return this.pending
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

  /**
   * Progress toward the next fire boundary for TransportViz "next boundary" marker.
   * Uses pending quant when queued; otherwise defaults to 1-cycle "the one".
   */
  getBoundaryInfo(): BoundaryInfo {
    const cycle = this.estimateCycle()
    const quantInt =
      this.pending && this.pending.quantization !== 'immediate'
        ? Math.max(1, parseInt(this.pending.quantization, 10) || 1)
        : 1
    const nextBoundary = Math.ceil((cycle + 1e-9) / quantInt) * quantInt
    const windowStart = nextBoundary - quantInt
    const progress = Math.min(1, Math.max(0, (cycle - windowStart) / quantInt))
    return {
      quantInt: this.pending ? quantInt : null,
      progress,
      nextBoundary,
      cycle,
    }
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

  /**
   * Musical cycle from Strudel scheduler.now() when available.
   * Do NOT use raw getTime() — that is AudioContext seconds, not cycles.
   */
  private readSchedulerCycle(): number | null {
    const fromEngine = getSchedulerCycle()
    if (fromEngine != null) return fromEngine
    const g = globalThis as typeof globalThis & {
      strudelMirror?: { scheduler?: { now?: () => number } }
    }
    const nowFn = g.strudelMirror?.scheduler?.now
    if (typeof nowFn === 'function') {
      try {
        const n = nowFn()
        if (typeof n === 'number' && Number.isFinite(n)) return n
      } catch {
        /* fall through */
      }
    }
    return null
  }

  /**
   * Cycle for UI + quant. Prefers scheduler; else audio/performance * cps.
   * Adds a small lead so ticks meet the audible downbeat (cyclist latency ~0.1s + paint).
   */
  private estimateCycle(): number {
    const bpm = useSessionStore.getState().bpm
    const cps = Math.max(1e-6, bpm / 60 / 4)
    // Default cyclist latency 0.1s + ~1 frame paint ≈ slight lead OK, lag not
    const leadCycles = 0.1 * cps + 1 / 60

    const fromScheduler = this.readSchedulerCycle()
    if (fromScheduler != null) {
      return Math.max(0, fromScheduler + leadCycles)
    }

    let elapsedSec: number | null = null
    if (this.playEpochAudio != null) {
      try {
        elapsedSec = getAudioContext().currentTime - this.playEpochAudio
      } catch {
        elapsedSec = null
      }
    }
    if (elapsedSec == null && this.playEpochSec != null) {
      elapsedSec = performance.now() / 1000 - this.playEpochSec
    }
    if (elapsedSec == null) return 0
    return Math.max(0, elapsedSec * cps + leadCycles)
  }
}

export const liveUpdateEngine = new LiveUpdateEngine()
