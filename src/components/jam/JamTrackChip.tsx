import { useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { liveUpdateEngine } from '../../engine/live-update'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import type { Track } from '../../engine/types'
import { queueJamImmediate, trackSoundHint } from './jam-shell-utils'
import { useLoopPhaseCallback } from '../../hooks/useLoopPhase'

/** Fixed outer size so mute / phase / hint never reflow the row. */
export const CHIP_OUTER_CLASS =
  'relative shrink-0 w-[7.25rem] h-[2.75rem] rounded-lg p-[1.5px] box-border'

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

function openCodeForTrack(trackId: string) {
  useSessionStore.getState().setActiveTrack(trackId)
  const jam = useJamStore.getState()
  jam.touchTrack(trackId)
  jam.setCodeTrackId(trackId)
}

/**
 * Jam home track chip: tap → Sound|FX sheet, M → mute, long-press/context → Code.
 * Subtle conic phase tick on the border while playing (shared cycle; DOM-painted).
 * Outer box is fixed-size — mute only changes opacity/style; phase never changes layout.
 */
export function JamTrackChip({
  track,
  isPlaying,
}: {
  track: Track
  isPlaying: boolean
}) {
  const hint = trackSoundHint(track.code)
  const isLastTouched = useJamStore((s) => s.lastTouchedTrackId === track.id)
  const wrapRef = useRef<HTMLDivElement>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const longPressFired = useRef(false)

  useLoopPhaseCallback(isPlaying, (phase) => {
    const el = wrapRef.current
    if (!el) return
    if (!isPlaying) {
      el.style.background = 'transparent'
      return
    }
    el.style.background = `conic-gradient(from -90deg, ${track.color} ${phase * 360}deg, rgba(255,255,255,0.08) 0)`
  })

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    startPos.current = null
  }

  const onMute = (e: MouseEvent | ReactPointerEvent) => {
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
      className={`${CHIP_OUTER_CLASS} transition-opacity ${track.muted ? 'opacity-45' : 'opacity-100'} ${
        isLastTouched ? 'jam-chip-last-touched' : ''
      }`}
      style={{ background: 'transparent' }}
      data-last-touched={isLastTouched ? 'true' : undefined}
    >
      {isLastTouched && (
        <span
          className="pointer-events-none absolute -top-0.5 -right-0.5 z-[2] h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_1px_var(--color-bg)]"
          aria-hidden
        />
      )}
      <div
        className={`flex items-stretch w-full h-full rounded-[6.5px] border bg-bg-elevated overflow-hidden ${
          isLastTouched ? 'ring-1 ring-accent ring-offset-0' : ''
        }`}
        style={{ borderColor: track.color + '88' }}
      >
        <button
          type="button"
          onClick={() => {
            if (longPressFired.current) {
              longPressFired.current = false
              return
            }
            const jam = useJamStore.getState()
            jam.touchTrack(track.id)
            jam.setSoundTrackId(track.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            clearHold()
            openCodeForTrack(track.id)
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return
            // Touch: block browser callout/context dialog so hold can open Code.
            if (e.pointerType === 'touch') e.preventDefault()
            longPressFired.current = false
            startPos.current = { x: e.clientX, y: e.clientY }
            clearHold()
            holdTimer.current = setTimeout(() => {
              holdTimer.current = null
              longPressFired.current = true
              try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
              openCodeForTrack(track.id)
              useJamStore.getState().setLastPeek(`${track.name} · Code`)
            }, LONG_PRESS_MS)
          }}
          onPointerMove={(e) => {
            const start = startPos.current
            if (!start || !holdTimer.current) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearHold()
          }}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onPointerCancel={clearHold}
          className="flex-1 min-w-0 h-full px-2 py-1 text-[10px] text-left leading-tight flex flex-col justify-center touch-manipulation select-none"
          style={{ color: track.color, WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          title="Sound / FX — long-press for Code"
        >
          <div className="font-medium truncate flex items-center gap-0.5">
            {track.locked && (
              <span className="shrink-0" aria-hidden title="Locked">
                {'\uD83D\uDD12'}
              </span>
            )}
            <span className="truncate">{track.name}</span>
          </div>
          {/* Always reserve second line so hint presence never changes chip height */}
          <div className="opacity-70 truncate h-[1em]">{hint || '\u00a0'}</div>
        </button>
        <button
          type="button"
          onClick={onMute}
          onPointerDown={(e) => {
            // Keep M from also opening the Sound|FX sheet via parent/sibling gesture bleed.
            e.stopPropagation()
          }}
          className={`shrink-0 w-9 h-full text-[10px] font-bold border-l ${
            track.muted
              ? 'bg-error/20 text-error border-error/30'
              : 'bg-transparent text-text-muted border-border/60 hover:text-accent'
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
