import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { stop, composeTracks, initEngine, evaluateCode } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'
import { liveUpdateEngine } from '../../engine/live-update'

export function PlayButton({ large = false }: { large?: boolean }) {
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const handleClick = useCallback(async () => {
    const state = useSessionStore.getState()

    if (state.isPlaying) {
      liveUpdateEngine.markPlayStopped()
      await stop()
      state.setPlaying(false)
      return
    }

    try {
      await resumeAudioContext()
      await initEngine()
      state.setPlaying(true)
      liveUpdateEngine.markPlayStarted()
      const code = composeTracks(state.tracks, state.bpm)
      await evaluateCode(code)
      liveUpdateEngine.markPlayStarted()
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
        flex items-center justify-center rounded-lg
        transition-all font-bold text-xl shrink-0
        ${large ? 'w-14 h-11 min-w-11 min-h-11' : 'w-14 h-10'}
        ${isPlaying
          ? 'bg-error/30 text-error hover:bg-error/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
          : 'bg-accent/30 text-accent hover:bg-accent/40 shadow-[0_0_12px_rgba(167,139,250,0.3)]'
        }
      `}
      title={isPlaying ? 'Stop (Ctrl+.)' : 'Play'}
    >
      {isPlaying ? '■' : '▶'}
    </button>
  )
}
