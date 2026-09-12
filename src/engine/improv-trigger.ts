/**
 * Instant pad hits via SuperDough. Does not re-evaluate the jam stack.
 *
 * SuperDough 1.3 takes an *absolute* AudioContext time. Passing 0 is always
 * in the past, so the hap is dropped (total silence).
 */
import { ensureAudioUnlocked } from './audio-context'
import { initEngine } from './strudel'
import { improvVoiceHap } from './improv-plate'

type DoughFn = (value: Record<string, unknown>, t: number, duration?: number) => unknown
type CtxFn = () => AudioContext

let dough: DoughFn | null = null
let getCtx: CtxFn | null = null
let warming: Promise<void> | null = null

export async function warmImprovTrigger(): Promise<void> {
  if (dough && getCtx) return
  if (warming) return warming
  warming = (async () => {
    await ensureAudioUnlocked()
    await initEngine()
    const mod = await import('superdough')
    dough = mod.superdough as DoughFn
    getCtx = mod.getAudioContext as CtxFn
    try {
      await getCtx().resume()
    } catch {
      /* iOS may still need a later pad tap */
    }
  })().finally(() => {
    warming = null
  })
  return warming
}

function shoot(note: string, voice: string, duration: number) {
  if (!dough || !getCtx) return
  const ac = getCtx()
  if (ac.state !== 'running') {
    void ac.resume()
  }
  // Small lead so we never schedule behind currentTime (hap would be dropped).
  const t = ac.currentTime + 0.05
  void dough(improvVoiceHap(note, voice), t, duration)
}

/** Fire a one-shot. Works with the jam stopped. Safe from pointerdown. */
export function fireImprovNote(note: string, voice: string, duration = 0.4): void {
  void ensureAudioUnlocked()
  if (dough && getCtx) {
    shoot(note, voice, duration)
    return
  }
  void warmImprovTrigger().then(() => shoot(note, voice, duration))
}
