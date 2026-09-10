import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { liveUpdateEngine } from '../../engine/live-update'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import type { Track } from '../../engine/types'
import { queueJamImmediate, trackSoundHint } from './jam-shell-utils'
import { useLoopPhaseCallback } from '../../hooks/useLoopPhase'

function openCodeForTrack(trackId: string) {
  useSessionStore.getState().setActiveTrack(trackId)
  useJamStore.getState().setCodeTrackId(trackId)
}

/**
 * Jam home track chip: tap → Sound|FX sheet, M → mute, long-press/context → Code.
 * Subtle conic phase tick on the border while playing (shared cycle; DOM-painted).
 */
export function JamTrackChip({
  track,
  isPlaying,
}: {
  track: Track
  isPlaying: boolean
}) {
  const hint = trackSoundHint(track.code)
  const wrapRef = useRef<HTMLDivElement>(null)

  useLoopPhaseCallback(isPlaying, (phase) => {
    const el = wrapRef.current
    if (!el) return
    if (!isPlaying) {
      el.style.background = 'transparent'
      return
    }
    el.style.background = `conic-gradient(from -90deg, ${track.color} ${phase * 360}deg, rgba(255,255,255,0.08) 0)`
  })

  const onMute = (e: MouseEvent | PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Resolve from current store snapshot — ignore stale/deleted ids after remove.
    const session = useSessionStore.getState()
    const current = session.tracks.find((t) => t.id === track.id)
    if (!current) return
    session.toggleMute(current.id)
    const muted = useSessionStore.getState().tracks.find((t) => t.id === current.id)?.muted
    useJamStore.getState().setLastPeek(`${current.name} · ${muted ? 'muted' : 'on'}`)
    liveUpdateEngine.markDirty()
    queueJamImmediate('mute-solo')
  }

  return (
    <div
      ref={wrapRef}
      className={`relative rounded-lg p-[1.5px] transition-[opacity] ${
        track.muted ? 'opacity-45' : ''
      }`}
      style={{ background: 'transparent' }}
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
          onPointerDown={(e) => {
            // Keep M from also opening the Sound|FX sheet via parent/sibling gesture bleed.
            e.stopPropagation()
          }}
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
