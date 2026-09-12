/**
 * Mic → buffer → Strudel sample bank → track code.
 * Handles iOS unlock + getUserMedia; quantizes start/stop to cycle when playing.
 */
import { ensureAudioUnlocked, getAudioContext, getAudioContextState, isAudioSyncedToStrudel, restoreMediaRoute } from './audio-context'
import { initEngine } from './strudel'
import { liveUpdateEngine } from './live-update'
import { ROLE_COLORS, type TrackRole } from './types'
import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'

export type MicRecState = 'idle' | 'arming' | 'recording' | 'processing' | 'error'

let micCounter = 0
const registeredMicNames: string[] = []
const micDurations = new Map<string, number>()

/** Wall-clock length of a jam_mic_* take, if we decoded it. */
export function micSampleDuration(name: string): number | undefined {
  return micDurations.get(name)
}
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
  try {
    const ac = getAudioContext()
    const buf = await ac.decodeAudioData(await blob.arrayBuffer())
    micDurations.set(name, buf.duration)
  } catch {
    /* samples() still registers the url */
  }
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
  // New vox lane only — never open (or leave open) the Sound picker.
  jam.setSoundTrackId(null)
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
  // Re-unlock / initEngine into a live graph hops BT off JBL. Skip whenever
  // Play is on, or SuperDough is already up (running or just interrupted by Rec).
  const st = getAudioContextState()
  const alreadyLive =
    useSessionStore.getState().isPlaying ||
    (isAudioSyncedToStrudel() && (st === 'running' || (st as string) === 'interrupted'))
  if (!alreadyLive) {
    await ensureAudioUnlocked()
    await initEngine()
  }
  try {
    getAudioContext()
  } catch {
    /* ignore */
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    onState('error', 'Mic not available in this browser')
    throw new Error('getUserMedia unavailable')
  }

  if (typeof MediaRecorder === 'undefined') {
    onState('error', 'MediaRecorder not supported')
    throw new Error('MediaRecorder unsupported')
  }

  // Open the mic only for the take — not during the cycle wait.
  if (quantize) await waitForCycleBoundary()

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    },
  })
  activeStream = stream
  mimeType = pickMimeType()

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
      await cleanupStream()
      void restoreMediaRoute()
      onState('idle')
      return null
    }
    onState('processing')

    const rec = activeRecorder
    if (!rec) {
      await cleanupStream()
      void restoreMediaRoute()
      onState('idle')
      return null
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => {
        const parts = chunks.slice()
        void cleanupStream().then(
          () => resolve(new Blob(parts, { type: mimeType })),
          reject,
        )
      }
      rec.onerror = () => {
        void cleanupStream().then(
          () => reject(new Error('MediaRecorder error')),
          reject,
        )
      }
      try {
        rec.requestData()
        rec.stop()
      } catch (err) {
        void cleanupStream().then(() => reject(err), reject)
      }
    })

    if (blob.size < 64) {
      onState('error', 'Recording too short')
      void restoreMediaRoute()
      return null
    }

    micCounter += 1
    const name = `jam_mic_${micCounter}`
    try {
      await registerBlobAsSample(name, blob)
      registeredMicNames.push(name)
      assignSampleToTrack(name)
      onState('idle')
      void restoreMediaRoute()
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
    void cleanupStream().then(() => restoreMediaRoute())
    onState('idle')
  }

  return { stop, cancel }
}

export function isMicRecording(): boolean {
  return !!activeRecorder && activeRecorder.state === 'recording'
}

function waitStopped(stream: MediaStream | null | undefined): Promise<void> {
  if (!stream) return Promise.resolve()
  const waits: Promise<void>[] = []
  for (const t of stream.getTracks()) {
    if (t.readyState !== 'ended') {
      waits.push(
        new Promise((res) => {
          t.addEventListener('ended', () => res(), { once: true })
          window.setTimeout(() => res(), 400)
        }),
      )
    }
    try {
      t.stop()
    } catch {
      /* already ended */
    }
  }
  return Promise.all(waits).then(() => undefined)
}

async function cleanupStream() {
  const rec = activeRecorder
  const stream = activeStream
  activeRecorder = null
  activeStream = null
  chunks = []
  await Promise.all([waitStopped(stream), waitStopped(rec?.stream)])
}

/** Names of jam_mic_* samples successfully registered this session. */
export function listMicSampleNames(): string[] {
  return [...registeredMicNames]
}
