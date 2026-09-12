/**
 * Instant pad hits via SuperDough. Does not re-evaluate the jam stack.
 *
 * Hold: start on pointerdown, release on pointerup (our gain envelope).
 * Keep bakes hold `@` stretches + `.velocity(...)`.
 */
import { ensureAudioUnlocked } from './audio-context'
import { initEngine } from './strudel'
import {
  improvVoiceHapWithMix,
  IMPROV_MIX_DEFAULT,
  isImprovFxOn,
  type ImprovPadMix,
} from './improv-plate'

type DoughFn = (
  value: Record<string, unknown>,
  t: number,
  duration?: number,
) => Promise<unknown> | unknown
type CtxFn = () => AudioContext
type InitAudioFn = () => Promise<void>
type OnTrigger = (
  t: number,
  value: Record<string, unknown>,
  onended: () => void,
  cps: number,
) => Promise<{ node: AudioNode; stop?: (end: number) => void } | void> | { node: AudioNode; stop?: (end: number) => void } | void
type GetSoundFn = (s: string) => { onTrigger?: OnTrigger } | undefined
type Orbit = {
  getReverb: (...args: unknown[]) => unknown
  getDelay: (time?: number, fb?: number, t?: number) => unknown
  sendReverb: (node: AudioNode, amount: number) => unknown
  sendDelay: (node: AudioNode, amount: number) => unknown
  connectToOutput: (node: AudioNode) => void
}
type GetCtrlFn = () => { getOrbit: (n: number, ch?: number[]) => Orbit }

const SYNTH_VOICES = new Set([
  'triangle',
  'square',
  'sawtooth',
  'sine',
  'user',
  'one',
  'tri',
  'sqr',
  'saw',
  'sin',
])

const WARM_LEAD = 0.02
const COLD_LEAD = 0.12
const HOLD_SEC = 32
const RELEASE_SEC = 0.09

const warmed = new Set<string>(SYNTH_VOICES)

let dough: DoughFn | null = null
let getCtx: CtxFn | null = null
let initAudioFn: InitAudioFn | null = null
let getSoundFn: GetSoundFn | null = null
let getCtrl: GetCtrlFn | null = null
let warming: Promise<void> | null = null
let token = 0
let live: { gain: GainNode; stop?: (end: number) => void } | null = null

async function loadJamDough(): Promise<void> {
  const mod = await import('@strudel/web')
  dough = mod.superdough as DoughFn
  getCtx = mod.getAudioContext as CtxFn
  initAudioFn = mod.initAudio as InitAudioFn
  getSoundFn = mod.getSound as GetSoundFn
  getCtrl = mod.getSuperdoughAudioController as GetCtrlFn
  if (typeof mod.registerSynthSounds === 'function') {
    mod.registerSynthSounds()
  }
}

export function improvLookahead(sound: string): number {
  return warmed.has(sound.toLowerCase()) ? WARM_LEAD : COLD_LEAD
}

export function markImprovVoiceWarm(sound: string): void {
  if (sound) warmed.add(sound.toLowerCase())
}

export function padVelocity(
  pressure: number,
  pointerType: string,
  slider: number,
): number {
  const s = slider
  if (pointerType === 'pen' && pressure > 0) {
    return Math.min(1.5, Math.max(0.05, pressure * s))
  }
  if (pointerType === 'touch' && pressure > 0 && pressure !== 0.5) {
    return Math.min(1.5, Math.max(0.05, pressure * s))
  }
  return s
}

export async function warmImprovTrigger(): Promise<void> {
  if (dough && getCtx) {
    try {
      await getCtx().resume()
      if (initAudioFn) await initAudioFn()
    } catch {
      /* */
    }
    return
  }
  if (warming) return warming
  warming = (async () => {
    await ensureAudioUnlocked()
    await initEngine()
    await loadJamDough()
    try {
      await getCtx!().resume()
      if (initAudioFn) await initAudioFn()
    } catch {
      /* */
    }
  })().finally(() => {
    warming = null
  })
  return warming
}

function resolveHap(
  note: string,
  voice: string,
  mix: ImprovPadMix,
): Record<string, unknown> {
  const hap = improvVoiceHapWithMix(note, voice, mix)
  const want = String(hap.s ?? '')
  if (!(getSoundFn && want && getSoundFn(want)) && getSoundFn?.('sawtooth')) {
    hap.s = 'sawtooth'
  }
  return hap
}

