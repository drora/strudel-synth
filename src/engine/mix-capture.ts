/**
 * Live mix capture: tap SuperDough destinationGain → MediaRecorder.
 * 3:00 auto-stop. No new AudioContext, no silent unlock, no setSinkId, no mic.
 */
import { downloadBlob, jamFileStem } from './all-code'
import { getKit } from './kits'
import { useJamStore } from '../store/jam-store'
import { useSessionStore } from '../store/session-store'

export const MIX_CAPTURE_LIMIT_MS = 180_000

export type MixCaptureState = 'idle' | 'recording' | 'error'

export function pickCaptureMime(): string {
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

export function captureExtension(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4') || m.includes('mpeg') || m.includes('m4a') || m.includes('aac')) {
    return '.m4a'
  }
  if (m.includes('ogg')) return '.ogg'
  return '.webm'
}

export function formatCaptureClock(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function currentJamStem(): string {
  const jam = useJamStore.getState()
  const kit = jam.kitId ? getKit(jam.kitId)?.name : null
  return jamFileStem({
    kit,
    root: jam.songRoot,
    scale: jam.songScale,
    bpm: useSessionStore.getState().bpm,
  })
}

type GetCtrl = () => { output?: { destinationGain?: GainNode } } | undefined
type GetCtx = () => AudioContext

let tapDest: MediaStreamAudioDestinationNode | null = null
let tapFrom: GainNode | null = null
let recorder: MediaRecorder | null = null
let chunks: BlobPart[] = []
let mimeType = 'audio/webm'
let limitTimer: ReturnType<typeof setTimeout> | null = null
let startedAt = 0
let onStateCb: ((s: MixCaptureState, detail?: string) => void) | null = null

function emit(s: MixCaptureState, detail?: string) {
  onStateCb?.(s, detail)
}

async function resolveTap(): Promise<{ ctx: AudioContext; gain: GainNode } | null> {
  try {
    const mod = await import('@strudel/web')
    const ctx = (mod.getAudioContext as GetCtx | undefined)?.()
    const ctrl = (mod.getSuperdoughAudioController as GetCtrl | undefined)?.()
    const gain = ctrl?.output?.destinationGain
    if (ctx && gain) return { ctx, gain }
  } catch {
    /* */
  }
  return null
}

function ensureTap(ctx: AudioContext, gain: GainNode): MediaStream {
  if (tapDest && tapFrom === gain) return tapDest.stream
  tapDest = ctx.createMediaStreamDestination()
  gain.connect(tapDest)
  tapFrom = gain
  return tapDest.stream
}

function clearLimit() {
  if (limitTimer != null) {
    clearTimeout(limitTimer)
    limitTimer = null
  }
}

function engineReady(): boolean {
  const g = globalThis as { __strudelEngine?: { initialized?: boolean } }
  return !!g.__strudelEngine?.initialized
}

export function isMixCapturing(): boolean {
  return !!recorder && recorder.state === 'recording'
}

export function mixCaptureElapsedMs(): number {
  if (!startedAt) return 0
  return Math.max(0, performance.now() - startedAt)
}

export function mixCaptureLeftMs(): number {
  return Math.max(0, MIX_CAPTURE_LIMIT_MS - mixCaptureElapsedMs())
}

export async function startMixCapture(opts?: {
  onState?: (s: MixCaptureState, detail?: string) => void
}): Promise<void> {
  if (isMixCapturing()) return
  onStateCb = opts?.onState ?? null

  if (typeof MediaRecorder === 'undefined') {
    emit('error', 'Capture not supported here')
    throw new Error('MediaRecorder unsupported')
  }
  if (!engineReady()) {
    emit('error', 'Play first, then Share')
    throw new Error('Play first, then Share')
  }

  const tap = await resolveTap()
  if (!tap) {
    emit('error', 'Play first, then Share')
    throw new Error('Play first, then Share')
  }

  const stream = ensureTap(tap.ctx, tap.gain)
  mimeType = pickCaptureMime()
  chunks = []
  recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)
  mimeType = recorder.mimeType || mimeType || 'audio/webm'

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  startedAt = performance.now()
  recorder.start(250)
  emit('recording')
  clearLimit()
  limitTimer = setTimeout(() => {
    void stopMixCapture()
  }, MIX_CAPTURE_LIMIT_MS)
}

export async function stopMixCapture(): Promise<void> {
  clearLimit()
  const rec = recorder
  recorder = null
  if (!rec || rec.state === 'inactive') {
    startedAt = 0
    emit('idle')
    return
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    }
    rec.onerror = () => reject(new Error('Capture failed'))
    try {
      rec.stop()
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  }).catch((err) => {
    startedAt = 0
    chunks = []
    emit('error', err instanceof Error ? err.message : String(err))
    throw err
  })

  chunks = []
  startedAt = 0
  if (blob.size < 64) {
    emit('error', 'Capture too short')
    emit('idle')
    return
  }
  downloadBlob(blob, `${currentJamStem()}${captureExtension(blob.type || mimeType)}`)
  emit('idle')
}
