import { useCallback, useEffect, useState } from 'react'
import {
  formatCaptureClock,
  isMixCapturing,
  mixCaptureLeftMs,
  startMixCapture,
  stopMixCapture,
  type MixCaptureState,
} from '../../engine/mix-capture'

/**
 * Header Share — capture the live mix (tracks + pads) for up to 3:00.
 * Not Rec (mic). Accent, not red.
 */
export function JamShareMix() {
  const [state, setState] = useState<MixCaptureState>('idle')
  const [left, setLeft] = useState(0)
  const [detail, setDetail] = useState<string | null>(null)

  const onState = useCallback((s: MixCaptureState, d?: string) => {
    setState(s)
    setDetail(d ?? null)
    if (s === 'error') {
      window.setTimeout(() => {
        setState('idle')
        setDetail(null)
      }, 2200)
    }
  }, [])

  useEffect(() => {
    if (state !== 'recording') return
    const tick = () => setLeft(mixCaptureLeftMs())
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [state])

  const handleClick = useCallback(async () => {
    if (state === 'recording' || isMixCapturing()) {
      try {
        await stopMixCapture()
      } catch {
        /* onState */
      }
      return
    }
    try {
      await startMixCapture({ onState })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState('error')
      setDetail(msg)
      window.setTimeout(() => {
        setState('idle')
        setDetail(null)
      }, 2200)
    }
  }, [state, onState])

  const recording = state === 'recording'
  const label = recording ? formatCaptureClock(left) : state === 'error' ? '!' : 'Share'

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={`min-h-11 px-3 rounded-lg text-xs font-medium border ${
        recording
          ? 'bg-accent text-bg border-accent animate-pulse'
          : state === 'error'
            ? 'bg-error/30 text-error border-error/40'
            : 'bg-bg-elevated text-text-muted border-border hover:text-accent'
      }`}
      title={detail ?? (recording ? 'Stop and download (auto-stops at 3:00)' : 'Share mix — up to 3:00')}
      aria-label={recording ? 'Stop mix capture' : 'Share mix'}
      aria-pressed={recording}
    >
      {label}
    </button>
  )
}
