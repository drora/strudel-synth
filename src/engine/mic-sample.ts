/**
 * Mic → buffer → Strudel sample bank → track code.
 * Handles iOS unlock + getUserMedia; quantizes start/stop to cycle when playing.
 */
import { ensureAudioUnlocked, getAudioContext } from './audio-context'
import { initEngine } from './strudel'
import { liveUpdateEngine } from './live-update'
import { ROLE_COLORS, type TrackRole } from './types'
import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'

export type MicRecState = 'idle' | 'arming' | 'recording' | 'processing' | 'error'

let micCounter = 0
let activeStream: MediaStream | null = null
let activeRecorder: MediaRecorder | null = null
let chunks: BlobPart[] = []
let mimeType = 'audio/webm'

function queueLiveIfPlaying() {
  if (!useSessionStore.getState().isPlaying) return
  const q = useUIStore.getState().getEffectiveQuantization(
    useSessionStore.getState().activeTrackId,
  )
  liveUpdateEngine.queueUpdate(q, 'jam')
}

function pickMimeType(): string {
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

function waitForCycleBoundary(maxMs = 2500): Promise<void> {
  if (!useSessionStore.getState().isPlaying) return Promise.resolve()
  return new Promise((resolve) => {
    const start = performance.now()
    let lastInt = Math.floor(liveUpdateEngine.getCurrentCycle())
    const tick = () => {
      const c = liveUpdateEngine.getCurrentCycle()
      const ci = Math.floor(c)
      const frac = c - ci
      if (ci !== lastInt && frac < 0.12) {
        resolve()
        return
      }
      lastInt = ci
      if (performance.now() - start > maxMs) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function registerBlobAsSample(name: string, blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob)
  const samplesFn = (globalThis as unknown as { samples?: (...args: unknown[]) => unknown }).samples
  if (typeof samplesFn !== 'function') {
    throw new Error('Strudel samples() not ready — hit Play once first')
  }
  await Promise.resolve(samplesFn({ [name]: [url] }))
  return name
}

function assignSampleToTrack(sampleName: string): string {
  const session = useSessionStore.getState()
  const jam = useJamStore.getState()
  const code = `s("${sampleName}")`
  const targetId = jam.soundTrackId ?? session.activeTrackId

  if (targetId && session.tracks.some((t) => t.id === targetId)) {
    session.setCode(targetId, code)
    jam.touchTrack(targetId)
    jam.setLastPeek(`Mic · ${sampleName} → track`)
    jam.setSoundTrackId(targetId)
    queueLiveIfPlaying()
    return targetId
  }

  const role: TrackRole = 'vox'
  const id = session.addTrack({
    name: `Mic ${micCounter}`,
    role,
    code,
    color: ROLE_COLORS[role],
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  })
  jam.touchTrack(id)
  jam.setLastPeek(`Mic · ${sampleName} → new track`)
  jam.setSoundTrackId(id)
  jam.setCodeTrackId(null)
  queueLiveIfPlaying()
  return id
}

export interface MicController {
  stop: () => Promise<string | null>
  cancel: () => void
}

/**
 * Start mic recording (optionally quantized). Returns controller to stop.
 * Call from a user gesture.
 */
export async function startMicRecording(opts?: {
  quantize?: boolean
  onState?: (s: MicRecState, detail?: string) => void
}): Promise<MicController> {
  const onState = opts?.onState ?? (() => {})
  const quantize = opts?.quantize !== false

  onState('arming')
  await ensureAudioUnlocked()
  await initEngine()
  try {
    getAudioContext()
  } catch {
    /* ignore */
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    onState('error', 'Mic not available in this browser')
    throw new Error('getUserMedia unavailable')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    },
  })
  activeStream = stream
  mimeType = pickMimeType()

  if (typeof MediaRecorder === 'undefined') {
    stream.getTracks().forEach((t) => t.stop())
    activeStream = null
    onState('error', 'MediaRecorder not supported')
    throw new Error('MediaRecorder unsupported')
  }

  if (quantize) await waitForCycleBoundary()

  chunks = []
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)
  mimeType = recorder.mimeType || mimeType || 'audio/webm'
  activeRecorder = recorder

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  recorder.start(100)
  onState('recording')

  const stop = async (): Promise<string | null> => {
    if (!activeRecorder || activeRecorder.state === 'inactive') {
      cleanupStream()
      onState('idle')
      return null
    }
    onState('processing')
    if (quantize) await waitForCycleBoundary()

    const blob = await new Promise<Blob>((resolve, reject) => {
      const rec = activeRecorder!
      rec.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }))
      }
      rec.onerror = () => reject(new Error('MediaRecorder error'))
      try {
        rec.stop()
      } catch (err) {
        reject(err)
      }
    })

    cleanupStream()

    if (blob.size < 64) {
      onState('error', 'Recording too short')
      return null
    }

    micCounter += 1
    const name = `jam_mic_${micCounter}`
    try {
      await registerBlobAsSample(name, blob)
      assignSampleToTrack(name)
      onState('idle')
      return name
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      onState('error', msg)
      throw err
    }
  }

  const cancel = () => {
    try {
      if (activeRecorder && activeRecorder.state !== 'inactive') activeRecorder.stop()
    } catch {
      /* ignore */
    }
    cleanupStream()
    chunks = []
    onState('idle')
  }

  return { stop, cancel }
}

export function isMicRecording(): boolean {
  return !!activeRecorder && activeRecorder.state === 'recording'
}

function cleanupStream() {
  activeRecorder = null
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop())
    activeStream = null
  }
  chunks = []
}
