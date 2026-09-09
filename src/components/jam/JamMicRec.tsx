import { useCallback, useRef, useState } from 'react'
import {
  startMicRecording,
  type MicController,
  type MicRecState,
} from '../../engine/mic-sample'

/**
 * Big Rec control — record mic → register sample → assign to track.
 * Quantizes start/stop to cycle when playing. iOS unlock inside startMicRecording.
 */
export function JamMicRec({ large = false }: { large?: boolean }) {
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

  let label = 'Rec'
  if (state === 'arming') label = '…'
  else if (state === 'recording') label = '■'
  else if (state === 'processing') label = '…'
  else if (errored) label = '!'

  const title =
    detail ??
    (recording
      ? 'Stop (quantized to cycle)'
      : 'Record mic → sample → track')

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={processing}
      className={`
        flex items-center justify-center rounded-xl
        transition-all font-bold shrink-0 active:scale-95
        ${large ? 'w-16 h-12 min-w-12 min-h-12 text-lg' : 'w-14 h-11 text-base'}
        ${recording
          ? 'bg-error text-white shadow-[0_0_16px_rgba(239,68,68,0.5)] animate-pulse'
          : errored
            ? 'bg-error/30 text-error border border-error/40'
            : 'bg-bg-elevated text-error border border-error/40 hover:bg-error/15'
        }
      `}
      title={title}
      aria-label={recording ? 'Stop recording' : 'Record mic'}
      aria-pressed={recording}
    >
      {label}
    </button>
  )
}
