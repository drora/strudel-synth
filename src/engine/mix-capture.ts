/**
 * Live mix capture: tap SuperDough destinationGain → MediaRecorder.
 * 3:00 auto-stop. No new AudioContext, no silent unlock, no setSinkId, no mic.
 */
import { downloadBlob, jamFileStem } from './all-code'
import { getKit } from './kits'
import { useJamStore } from '../store/jam-store'
import { useSessionStore } from '../store/session-store'
import { startPlayback } from './playback'

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
let arming = false
let abortStart = false
/** Bumps on each start/stop so a late arm after abort is discarded. */
let startGen = 0
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

function stale(gen: number): boolean {
  return abortStart || gen !== startGen
}

export function isMixCapturing(): boolean {
  return arming || (!!recorder && recorder.state === 'recording')
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
  const gen = ++startGen
  onStateCb = opts?.onState ?? null
  arming = true
  abortStart = false
  emit('recording')

  if (typeof MediaRecorder === 'undefined') {
    arming = false
    emit('error', 'Capture not supported here')
    throw new Error('MediaRecorder unsupported')
  }

  if (!useSessionStore.getState().isPlaying) {
    const play = await startPlayback()
    if (stale(gen)) {
      arming = false
      if (gen === startGen) emit('idle')
      return
    }
    if (!play.ok) {
      arming = false
      const msg = play.error ?? 'Play blocked — tap again'
      emit('error', msg)
      throw new Error(msg)
    }
  }

  const tap = await resolveTap()
  if (stale(gen)) {
    arming = false
    if (gen === startGen) emit('idle')
    return
  }
  if (!tap) {
    arming = false
    emit('error', 'Audio not ready — tap again')
    throw new Error('Audio not ready — tap again')
  }

  const stream = ensureTap(tap.ctx, tap.gain)
  mimeType = pickCaptureMime()
  chunks = []
  const rec = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)
  mimeType = rec.mimeType || mimeType || 'audio/webm'

  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  // Re-check abort immediately before recorder.start()
  if (stale(gen)) {
    arming = false
    if (gen === startGen) emit('idle')
    return
  }

  recorder = rec
  startedAt = performance.now()
  try {
    rec.start(250)
  } catch (err) {
    recorder = null
    arming = false
    startedAt = 0
    const msg = err instanceof Error ? err.message : String(err)
    emit('error', msg)
    throw err instanceof Error ? err : new Error(msg)
  }
  if (stale(gen)) {
    try {
      if (rec.state === 'recording') rec.stop()
    } catch {
      /* */
    }
    recorder = null
    arming = false
    startedAt = 0
    chunks = []
    if (gen === startGen) emit('idle')
    return
  }
  arming = false
  emit('recording')
  clearLimit()
  limitTimer = setTimeout(() => {
    void stopMixCapture()
  }, MIX_CAPTURE_LIMIT_MS)
}

export async function stopMixCapture(): Promise<void> {
  abortStart = true
  startGen++ // invalidate any in-flight start
  arming = false
  clearLimit()
  const rec = recorder
  recorder = null
  if (!rec || rec.state === 'inactive') {
    startedAt = 0
    chunks = []
    emit('idle')
    return
  }

  const blob = await new Promise<Blob>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    }
    rec.onstop = () => finish()
    rec.onerror = () => finish()
    try {
      if (typeof rec.requestData === 'function' && rec.state === 'recording') {
        try {
          rec.requestData()
        } catch {
          /* */
        }
      }
      rec.stop()
    } catch {
      finish()
      return
    }
    setTimeout(finish, 1000)
  })

  const hadChunks = blob.size > 0
  chunks = []
  startedAt = 0
  if (hadChunks && blob.size >= 64) {
    downloadBlob(blob, `${currentJamStem()}${captureExtension(blob.type || mimeType)}`)
  } else if (hadChunks) {
    // Chunks exist but tiny — still download so stop never silently drops a take.
    downloadBlob(blob, `${currentJamStem()}${captureExtension(blob.type || mimeType)}`)
  }
  emit('idle')
}
