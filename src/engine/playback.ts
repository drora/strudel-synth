import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'
import {
  composeTracks,
  evaluateCode,
  initEngine,
  maybeLoadCommunityBanks,
  stop,
} from './strudel'
import { silenceUnplayableTracks } from './compose-tracks'
import { ensureAudioUnlocked, getAudioContextState } from './audio-context'
import { liveUpdateEngine, type Quantization, type QueueReason } from './live-update'
import { coalesceInFlight } from './async-coalesce'

export type StartPlaybackResult = { ok: true } | { ok: false; reason: 'blocked' | 'error'; error?: string }

/** Shared in-flight start so Save+Play / double-Play await one init (no double CDN prebake). */
const startInFlightHolder: { current: Promise<StartPlaybackResult> | null } = { current: null }

/**
 * Single start path: unlock → init → compose → evaluate.
 * Resumes from paused cycle when present; otherwise starts from 0:00.
 * Call only from a user-gesture turn on iOS.
 * Concurrent calls share one in-flight promise.
 */
export async function startPlayback(): Promise<StartPlaybackResult> {
  return coalesceInFlight(startInFlightHolder, runStartPlayback)
}

async function runStartPlayback(): Promise<StartPlaybackResult> {
  const state = useSessionStore.getState()
  try {
    const unlock = await ensureAudioUnlocked()
    if (!unlock.ok) {
      useUIStore.getState().setAudioError('Tap Play again — iOS blocked audio')
      return { ok: false, reason: 'blocked' }
    }
    useUIStore.getState().setAudioError(null)

    await initEngine()

    const after = await ensureAudioUnlocked()
    if (!after.ok && getAudioContextState() !== 'running') {
      useUIStore.getState().setAudioError('Tap Play again — iOS blocked audio')
      return { ok: false, reason: 'blocked' }
    }

    const latest = useSessionStore.getState()
    const overlay = useJamStore.getState().improvHold ?? 'silence'
    const { tracks: playable, silencedIds } = silenceUnplayableTracks(latest.tracks)
    const code = composeTracks(playable, latest.bpm, overlay)
    await evaluateCode(code)
    // Epoch after evaluate so wall/audio clocks align with audible start.
    // markPlayStarted consumes pausedCycle (if any) into cycleBias for resume.
    liveUpdateEngine.markPlayStarted()
    latest.setPlaying(true)
    latest.setPausedCycle(null)
    maybeLoadCommunityBanks()
    if (silencedIds.length) {
      const name =
        latest.tracks.find((tr) => tr.id === silencedIds[0])?.name ?? silencedIds[0]
      useJamStore.getState().setLastPeek(`Play · ${name} skipped — syntax`)
    }
    return { ok: true }
  } catch (err) {
    console.error('Playback error:', err)
    liveUpdateEngine.markPlayStopped()
    state.setPlaying(false)
    state.setPausedCycle(null)
    const msg = err instanceof Error ? err.message : String(err)
    useJamStore.getState().setLastPeek('Play · ' + msg)
    const session = useSessionStore.getState()
    const errId = useJamStore.getState().lastTouchedTrackId || session.activeTrackId
    if (errId) session.setError(errId, msg)
    useUIStore.getState().setAudioError(msg)
    return { ok: false, reason: 'error', error: msg }
  }
}

/**
 * Pause: hush audio, keep musical / cycle position (resume continues).
 * Does not reset phase ring to 0:00.
 */
export async function pausePlayback(): Promise<void> {
  liveUpdateEngine.markPlayPaused()
  const frozen = liveUpdateEngine.getPausedCycle()
  await stop()
  const session = useSessionStore.getState()
  session.setPlaying(false)
  session.setPausedCycle(frozen)
  useUIStore.getState().setAudioError(null)
}

/**
 * Stop + reset: hush and clear cycle / phase to 0:00.
 * Next Play starts from the top. Ctrl+. uses this.
 */
export async function stopPlayback(): Promise<void> {
  liveUpdateEngine.markPlayStopped()
  await stop()
  const session = useSessionStore.getState()
  session.setPlaying(false)
  session.setPausedCycle(null)
  useUIStore.getState().setAudioError(null)
  try {
    const mix = await import('./mix-capture')
    if (mix.isMixCapturing()) await mix.stopMixCapture()
  } catch {
    /* take already idle */
  }
}

/** If already playing, queue a live update; otherwise start/resume playback. */
export async function startOrQueueUpdate(
  quant: Quantization = '1',
  reason: QueueReason = 'manual',
): Promise<StartPlaybackResult> {
  if (useSessionStore.getState().isPlaying) {
    liveUpdateEngine.queueUpdate(quant, reason)
    return { ok: true }
  }
  return startPlayback()
}
