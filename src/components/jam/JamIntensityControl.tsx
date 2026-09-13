import { applyMutate } from '../../engine/jam-actions'
import { INTENSITY_MAX, INTENSITY_MIN } from '../../engine/intensity'
import { useJamStore } from '../../store/jam-store'

/**
 * One Intensity control: −  n/4  +. Bounds: − off at 1, + off at 4.
 * `vertical` = + / − on two rows matching the footer grid; n/4 overlays the middle.
 */
export function JamIntensityControl({ vertical = false }: { vertical?: boolean }) {
  const level = useJamStore((s) => s.intensityLevel ?? 1)
  const atMin = level <= INTENSITY_MIN
  const atMax = level >= INTENSITY_MAX

  const levelLabel = (
    <div className="px-1 text-center leading-tight">
      <div className="text-[9px] uppercase tracking-wide text-text-muted">Int</div>
      <div className="text-xs font-semibold tabular-nums text-text">
        {level}/{INTENSITY_MAX}
      </div>
    </div>
  )

  if (vertical) {
    const vBtn =
      'min-h-0 flex items-center justify-center text-base font-semibold text-text disabled:opacity-30 disabled:pointer-events-none'
    return (
      <div
        className="relative grid grid-rows-2 shrink-0 w-12 self-stretch rounded-xl border border-border bg-bg-elevated overflow-hidden"
        role="group"
        aria-label={`Intensity ${level} of ${INTENSITY_MAX}`}
      >
        <button
          type="button"
          disabled={atMax}
          onClick={() => applyMutate('intensity-up')}
          className={vBtn}
          aria-label="Intensity up"
          title={atMax ? 'Intensity 4 — max' : 'Intensity +'}
        >
          +
        </button>
        <button
          type="button"
          disabled={atMin}
          onClick={() => applyMutate('intensity-down')}
          className={`${vBtn} border-t border-border`}
          aria-label="Intensity down"
          title={atMin ? 'Intensity 1 — min' : 'Intensity −'}
        >
          −
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-md bg-bg-elevated/95 px-1 py-0.5">{levelLabel}</div>
        </div>
      </div>
    )
  }

  const hBtn =
    'min-h-11 min-w-11 text-base font-semibold text-text disabled:opacity-30 disabled:pointer-events-none'
  return (
    <div
      className="inline-flex items-center rounded-xl border border-border bg-bg-elevated"
      role="group"
      aria-label={`Intensity ${level} of ${INTENSITY_MAX}`}
    >
      <button
        type="button"
        disabled={atMin}
        onClick={() => applyMutate('intensity-down')}
        className={`${hBtn} rounded-l-xl`}
        aria-label="Intensity down"
        title={atMin ? 'Intensity 1 — min' : 'Intensity −'}
      >
        −
      </button>
      {levelLabel}
      <button
        type="button"
        disabled={atMax}
        onClick={() => applyMutate('intensity-up')}
        className={`${hBtn} rounded-r-xl`}
        aria-label="Intensity up"
        title={atMax ? 'Intensity 4 — max' : 'Intensity +'}
      >
        +
      </button>
    </div>
  )
}
