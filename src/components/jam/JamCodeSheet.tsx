import { TrackCodePane } from '../editor/TrackCodePane'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import type { Track } from '../../engine/types'

interface JamCodeSheetProps {
  track: Track
}

/**
 * Code as a Jam overlay sheet — reuses TrackCodePane guts, not a mode switch.
 */
export function JamCodeSheet({ track }: JamCodeSheetProps) {
  const live = useSessionStore((s) => s.tracks.find((t) => t.id === track.id)) ?? track

  const close = () => useJamStore.getState().setCodeTrackId(null)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-label={`Code · ${live.name}`}
    >
      <div className="w-full max-w-2xl max-h-[90dvh] sm:max-h-[85vh] flex flex-col rounded-2xl bg-bg-elevated border border-border overflow-hidden shadow-2xl">
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-accent">Code</div>
            <div className="text-sm font-semibold truncate" style={{ color: live.color }}>
              {live.name}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="min-h-11 min-w-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
          >
            Done
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TrackCodePane track={live} isActive focusMode />
        </div>
      </div>
    </div>
  )
}
