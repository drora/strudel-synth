import { useCallback, useRef } from 'react'

interface EffectKnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  isActive: boolean
}

export function EffectKnob({ label, value, min, max, step, onChange, isActive }: EffectKnobProps) {
  const dragStartY = useRef<number | null>(null)
  const dragStartValue = useRef(0)

  const normalizedValue = (value - min) / (max - min)
  const displayValue = step >= 1 ? Math.round(value) : value.toFixed(step < 0.1 ? 2 : 1)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStartY.current = e.clientY
      dragStartValue.current = value
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [value]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return
      const delta = dragStartY.current - e.clientY
      const range = max - min
      const newValue = dragStartValue.current + (delta / 150) * range
      const clamped = Math.max(min, Math.min(max, newValue))
      const stepped = Math.round(clamped / step) * step
      onChange(stepped)
    },
    [min, max, step, onChange]
  )

  const handlePointerUp = useCallback(() => {
    dragStartY.current = null
  }, [])

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

  return (
    <div
      className="flex flex-col items-center cursor-ns-resize select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg width={40} height={40} viewBox="0 0 40 40">
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="#2a2a3a" strokeWidth={3} strokeLinecap="round" />
        {/* Value arc */}
        {valueArc && (
          <path
            d={valueArc}
            fill="none"
            stroke={isActive ? '#a78bfa' : '#555566'}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2} fill={isActive ? '#a78bfa' : '#555566'} />
      </svg>
      <span className="text-[9px] text-text-muted mt-0.5">{label}</span>
      <span className={`text-[9px] font-mono ${isActive ? 'text-accent' : 'text-text-muted'}`}>
        {displayValue}
      </span>
    </div>
  )
}
