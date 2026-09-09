import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { startPlayback, stopPlayback } from '../../engine/playback'

export function PlayButton({ large = false }: { large?: boolean }) {
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const handleClick = useCallback(async () => {
    if (useSessionStore.getState().isPlaying) {
      await stopPlayback()
      return
    }
    await startPlayback()
  }, [])

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center justify-center rounded-xl
        transition-all font-bold shrink-0 active:scale-95
        ${large ? 'w-16 h-12 min-w-12 min-h-12 text-2xl' : 'w-14 h-11 text-xl'}
        ${isPlaying
          ? 'bg-bg-elevated text-text border border-border hover:bg-bg-surface shadow-none'
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
