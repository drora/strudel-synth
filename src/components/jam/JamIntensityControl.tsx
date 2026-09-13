import { applyMutate } from '../../engine/jam-actions'
import { INTENSITY_MAX, INTENSITY_MIN } from '../../engine/intensity'
import { useJamStore } from '../../store/jam-store'

/**
 * One Intensity control: −  n/4  +. Bounds: − off at 1, + off at 4.
 */
export function JamIntensityControl() {
  const level = useJamStore((s) => s.intensityLevel ?? 1)
  const atMin = level <= INTENSITY_MIN
  const atMax = level >= INTENSITY_MAX

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
        className="min-h-11 min-w-11 rounded-l-xl text-base font-semibold text-text disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Intensity down"
        title={atMin ? 'Intensity 1 — min' : 'Intensity −'}
      >
        −
      </button>
      <div className="px-1.5 text-center leading-tight min-w-10">
        <div className="text-[9px] uppercase tracking-wide text-text-muted">Int</div>
        <div className="text-xs font-semibold tabular-nums text-text">
          {level}/{INTENSITY_MAX}
        </div>
      </div>
      <button
        type="button"
        disabled={atMax}
        onClick={() => applyMutate('intensity-up')}
        className="min-h-11 min-w-11 rounded-r-xl text-base font-semibold text-text disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Intensity up"
        title={atMax ? 'Intensity 4 — max' : 'Intensity +'}
      >
        +
      </button>
    </div>
  )
}
