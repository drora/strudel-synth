import { useCallback, useRef, useState } from 'react'
import {
  startMicRecording,
  type MicController,
  type MicRecState,
} from '../../engine/mic-sample'

/**
 * Mic control — record mic → register sample → assign to track.
 * Classic red record-dot emblem. Quantizes start/stop to cycle when playing.
 * Header Take (mix capture) is separate — do not say "Rec" on this chrome.
 */
export function JamMicRec({ large = false, fill = false }: { large?: boolean; fill?: boolean }) {
  const [state, setState] = useState<MicRecState>('idle')
  const [detail, setDetail] = useState<string | null>(null)
  const ctlRef = useRef<MicController | null>(null)

  const onState = useCallback((s: MicRecState, d?: string) => {
    setState(s)
    setDetail(d ?? null)
  }, [])

  const handleClick = useCallback(async () => {
    if (state === 'recording' || state === 'arming') {
      const ctl = ctlRef.current
      ctlRef.current = null
      if (ctl) {
        try {
          await ctl.stop()
        } catch {
          /* state already set via onState */
        }
      }
      return
    }
    if (state === 'processing') return
    try {
      ctlRef.current = await startMicRecording({ onState, quantize: true })
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

  const recording = state === 'recording' || state === 'arming'
  const processing = state === 'processing'
  const errored = state === 'error'
  const arming = state === 'arming'

  const title =
    detail ??
    (recording
      ? 'Stop mic recording (quantized to cycle)'
      : 'Record mic → sample → track')

  const aria =
    recording
      ? 'Stop mic recording'
      : processing
        ? 'Processing mic sample'
        : errored
          ? 'Mic recording error'
          : 'Record mic → sample → track'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={processing}
      className={`
        relative flex items-center justify-center gap-1.5 rounded-xl
        transition-all font-bold shrink-0 active:scale-95
        ${fill ? 'w-full min-w-0 h-12 min-h-12 text-sm' : large ? 'w-16 h-12 min-w-12 min-h-12 text-sm' : 'w-14 h-11 text-sm'}
        ${recording
          ? 'bg-error text-white shadow-[0_0_16px_rgba(239,68,68,0.55)]'
          : errored
            ? 'bg-error/30 text-error border border-error/40'
            : 'bg-bg-elevated text-text border border-border hover:border-error/50 hover:text-error'
        }
      `}
      title={title}
      aria-label={aria}
      aria-pressed={recording}
    >
      {recording ? (
        <>
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-white shrink-0 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.85)]"
            aria-hidden
          />
          <span>{arming ? '…' : '■'}</span>
        </>
      ) : processing ? (
        <span className="animate-pulse text-text-muted">…</span>
      ) : errored ? (
        <span className="text-error">!</span>
      ) : (
        <>
          <span
            className="inline-block w-2 h-2 rounded-full bg-error shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.65)]"
            aria-hidden
          />
          <span>Mic</span>
        </>
      )}
    </button>
  )
}
