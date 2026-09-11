import { MUTATIONS, type MutateId } from '../../engine/mutate'
import { applyMutate } from '../../engine/jam-actions'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'

interface Props {
  onClose: () => void
}

/**
 * Tap menu of deterministic pattern transforms (Mutate ≠ Shuffle / Spice).
 */
export function JamMutateSheet({ onClose }: Props) {
  const lastTouched = useJamStore((s) => s.lastTouchedTrackId)
  const tracks = useSessionStore((s) => s.tracks)
  const target =
    (lastTouched && tracks.find((t) => t.id === lastTouched)) || tracks[0] || null

  const onPick = (id: MutateId) => {
    applyMutate(id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-label="Mutate"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85dvh] flex flex-col rounded-2xl bg-bg-elevated border border-border overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-accent">Mutate</div>
            <div className="text-sm font-semibold truncate text-text">
              Pattern transforms
            </div>
            <div className="text-[10px] text-text-muted truncate">
              {target
                ? `Track · ${target.name} · half/double = all tracks`
                : 'No tracks'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
          >
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 grid grid-cols-2 gap-1.5">
          {MUTATIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className="min-h-14 px-3 py-2 rounded-xl text-left bg-bg border border-border hover:border-accent/50 transition-colors"
              title={m.hint}
            >
              <div className="text-xs font-semibold text-text flex items-center gap-1.5">
                {m.label}
                {m.scope === 'song' && (
                  <span className="text-[9px] uppercase tracking-wide text-accent font-medium">
                    song
                  </span>
                )}
              </div>
              <div className="text-[10px] text-text-muted leading-snug">{m.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
