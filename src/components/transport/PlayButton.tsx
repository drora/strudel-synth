import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { evaluateCode, stop, composeTracks, initEngine } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'

export function PlayButton() {
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const handleClick = useCallback(async () => {
    const state = useSessionStore.getState()

    if (state.isPlaying) {
      await stop()
      state.setPlaying(false)
      return
    }

    try {
      await resumeAudioContext()
      await initEngine()
      const code = composeTracks(state.tracks, state.bpm)
      await evaluateCode(code)
      state.setPlaying(true)
    } catch (err) {
      console.error('Playback error:', err)
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
        flex items-center justify-center w-14 h-10 rounded-lg
        transition-all font-bold text-xl shrink-0
        ${isPlaying
          ? 'bg-error/30 text-error hover:bg-error/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
          : 'bg-accent/30 text-accent hover:bg-accent/40 shadow-[0_0_12px_rgba(167,139,250,0.3)]'
        }
      `}
      title={isPlaying ? 'Stop (Ctrl+.)' : 'Play (Ctrl+Enter)'}
    >
      {isPlaying ? '■' : '▶'}
    </button>
  )
}
