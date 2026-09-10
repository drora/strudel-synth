import { useRef } from 'react'
import { useLoopPhaseCallback, usePlayingLoopPhase } from '../../hooks/useLoopPhase'

/**
 * Soft cycle-phase progress around the BPM readout.
 * Arc painted via shared RAF (no per-frame React commits for the stroke).
 */
export function JamPhaseRing({
  bpm,
  isPlaying,
}: {
  bpm: number
  isPlaying: boolean
}) {
  const { phase } = usePlayingLoopPhase()
  const arcRef = useRef<SVGCircleElement>(null)
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

  const progress = isPlaying ? phase : 0

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={isPlaying ? `Loop phase ${(progress * 100).toFixed(0)} percent` : `BPM ${bpm}`}
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
      <span className="text-2xl font-semibold tabular-nums relative z-[1]">{bpm}</span>
      {isPlaying && (
        <span className="text-[9px] text-accent/80 tabular-nums relative z-[1] mt-0.5">
          {(progress * 4 + 1).toFixed(1).replace(/\.0$/, '')}/4
        </span>
      )}
    </div>
  )
}
