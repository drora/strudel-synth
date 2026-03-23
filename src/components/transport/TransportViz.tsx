import { useEffect, useRef, useState, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'

type VizMode = 'spectrum' | 'levels'

/**
 * Compact transport visualizer with two modes:
 * - spectrum: animated frequency-like bars synced to beat
 * - levels: per-track volume level bars
 * Click to toggle between modes.
 * Track dots are always centered above the visualization.
 */
export function TransportViz() {
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const tracks = useSessionStore((s) => s.tracks)
  const bpm = useSessionStore((s) => s.bpm)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [mode, setMode] = useState<VizMode>('spectrum')

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'spectrum' ? 'levels' : 'spectrum'))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    if (!isPlaying) {
      // Static state — dim track dots only
      ctx.clearRect(0, 0, w, h)
      drawTrackDots(ctx, tracks, w, 0)
      return
    }

    const cps = bpm / 60 / 4
    // Simulated "frequency" data driven by beat timing
    const barCount = 24
    const barValues = new Float32Array(barCount)
    const barTargets = new Float32Array(barCount)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      const now = performance.now() / 1000
      const cycle = (now * cps) % 1
      const beat = (cycle * 4) % 1
      const pulseIntensity = Math.max(0, 1 - beat * 4)

      // Draw track dots (top row, centered)
      drawTrackDots(ctx, tracks, w, pulseIntensity)

      if (mode === 'spectrum') {
        drawSpectrum(ctx, w, h, barCount, barValues, barTargets, pulseIntensity, cycle)
      } else {
        drawLevels(ctx, w, h, tracks, pulseIntensity)
      }

      // Beat position line
      const lineX = cycle * w
      ctx.fillStyle = 'rgba(167, 139, 250, 0.6)'
      ctx.fillRect(lineX, 12, 1, h - 12)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [isPlaying, bpm, tracks, mode])

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={36}
      className="rounded cursor-pointer"
      onClick={toggleMode}
      title={`Click to switch to ${mode === 'spectrum' ? 'level meters' : 'spectrum'}`}
    />
  )
}

function drawTrackDots(
  ctx: CanvasRenderingContext2D,
  tracks: ReturnType<typeof useSessionStore.getState>['tracks'],
  canvasWidth: number,
  pulseIntensity: number,
) {
  const dotSize = 3
  const dotGap = 12
  const totalWidth = tracks.length * dotGap
  const startX = (canvasWidth - totalWidth) / 2 + dotGap / 2

  tracks.forEach((t, i) => {
    const x = startX + i * dotGap
    const y = 6

    // Glow for active (non-muted) tracks
    if (!t.muted && pulseIntensity > 0.1) {
      ctx.beginPath()
      ctx.arc(x, y, dotSize + 2 + pulseIntensity * 2, 0, Math.PI * 2)
      ctx.fillStyle = t.color + '20'
      ctx.fill()
    }

    // Dot — muted tracks get dimmed color (not hidden)
    ctx.beginPath()
    ctx.arc(x, y, dotSize, 0, Math.PI * 2)
    ctx.fillStyle = t.muted ? t.color + '35' : t.color
    ctx.fill()

    // Mute strike-through
    if (t.muted) {
      ctx.beginPath()
      ctx.moveTo(x - dotSize - 1, y)
      ctx.lineTo(x + dotSize + 1, y)
      ctx.strokeStyle = '#ef444480'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  })
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  barCount: number,
  barValues: Float32Array,
  barTargets: Float32Array,
  pulseIntensity: number,
  cycle: number,
) {
  const vizTop = 14
  const vizH = h - vizTop - 2
  const barWidth = (w - 8) / barCount
  const startX = 4

  // Generate beat-driven "spectrum" targets
  for (let i = 0; i < barCount; i++) {
    // Low frequencies pulse with kick, high with hats
    const freqFactor = i / barCount
    const kickContrib = (1 - freqFactor) * pulseIntensity * 0.8
    const hatContrib = freqFactor * (Math.sin(cycle * Math.PI * 8 + i) * 0.3 + 0.2)
    const noise = Math.sin(performance.now() * 0.003 + i * 1.7) * 0.1
    barTargets[i] = Math.max(0.05, Math.min(1, kickContrib + hatContrib + noise + 0.08))
  }

  // Smooth interpolation
  for (let i = 0; i < barCount; i++) {
    barValues[i] += (barTargets[i] - barValues[i]) * 0.3
  }

  // Draw bars with gradient
  for (let i = 0; i < barCount; i++) {
    const x = startX + i * barWidth
    const barH = barValues[i] * vizH
    const y = vizTop + vizH - barH

    // Color gradient: cyan (low) → purple (mid) → magenta (high)
    const hue = 180 + (i / barCount) * 140
    const lightness = 45 + barValues[i] * 25
    const alpha = 0.5 + barValues[i] * 0.5

    ctx.fillStyle = `hsla(${hue}, 75%, ${lightness}%, ${alpha})`
    ctx.fillRect(x, y, barWidth - 1, barH)

    // Bright top cap
    if (barH > 2) {
      ctx.fillStyle = `hsla(${hue}, 90%, 70%, ${alpha})`
      ctx.fillRect(x, y, barWidth - 1, 1.5)
    }
  }
}

function drawLevels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tracks: ReturnType<typeof useSessionStore.getState>['tracks'],
  pulseIntensity: number,
) {
  const vizTop = 14
  const vizH = h - vizTop - 2
  const trackCount = tracks.length
  if (trackCount === 0) return

  const barWidth = Math.min(30, (w - 16) / trackCount)
  const totalWidth = trackCount * barWidth
  const startX = (w - totalWidth) / 2

  tracks.forEach((t, i) => {
    const x = startX + i * barWidth
    const volume = t.muted ? 0 : t.volume
    const animated = volume * (0.6 + pulseIntensity * 0.4)
    const barH = animated * vizH

    // Background
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(x + 2, vizTop, barWidth - 4, vizH)

    // Level bar
    if (barH > 0) {
      const y = vizTop + vizH - barH
      ctx.fillStyle = t.muted ? t.color + '25' : t.color + 'cc'
      ctx.fillRect(x + 2, y, barWidth - 4, barH)

      // Top cap
      ctx.fillStyle = t.muted ? t.color + '40' : t.color
      ctx.fillRect(x + 2, y, barWidth - 4, 1.5)
    }
  })
}
