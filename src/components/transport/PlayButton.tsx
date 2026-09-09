import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { stop, composeTracks, initEngine, evaluateCode, maybeLoadCommunityBanks } from '../../engine/strudel'
import { ensureAudioUnlocked, getAudioContextState } from '../../engine/audio-context'
import { liveUpdateEngine } from '../../engine/live-update'
import { useUIStore } from '../../store/ui-store'

export function PlayButton({ large = false }: { large?: boolean }) {
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const handleClick = useCallback(async () => {
    const state = useSessionStore.getState()

    if (state.isPlaying) {
      liveUpdateEngine.markPlayStopped()
      await stop()
      state.setPlaying(false)
      useUIStore.getState().setAudioError(null)
      return
    }

    try {
      // MUST unlock in the same user-gesture turn before init/evaluate (iOS)
      const unlock = await ensureAudioUnlocked()
      if (!unlock.ok) {
        useUIStore.getState().setAudioError(
          'Tap Play again — iOS blocked audio',
        )
        return
      }
      useUIStore.getState().setAudioError(null)

      await initEngine()

      // Re-check after init (Strudel may have created its own context)
      const after = await ensureAudioUnlocked()
      if (!after.ok && getAudioContextState() !== 'running') {
        useUIStore.getState().setAudioError(
          'Tap Play again — iOS blocked audio',
        )
        return
      }

      state.setPlaying(true)
      liveUpdateEngine.markPlayStarted()
      const code = composeTracks(state.tracks, state.bpm)
      await evaluateCode(code)
      liveUpdateEngine.markPlayStarted()
      maybeLoadCommunityBanks()
    } catch (err) {
      console.error('Playback error:', err)
      liveUpdateEngine.markPlayStopped()
      state.setPlaying(false)
      const activeId = state.activeTrackId
      if (activeId) {
        state.setError(activeId, err instanceof Error ? err.message : String(err))
      }
    }
  }, [])

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center justify-center rounded-xl
        transition-all font-bold shrink-0 active:scale-95
        ${large ? 'w-16 h-12 min-w-12 min-h-12 text-2xl' : 'w-14 h-11 text-xl'}
        ${isPlaying
          ? 'bg-error/35 text-error hover:bg-error/45 shadow-[0_0_16px_rgba(239,68,68,0.35)]'
          : 'bg-accent text-bg hover:bg-accent/90 shadow-[0_0_18px_rgba(167,139,250,0.45)]'
        }
      `}
      title={isPlaying ? 'Stop (Ctrl+.)' : 'Play'}
      aria-label={isPlaying ? 'Stop' : 'Play'}
    >
      {isPlaying ? '■' : '▶'}
    </button>
  )
}
