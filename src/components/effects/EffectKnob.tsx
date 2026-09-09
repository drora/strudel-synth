import { useCallback, useRef } from 'react'

interface EffectKnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Called when user Alt/Option-drags a patterned knob (confirm overwrite). */
  onForceChange?: (value: number) => void
  isActive: boolean
  /** True when code has a non-scalar patterned argument for this param. */
  isPattern?: boolean
}

export function EffectKnob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onForceChange,
  isActive,
  isPattern = false,
}: EffectKnobProps) {
  const dragStartY = useRef<number | null>(null)
  const dragStartValue = useRef(0)
  const forceRef = useRef(false)
  const lastStepped = useRef(value)
  const didMove = useRef(false)

  const normalizedValue = (value - min) / (max - min)
  const displayValue = isPattern
    ? 'pat'
    : step >= 1
      ? Math.round(value)
      : value.toFixed(step < 0.1 ? 2 : 1)

  const stepValue = useCallback(
    (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw))
      return Math.round(clamped / step) * step
    },
    [min, max, step],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isPattern && !e.altKey) {
        // Block scalar overwrite; hint via title. Alt+drag → confirm path.
        return
      }
      forceRef.current = Boolean(isPattern && e.altKey)
      didMove.current = false
      dragStartY.current = e.clientY
      dragStartValue.current = value
      lastStepped.current = value
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [value, isPattern]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return
      const delta = dragStartY.current - e.clientY
      const range = max - min
      const stepped = stepValue(dragStartValue.current + (delta / 150) * range)
      lastStepped.current = stepped
      didMove.current = true
      if (forceRef.current) {
        // Confirm only on pointer-up — avoid confirm spam while dragging
        return
      }
      onChange(stepped)
    },
    [min, max, stepValue, onChange]
  )

  const handlePointerUp = useCallback(() => {
    if (forceRef.current && didMove.current && onForceChange && dragStartY.current !== null) {
      onForceChange(lastStepped.current)
    }
    dragStartY.current = null
    forceRef.current = false
  }, [onForceChange])

  // SVG arc for the knob
  const startAngle = -135
  const endAngle = 135
  const sweepAngle = startAngle + normalizedValue * (endAngle - startAngle)
  const r = 16
  const cx = 20
  const cy = 20

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const bgStart = polarToCartesian(startAngle)
  const bgEnd = polarToCartesian(endAngle)
  const valueEnd = polarToCartesian(sweepAngle)

  const bgArc = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`
  const valueArc = normalizedValue > 0.01
    ? `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${sweepAngle - startAngle > 180 ? 1 : 0} 1 ${valueEnd.x} ${valueEnd.y}`
    : ''

  const stroke = isPattern ? '#f59e0b' : isActive ? '#a78bfa' : '#555566'

  return (
    <div
      className={`relative flex flex-col items-center select-none ${
        isPattern ? 'cursor-not-allowed opacity-90' : 'cursor-ns-resize'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={
        isPattern
          ? 'Patterned value — drag blocked. Alt+drag to replace with a scalar (confirms).'
          : undefined
      }
    >
      {isPattern && (
        <span className="absolute -top-0.5 right-0 z-10 px-1 py-px rounded text-[8px] font-medium uppercase tracking-wide bg-amber-500/25 text-amber-300 border border-amber-500/40">
          pattern
        </span>
      )}
      <svg width={40} height={40} viewBox="0 0 40 40">
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="#2a2a3a" strokeWidth={3} strokeLinecap="round" />
        {/* Value arc */}
        {valueArc && !isPattern && (
          <path
            d={valueArc}
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
        {isPattern && (
          <path
            d={bgArc}
            fill="none"
            stroke="#f59e0b66"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
        )}
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2} fill={stroke} />
      </svg>
      <span className="text-[9px] text-text-muted mt-0.5">{label}</span>
      <span className={`text-[9px] font-mono ${isPattern ? 'text-amber-300' : isActive ? 'text-accent' : 'text-text-muted'}`}>
        {displayValue}
      </span>
    </div>
  )
}