function fadeLive(ac: AudioContext) {
  const cur = live
  live = null
  if (!cur) return
  const now = ac.currentTime
  try {
    const g = cur.gain.gain
    const v = Math.max(g.value, 0.001)
    g.cancelScheduledValues(now)
    g.setValueAtTime(v, now)
    g.exponentialRampToValueAtTime(0.0001, now + RELEASE_SEC)
    cur.stop?.(now + RELEASE_SEC + 0.02)
  } catch {
    /* */
  }
}

export function stopImprovNote(): void {
  token += 1
  if (getCtx) fadeLive(getCtx())
}

async function beginHold(
  mine: number,
  note: string,
  voice: string,
  mix: ImprovPadMix,
  velocity: number,
): Promise<void> {
  if (!getCtx || !getSoundFn) return
  const ac = getCtx()
  if (ac.state !== 'running') {
    void ac.resume()
    if (initAudioFn) void initAudioFn()
  }
  const hap = resolveHap(note, voice, mix)
  hap.duration = HOLD_SEC
  hap.sustain = 1
  hap.attack = 0.005
  hap.release = RELEASE_SEC
  hap.velocity = velocity
  const s = String(hap.s ?? '')
  const sound = getSoundFn(s)
  const t = ac.currentTime + improvLookahead(s)
  if (!sound?.onTrigger) {
    if (dough) void dough({ ...hap, gain: (mix.volume || 0.9) * velocity, cut: 1 }, t, 0.45)
    return
  }
  const handle = await sound.onTrigger(t, hap, () => {}, 0.5)
  if (mine !== token || !handle?.node) {
    try {
      handle?.stop?.(ac.currentTime)
    } catch {
      /* */
    }
    return
  }

  let node: AudioNode = handle.node
  if (isImprovFxOn('lpf', mix.lpf) && mix.lpf != null) {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = mix.lpf
    node.connect(f)
    node = f
  }
  if (isImprovFxOn('hpf', mix.hpf) && mix.hpf != null) {
    const f = ac.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = mix.hpf
    node.connect(f)
    node = f
  }

  const gain = ac.createGain()
  const amp = Math.max(0.001, (mix.volume || 0.9) * velocity)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(amp, t + 0.012)
  node.connect(gain)

  try {
    const orbit = getCtrl?.().getOrbit(1, [1, 2])
    orbit?.connectToOutput(gain)
    if (orbit && isImprovFxOn('room', mix.room) && mix.room != null) {
      orbit.getReverb()
      orbit.sendReverb(gain, mix.room)
    }
    if (orbit && isImprovFxOn('delay', mix.delay) && mix.delay != null) {
      orbit.getDelay(0.25, 0.45, t)
      orbit.sendDelay(gain, mix.delay)
    }
  } catch {
    gain.connect(ac.destination)
  }

  live = { gain, stop: handle.stop }
  markImprovVoiceWarm(s)
}

export function startImprovNote(
  note: string,
  voice: string,
  mix: ImprovPadMix = IMPROV_MIX_DEFAULT,
  velocity = mix.velocity,
): void {
  stopImprovNote()
  const mine = token
  const go = () => {
    if (mine !== token) return
    void beginHold(mine, note, voice, mix, velocity)
  }
  if (dough && getCtx) {
    if (getCtx().state !== 'running') void ensureAudioUnlocked()
    go()
    return
  }
  void ensureAudioUnlocked()
  void warmImprovTrigger().then(go)
}

/** @deprecated tap alias — hold uses start/stop */
export function fireImprovNote(
  note: string,
  voice: string,
  mix: ImprovPadMix = IMPROV_MIX_DEFAULT,
  duration = 0.45,
): void {
  startImprovNote(note, voice, mix, mix.velocity)
  void duration
}

export function preloadImprovVoice(voice: string): void {
  if (!voice) return
  const key = voice.split(':')[0]!.toLowerCase()
  if (warmed.has(key)) return
  if (!dough || !getCtx) {
    void warmImprovTrigger().then(() => preloadImprovVoice(voice))
    return
  }
  const ac = getCtx()
  const hap = resolveHap('c4', voice, { ...IMPROV_MIX_DEFAULT, volume: 0 })
  hap.gain = 0
  const s = String(hap.s ?? '')
  const t = ac.currentTime + improvLookahead(s)
  void Promise.resolve(dough!(hap, t, 0.04)).then(() => markImprovVoiceWarm(s))
}
