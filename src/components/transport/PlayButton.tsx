import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { startPlayback, pausePlayback } from '../../engine/playback'

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="0.5" />
      <rect x="14" y="5" width="4" height="14" rx="0.5" />
    </svg>
  )
}

export function PlayButton({ large = false, fill = false }: { large?: boolean; fill?: boolean }) {
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const handleClick = useCallback(async () => {
    if (useSessionStore.getState().isPlaying) {
      await pausePlayback()
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
        ${fill ? 'w-full min-w-0 h-12 min-h-12 text-2xl' : large ? 'w-16 h-12 min-w-12 min-h-12 text-2xl' : 'w-14 h-11 text-xl'}
        ${isPlaying
          ? 'bg-bg-elevated text-text border border-border hover:bg-bg-surface shadow-none'
          : 'bg-accent text-bg hover:bg-accent/90 shadow-[0_0_18px_rgba(167,139,250,0.45)]'
        }
      `}
      title={isPlaying ? 'Pause' : 'Play'}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>
  )
}
