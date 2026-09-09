import { useSessionStore } from '../store/session-store'
import { useUIStore } from '../store/ui-store'
import {
  composeTracks,
  evaluateCode,
  initEngine,
  maybeLoadCommunityBanks,
  stop,
} from './strudel'
import { ensureAudioUnlocked, getAudioContextState } from './audio-context'
import { liveUpdateEngine, type Quantization, type QueueReason } from './live-update'

export type StartPlaybackResult = { ok: true } | { ok: false; reason: 'blocked' | 'error'; error?: string }

/**
 * Single start path: unlock → init → compose → evaluate.
 * Call only from a user-gesture turn on iOS.
 */
export async function startPlayback(): Promise<StartPlaybackResult> {
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
    latest.setPlaying(true)
    liveUpdateEngine.markPlayStarted()
    const code = composeTracks(latest.tracks, latest.bpm)
    await evaluateCode(code)
    maybeLoadCommunityBanks()
    return { ok: true }
  } catch (err) {
    console.error('Playback error:', err)
    liveUpdateEngine.markPlayStopped()
    state.setPlaying(false)
    const msg = err instanceof Error ? err.message : String(err)
    const activeId = useSessionStore.getState().activeTrackId
    if (activeId) useSessionStore.getState().setError(activeId, msg)
    return { ok: false, reason: 'error', error: msg }
  }
}

export async function stopPlayback(): Promise<void> {
  liveUpdateEngine.markPlayStopped()
  await stop()
  useSessionStore.getState().setPlaying(false)
  useUIStore.getState().setAudioError(null)
}

/** If already playing, queue a live update; otherwise start playback. */
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
