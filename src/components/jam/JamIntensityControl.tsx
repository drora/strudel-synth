import { applyMutate } from '../../engine/jam-actions'
import { INTENSITY_MAX, INTENSITY_MIN } from '../../engine/intensity'
import { useJamStore } from '../../store/jam-store'

/**
 * One Intensity control: −  n/4  +. Bounds: − off at 1, + off at 4.
 * `vertical` = + / n/4 / − stacked on the footer right.
 */
export function JamIntensityControl({ vertical = false }: { vertical?: boolean }) {
  const level = useJamStore((s) => s.intensityLevel ?? 1)
  const atMin = level <= INTENSITY_MIN
  const atMax = level >= INTENSITY_MAX

  const btn =
    'flex-1 min-h-11 min-w-11 text-base font-semibold text-text disabled:opacity-30 disabled:pointer-events-none'
  const levelBox = (
    <div className="px-1 text-center leading-tight shrink-0">
      <div className="text-[9px] uppercase tracking-wide text-text-muted">Int</div>
      <div className="text-xs font-semibold tabular-nums text-text">
        {level}/{INTENSITY_MAX}
      </div>
    </div>
  )

  return (
    <div
      className={
        vertical
          ? 'flex flex-col items-center shrink-0 w-14 self-stretch rounded-xl border border-border bg-bg-elevated'
          : 'inline-flex items-center rounded-xl border border-border bg-bg-elevated'
      }
      role="group"
      aria-label={`Intensity ${level} of ${INTENSITY_MAX}`}
    >
      {vertical ? (
        <>
          <button
            type="button"
            disabled={atMax}
            onClick={() => applyMutate('intensity-up')}
            className={`${btn} rounded-t-xl`}
            aria-label="Intensity up"
            title={atMax ? 'Intensity 4 — max' : 'Intensity +'}
          >
            +
          </button>
          {levelBox}
          <button
            type="button"
            disabled={atMin}
            onClick={() => applyMutate('intensity-down')}
            className={`${btn} rounded-b-xl`}
            aria-label="Intensity down"
            title={atMin ? 'Intensity 1 — min' : 'Intensity −'}
          >
            −
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={atMin}
            onClick={() => applyMutate('intensity-down')}
            className={`${btn} rounded-l-xl`}
            aria-label="Intensity down"
            title={atMin ? 'Intensity 1 — min' : 'Intensity −'}
          >
            −
          </button>
          {levelBox}
          <button
            type="button"
            disabled={atMax}
            onClick={() => applyMutate('intensity-up')}
            className={`${btn} rounded-r-xl`}
            aria-label="Intensity up"
            title={atMax ? 'Intensity 4 — max' : 'Intensity +'}
          >
            +
          </button>
        </>
      )}
    </div>
  )
}
