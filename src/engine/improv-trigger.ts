/**
 * Instant pad hits via SuperDough. Does not re-evaluate the jam stack.
 */
import { ensureAudioUnlocked } from './audio-context'
import { initEngine } from './strudel'
import { improvVoiceHap } from './improv-plate'

type DoughFn = (value: Record<string, unknown>, deadline?: number, duration?: number) => unknown

let dough: DoughFn | null = null
let warming: Promise<void> | null = null

export async function warmImprovTrigger(): Promise<void> {
  if (dough) return
  if (warming) return warming
  warming = (async () => {
    await ensureAudioUnlocked()
    await initEngine()
    const mod = await import('superdough')
    dough = mod.superdough as DoughFn
  })().finally(() => {
    warming = null
  })
  return warming
}

/** Fire a one-shot. Safe to call from pointerdown — never blocks the UI. */
export function fireImprovNote(note: string, voice: string, duration = 0.4): void {
  const hap = improvVoiceHap(note, voice)
  if (dough) {
    dough(hap, 0, duration)
    return
  }
  void warmImprovTrigger().then(() => {
    dough?.(hap, 0, duration)
  })
}
