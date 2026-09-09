import { useJamStore } from '../../store/jam-store'

/**
 * Tiny A/B punch near Kit — stash current codes, punch between slots.
 * Tap empty slot to save; tap filled to apply; main chip toggles A↔B.
 */
export function JamABToggle() {
  const variantA = useJamStore((s) => s.variantA)
  const variantB = useJamStore((s) => s.variantB)
  const active = useJamStore((s) => s.activeVariant)

  const hasA = !!variantA
  const hasB = !!variantB

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="A/B variants">
      <button
        type="button"
        onClick={() => useJamStore.getState().punchVariant('a')}
        onContextMenu={(e) => {
          e.preventDefault()
          useJamStore.getState().stashVariant('a')
        }}
        className={`min-h-9 min-w-9 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
          active === 'a'
            ? 'bg-accent text-bg border-accent'
            : hasA
              ? 'bg-accent/15 text-accent border-accent/40'
              : 'bg-bg-elevated text-text-muted border-border'
        }`}
        title={hasA ? 'Punch A (right-click: re-save)' : 'Save current as A'}
      >
        A{hasA ? '' : '·'}
      </button>
      <button
        type="button"
        onClick={() => useJamStore.getState().toggleAb()}
        className="min-h-9 px-2 rounded-lg text-[10px] font-medium border border-border bg-bg-elevated text-text-muted hover:text-accent"
        title="Toggle A ↔ B (saves empty slots first)"
      >
        A↔B
      </button>
      <button
        type="button"
        onClick={() => useJamStore.getState().punchVariant('b')}
        onContextMenu={(e) => {
          e.preventDefault()
          useJamStore.getState().stashVariant('b')
        }}
        className={`min-h-9 min-w-9 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
          active === 'b'
            ? 'bg-accent text-bg border-accent'
            : hasB
              ? 'bg-accent/15 text-accent border-accent/40'
              : 'bg-bg-elevated text-text-muted border-border'
        }`}
        title={hasB ? 'Punch B (right-click: re-save)' : 'Save current as B'}
      >
        B{hasB ? '' : '·'}
      </button>
    </div>
  )
}
