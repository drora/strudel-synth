import type { MouseEvent, PointerEvent } from 'react'
import { liveUpdateEngine } from '../../engine/live-update'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import type { Track } from '../../engine/types'
import { queueJam, trackSoundHint } from './jam-shell-utils'

function openCodeForTrack(trackId: string) {
  useSessionStore.getState().setActiveTrack(trackId)
  useJamStore.getState().setCodeTrackId(trackId)
}

/**
 * Jam home track chip: tap → Sound|FX sheet, M → mute, long-press/context → Code.
 * Subtle conic phase tick on the border while playing (shared cycle fraction).
 */
export function JamTrackChip({
  track,
  phase,
  isPlaying,
}: {
  track: Track
  phase: number
  isPlaying: boolean
}) {
  const hint = trackSoundHint(track.code)
  const progress = isPlaying ? phase : 0

  const onMute = (e: MouseEvent | PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    useSessionStore.getState().toggleMute(track.id)
    const muted = useSessionStore.getState().tracks.find((t) => t.id === track.id)?.muted
    useJamStore.getState().setLastPeek(`${track.name} · ${muted ? 'muted' : 'on'}`)
    liveUpdateEngine.markDirty()
    queueJam('mute-solo')
  }

  return (
    <div
      className={`relative rounded-lg p-[1.5px] transition-[opacity] ${
        track.muted ? 'opacity-45' : ''
      }`}
      style={{
        background: isPlaying
          ? `conic-gradient(from -90deg, ${track.color} ${progress * 360}deg, rgba(255,255,255,0.08) 0)`
          : 'transparent',
      }}
    >
      <div
        className="flex items-stretch rounded-[6.5px] border bg-bg-elevated overflow-hidden min-h-10"
        style={{ borderColor: track.color + '88' }}
      >
        <button
          type="button"
          onClick={() => useJamStore.getState().setSoundTrackId(track.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            openCodeForTrack(track.id)
          }}
          className="flex-1 min-h-10 px-2.5 py-1 text-[10px] text-left leading-tight"
          style={{ color: track.color }}
          title="Sound / FX — right-click for Code"
        >
          <div className="font-medium truncate max-w-[6.5rem]">{track.name}</div>
          {hint && (
            <div className="opacity-70 truncate max-w-[6.5rem]">{hint}</div>
          )}
        </button>
        <button
          type="button"
          onClick={onMute}
          className={`shrink-0 min-w-9 min-h-10 px-1.5 text-[10px] font-bold border-l ${
            track.muted
              ? 'bg-error/20 text-error border-error/30'
              : 'text-text-muted border-border/60 hover:text-accent'
          }`}
          style={{ borderLeftColor: track.color + '44' }}
          title={track.muted ? 'Unmute' : 'Mute'}
          aria-label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
          aria-pressed={track.muted}
        >
          M
        </button>
      </div>
    </div>
  )
}
