import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { setBpm as engineSetBpm } from '../../engine/strudel'
import { setSongBarsLength } from '../../engine/jam-actions'
import { SONG_BARS_OPTIONS, type SongBars, songBarIndex } from '../../engine/song-bars'
import { useLoopPhaseCallback, usePlayingLoopPhase } from '../../hooks/useLoopPhase'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'

const BPM_MIN = 40
const BPM_MAX = 240

function clampBpm(n: number): number {
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)))
}

/** Store immediately; engine recomposes full session while playing (debounced in setBpm). */
function applyBpm(next: number) {
  const bpm = clampBpm(next)
  useSessionStore.getState().setBpm(bpm)
  void engineSetBpm(bpm)
}

/**
 * Soft cycle-phase progress around an editable BPM readout.
 * Arc painted via shared RAF (no per-frame React commits for the stroke).
 * −5 / −1 / +1 / +5 beside the ring; tap/long-press BPM to type (40–240).
 * Bars picker (1 / 2 / 4) under the ring — one spin = one bar; n/N when multi-bar.
 */
export function JamPhaseRing({
  bpm,
  isPlaying,
}: {
  bpm: number
  isPlaying: boolean
}) {
  const songBars = useJamStore((s) => s.songBars ?? 1) as SongBars
  const { phase, cycleInt } = usePlayingLoopPhase()
  const arcRef = useRef<SVGCircleElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(bpm))
  const inputRef = useRef<HTMLInputElement>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const size = 112
  const stroke = 3.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  useLoopPhaseCallback(isPlaying, (p) => {
    const el = arcRef.current
    if (!el) return
    const progress = isPlaying ? p : 0
    const dash = c * progress
    el.setAttribute('stroke-dasharray', `${dash} ${c - dash}`)
  })

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current)
      holdInterval.current = null
    }
  }, [])

  useEffect(() => () => clearHold(), [clearHold])

  useEffect(() => {
    if (!editing) setDraft(String(bpm))
  }, [bpm, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const nudge = useCallback((delta: number) => {
    const cur = useSessionStore.getState().bpm
    applyBpm(cur + delta)
  }, [])

  const startHold = (delta: number) => (e: ReactPointerEvent) => {
    e.preventDefault()
    nudge(delta)
    clearHold()
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => nudge(delta), 80)
    }, 380)
  }

  const commitDraft = () => {
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(parsed)) applyBpm(parsed)
    setEditing(false)
  }

  const progress = isPlaying ? phase : 0
  const barN = songBarIndex(cycleInt, songBars)

  const btnClass =
    'min-h-11 min-w-11 shrink-0 rounded-lg text-xs font-semibold tabular-nums border border-border bg-bg-elevated text-text-muted hover:text-accent hover:border-accent/50 active:bg-accent/15 touch-manipulation select-none'

  const barBtn = (n: SongBars) =>
    `min-h-9 min-w-9 rounded-md text-xs font-semibold tabular-nums border touch-manipulation select-none ${
      songBars === n
        ? 'border-accent bg-accent/20 text-accent'
        : 'border-border bg-bg-elevated text-text-muted hover:text-accent hover:border-accent/50'
    }`

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center justify-center gap-1.5"
        aria-label={
          isPlaying
            ? songBars > 1
              ? `Bar ${barN} of ${songBars}, loop phase ${(progress * 100).toFixed(0)} percent, BPM ${bpm}`
              : `Loop phase ${(progress * 100).toFixed(0)} percent, BPM ${bpm}`
            : `BPM ${bpm}, ${songBars} bar${songBars === 1 ? '' : 's'}`
        }
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className={btnClass}
            aria-label="Decrease BPM by 5"
            title="−5 BPM"
            onPointerDown={startHold(-5)}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            −5
          </button>
          <button
            type="button"
            className={btnClass}
            aria-label="Decrease BPM by 1"
            title="−1 BPM"
            onPointerDown={startHold(-1)}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            −1
          </button>
        </div>

        <div
          className="relative flex flex-col items-center justify-center"
          style={{ width: size, height: size }}
        >
          <svg
            width={size}
            height={size}
            className="absolute inset-0 -rotate-90"
            aria-hidden
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(167,139,250,0.22)"
              strokeWidth={stroke}
            />
            <circle
              ref={arcRef}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(167,139,250,0.85)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`0 ${c}`}
              style={{
                transition: isPlaying ? 'none' : 'stroke-dasharray 200ms ease',
                filter: isPlaying
                  ? 'drop-shadow(0 0 4px rgba(167,139,250,0.45))'
                  : undefined,
              }}
            />
          </svg>
          <span className="text-[10px] text-text-muted uppercase relative z-[1]">BPM</span>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft}
              aria-label="Edit BPM"
              className="relative z-[1] w-16 text-center text-2xl font-semibold tabular-nums bg-bg-elevated border border-accent rounded-md outline-none text-text"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitDraft()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setDraft(String(bpm))
                  setEditing(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="text-2xl font-semibold tabular-nums relative z-[1] min-h-11 min-w-[3.5rem] px-1 rounded-md hover:bg-accent/10 touch-manipulation"
              title="Tap to type BPM"
              aria-label={`BPM ${bpm}, tap to edit`}
              onClick={() => {
                setDraft(String(bpm))
                setEditing(true)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setDraft(String(bpm))
                setEditing(true)
              }}
            >
              {bpm}
            </button>
          )}
          {isPlaying && (
            <span className="text-[9px] text-accent/80 tabular-nums relative z-[1] mt-0.5">
              {songBars > 1
                ? `${barN}/${songBars}`
                : `${(progress * 4 + 1).toFixed(1).replace(/\.0$/, '')}/4`}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            className={btnClass}
            aria-label="Increase BPM by 5"
            title="+5 BPM"
            onPointerDown={startHold(5)}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            +5
          </button>
          <button
            type="button"
            className={btnClass}
            aria-label="Increase BPM by 1"
            title="+1 BPM"
            onPointerDown={startHold(1)}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            +1
          </button>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label="Song length in bars"
      >
        <span className="text-[10px] uppercase tracking-wider text-text-muted mr-0.5">
          Bars
        </span>
        {SONG_BARS_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            className={barBtn(n)}
            aria-pressed={songBars === n}
            aria-label={`${n} bar${n === 1 ? '' : 's'}`}
            title={`${n} bar${n === 1 ? '' : 's'} · unlocked reshuffle · locked tile/trim`}
            onClick={() => setSongBarsLength(n)}
          >
            {n}
          </button>
        ))}
        {songBars > 1 && !isPlaying && (
          <span className="text-[9px] text-text-muted/70 tabular-nums ml-1" aria-hidden>
            {Array.from({ length: songBars }, (_, i) => (i === 0 ? '●' : '○')).join('')}
          </span>
        )}
      </div>
    </div>
  )
}
