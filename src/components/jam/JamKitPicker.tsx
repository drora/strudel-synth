import type { Kit } from '../../engine/kits'

interface Props {
  kits: Kit[]
  kitId: string | null
  onPick: (id: string) => void
  onSkip: () => void
}

export function JamKitPicker({ kits, kitId, onPick, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3">
        <div className="text-sm font-semibold">Pick a kit</div>
        <p className="text-xs text-text-muted">
          Timbre is the difference — choose how this jam should sound.
        </p>
        <div className="grid grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto">
          {kits.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onPick(k.id)}
              className={`min-h-14 px-3 py-3 rounded-xl border text-left transition-colors ${
                kitId === k.id
                  ? 'border-accent bg-accent/15'
                  : 'border-border hover:border-accent'
              }`}
            >
              <div className="text-sm font-medium">{k.name}</div>
              <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{k.description}</div>
            </button>
          ))}
        </div>
        <button type="button" className="w-full min-h-11 text-xs text-text-muted" onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
