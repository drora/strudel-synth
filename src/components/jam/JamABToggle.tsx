import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useJamStore } from '../../store/jam-store'
import type { AbSlot } from '../../store/jam-store'

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

/**
 * Tiny A/B punch near Kit — stash current codes, punch between slots.
 * Tap empty slot to save; tap filled to apply; long-press (or right-click) to
 * overwrite; main chip toggles A↔B.
 */
export function JamABToggle() {
  const variantA = useJamStore((s) => s.variantA)
  const variantB = useJamStore((s) => s.variantB)
  const active = useJamStore((s) => s.activeVariant)

  const hasA = !!variantA
  const hasB = !!variantB

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="A/B variants">
      <AbSlotButton slot="a" filled={hasA} active={active === 'a'} />
      <button
        type="button"
        onClick={() => useJamStore.getState().toggleAb()}
        className="min-h-9 px-2 rounded-lg text-[10px] font-medium border border-border bg-bg-elevated text-text-muted hover:text-accent"
        title="Toggle A ↔ B (saves empty slots first)"
      >
        A↔B
      </button>
      <AbSlotButton slot="b" filled={hasB} active={active === 'b'} />
    </div>
  )
}

function AbSlotButton({
  slot,
  filled,
  active,
}: {
  slot: AbSlot
  filled: boolean
  active: boolean
}) {
  const label = slot.toUpperCase()
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const longPressFired = useRef(false)

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    startPos.current = null
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressFired.current) {
          longPressFired.current = false
          return
        }
        useJamStore.getState().punchVariant(slot)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        clearHold()
        useJamStore.getState().stashVariant(slot)
      }}
      onPointerDown={(e: ReactPointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        // Touch: block browser callout/context dialog so hold can stash.
        if (e.pointerType === 'touch') e.preventDefault()
        longPressFired.current = false
        startPos.current = { x: e.clientX, y: e.clientY }
        clearHold()
        holdTimer.current = setTimeout(() => {
          holdTimer.current = null
          longPressFired.current = true
          try {
            ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
          } catch {
            /* ignore */
          }
          useJamStore.getState().stashVariant(slot)
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
      className={`min-h-9 min-w-9 px-2 rounded-lg text-[11px] font-semibold border transition-colors touch-manipulation select-none ${
        active
          ? 'bg-accent text-bg border-accent'
          : filled
            ? 'bg-accent/15 text-accent border-accent/40'
            : 'bg-bg-elevated text-text-muted border-border'
      }`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      title={
        filled
          ? `Punch ${label} (long-press / right-click: re-save)`
          : `Save current as ${label} (long-press overwrites)`
      }
    >
      {label}
      {filled ? '' : '·'}
    </button>
  )
}
