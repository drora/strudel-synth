/**
 * Instant pad hits via SuperDough. Does not re-evaluate the jam stack.
 *
 * SuperDough 1.3 takes an *absolute* AudioContext time. Import from
 * @strudel/web (same specifier as initEngine) so we share the jam's
 * soundMap, context, and output bus.
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

async function shoot(note: string, voice: string, mix: ImprovPadMix, duration: number) {
  if (!dough || !getCtx) return
  const ac = getCtx()
  const resumeP = ac.resume()
  if (initAudioFn) void initAudioFn()
  await resumeP

  let hap: Record<string, unknown> = improvVoiceHapWithMix(note, voice, mix)
  const want = String(hap.s ?? '')
  if (!(getSoundFn && want && getSoundFn(want)) && getSoundFn?.('sawtooth')) {
    hap = { ...hap, s: 'sawtooth' }
  }

  const t = ac.currentTime + 0.18
  await dough(hap, t, duration)
}

/** Fire a one-shot. Works with the jam stopped. Safe from pointerdown. */
export function fireImprovNote(
  note: string,
  voice: string,
  mix: ImprovPadMix = IMPROV_MIX_DEFAULT,
  duration = 0.45,
): void {
  void ensureAudioUnlocked()
  if (dough && getCtx) {
    void shoot(note, voice, mix, duration)
    return
  }
  void warmImprovTrigger().then(() => shoot(note, voice, mix, duration))
}
