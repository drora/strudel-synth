import { useCallback } from 'react'
import { stopPlayback } from '../../engine/playback'

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  )
}

/** Hard stop: hush + reset cycle / phase to 0:00. Ctrl+. */
export function StopButton({ large = false, fill = false }: { large?: boolean; fill?: boolean }) {
  const handleClick = useCallback(async () => {
    await stopPlayback()
  }, [])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex items-center justify-center rounded-xl
        transition-all font-bold shrink-0 active:scale-95
        ${fill ? 'w-full min-w-0 h-12 min-h-12 text-xl' : large ? 'w-12 h-12 min-w-12 min-h-12 text-xl' : 'w-11 h-11 text-lg'}
        bg-bg-elevated text-text border border-border hover:bg-bg-surface shadow-none
      `}
      title="Stop (Ctrl+.)"
      aria-label="Stop"
    >
      <StopIcon />
    </button>
  )
}
