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
 * Header Take — capture the live mix (tracks + pads) for up to 3:00.
 * Classic red record-dot emblem. Not Rec (mic).
 */
export function JamTakeMix() {
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
  const label = recording ? formatCaptureClock(left) : state === 'error' ? '!' : 'Take'

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={`min-h-11 px-3 rounded-lg text-xs font-medium border inline-flex items-center justify-center gap-1.5 ${
        recording
          ? 'bg-error text-white border-error animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.45)]'
          : state === 'error'
            ? 'bg-error/30 text-error border-error/40'
            : 'bg-bg-elevated text-text-muted border-border hover:text-error hover:border-error/50'
      }`}
      title={detail ?? (recording ? 'Stop and download (auto-stops at 3:00)' : 'Take — up to 3:00, starts Play if stopped')}
      aria-label={recording ? 'Stop take' : 'Take'}
      aria-pressed={recording}
    >
      {state === 'error' ? (
        <span>{label}</span>
      ) : recording ? (
        <>
          <span
            className="inline-block w-2 h-2 rounded-full bg-white shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.85)]"
            aria-hidden
          />
          <span>{label}</span>
        </>
      ) : (
        <>
          <span
            className="inline-block w-2 h-2 rounded-full bg-error shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.65)]"
            aria-hidden
          />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
