/**
 * Instant pad hits via SuperDough. Does not re-evaluate the jam stack.
 *
 * SuperDough 1.3 takes an *absolute* AudioContext time. Import from
 * @strudel/web (same specifier as initEngine) so we share the jam's
 * soundMap, context, and output bus.
 *
 * Warm (registered synths + already-heard samples) schedule ~20ms ahead.
 * Cold samples get a longer lead so SuperDough does not skip "still loading".
 */
import { ensureAudioUnlocked } from './audio-context'
import { initEngine } from './strudel'
import { improvVoiceHapWithMix, IMPROV_MIX_DEFAULT, type ImprovPadMix } from './improv-plate'

type DoughFn = (
  value: Record<string, unknown>,
  t: number,
  duration?: number,
) => Promise<unknown> | unknown
type CtxFn = () => AudioContext
type InitAudioFn = () => Promise<void>
type GetSoundFn = (s: string) => { onTrigger?: unknown } | undefined

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

const warmed = new Set<string>(SYNTH_VOICES)

let dough: DoughFn | null = null
let getCtx: CtxFn | null = null
let initAudioFn: InitAudioFn | null = null
let getSoundFn: GetSoundFn | null = null
let warming: Promise<void> | null = null

async function loadJamDough(): Promise<void> {
  const mod = await import('@strudel/web')
  dough = mod.superdough as DoughFn
  getCtx = mod.getAudioContext as CtxFn
  initAudioFn = mod.initAudio as InitAudioFn
  getSoundFn = mod.getSound as GetSoundFn
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

/** Sync hot path — no await before schedule. */
function shootNow(
  note: string,
  voice: string,
  mix: ImprovPadMix,
  duration: number,
  silent = false,
): void {
  if (!dough || !getCtx) return
  const ac = getCtx()
  if (ac.state !== 'running') {
    void ac.resume()
    if (initAudioFn) void initAudioFn()
  }
  const hap = resolveHap(note, voice, mix)
  if (silent) hap.gain = 0
  const s = String(hap.s ?? '')
  const t = ac.currentTime + improvLookahead(s)
  // cut:1 steals the previous pad so overlaps don't smear
  hap.cut = 1
  void Promise.resolve(dough(hap, t, duration)).then(() => markImprovVoiceWarm(s))
}

/** Silent prime so the next audible tap can use the 20ms lead. */
export function preloadImprovVoice(voice: string): void {
  if (!voice) return
  const key = voice.split(':')[0]!.toLowerCase()
  if (warmed.has(key)) return
  if (!dough || !getCtx) {
    void warmImprovTrigger().then(() => preloadImprovVoice(voice))
    return
  }
  shootNow('c4', voice, { ...IMPROV_MIX_DEFAULT, volume: 0 }, 0.04, true)
}

/** Fire a one-shot. Works with the jam stopped. Safe from pointerdown. */
export function fireImprovNote(
  note: string,
  voice: string,
  mix: ImprovPadMix = IMPROV_MIX_DEFAULT,
  duration = 0.45,
): void {
  if (dough && getCtx) {
    const ac = getCtx()
    if (ac.state !== 'running') void ensureAudioUnlocked()
    shootNow(note, voice, mix, duration)
    return
  }
  void ensureAudioUnlocked()
  void warmImprovTrigger().then(() => shootNow(note, voice, mix, duration))
}
