/**
 * GM soundfonts on the LIVE SuperDough registry.
 *
 * @strudel/web ships a prebundled dist that embeds its own superdough/soundMap.
 * @strudel/soundfonts imports @strudel/webaudio separately, so package
 * registerSoundfonts() can write a dead map while playback reads the live one
 * — gm_* then reports "not found". We register via globalThis.registerSound
 * (available after initStrudel defaultPrebake).
 *
 * Font PCM still lazy-loads from WebAudioFont CDN; we warm catalog gm_* ids so
 * the first scheduled hap is not discarded as "still loading".
 */
import { SOUND_CHOICES } from './kits-sound-choices'

type RegisterSoundFn = (
  key: string,
  onTrigger: (
    time: number,
    value: Record<string, unknown>,
    onended: () => void,
  ) => Promise<{ node: AudioNode; stop: (t?: number) => void; nodes?: Record<string, unknown> } | void>,
  data?: Record<string, unknown>,
) => void

type GetSoundFn = (
  name: string,
) => { onTrigger?: unknown; data?: { fonts?: string[]; type?: string } } | undefined

type GlobalDough = {
  registerSound?: RegisterSoundFn
  getSound?: GetSoundFn
  getAudioContext?: () => AudioContext
  getADSRValues?: (adsr: unknown[]) => [number, number, number, number]
  getParamADSR?: (...args: unknown[]) => void
  getVibratoOscillator?: (
    ...args: unknown[]
  ) => { stop?: () => void; nodes?: Record<string, unknown> } | null | undefined
  getPitchEnvelope?: (...args: unknown[]) => void
  onceEnded?: (node: AudioBufferSourceNode, cb: () => void) => void
  releaseAudioNode?: (node: AudioNode) => void
  getSoundIndex?: (n: unknown, len: number) => number
}

function dough(): GlobalDough {
  return globalThis as unknown as GlobalDough
}

function soundIndex(n: unknown, len: number): number {
  const fn = dough().getSoundIndex
  if (typeof fn === 'function') return fn(n, len)
  const i = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0
  return ((i % len) + len) % len
}

/** Catalog gm_* ids (melodic + fx sheets) — warm these after register. */
export function catalogGmSoundIds(): string[] {
  const ids = new Set<string>()
  for (const choices of Object.values(SOUND_CHOICES)) {
    for (const c of choices) {
      if (c.sound?.startsWith('gm_')) ids.add(c.sound)
    }
  }
  return [...ids].sort()
}

/**
 * Register every GM instrument onto the live sound map.
 * Safe to call multiple times (overwrites same keys).
 */
export async function registerLiveGmSoundfonts(): Promise<number> {
  const g = dough()
  if (typeof g.registerSound !== 'function') {
    throw new Error('registerSound not on globalThis — initStrudel/prebake not ready')
  }
  if (
    typeof g.getAudioContext !== 'function' ||
    typeof g.getADSRValues !== 'function' ||
    typeof g.getParamADSR !== 'function' ||
    typeof g.onceEnded !== 'function' ||
    typeof g.releaseAudioNode !== 'function'
  ) {
    throw new Error('SuperDough helpers missing on globalThis')
  }

  const [sfMod, gmMod] = await Promise.all([
    import('@strudel/soundfonts'),
    import('@strudel/soundfonts/gm.mjs'),
  ])
  const getFontBufferSource = (
    sfMod as unknown as {
      getFontBufferSource: (
        font: string,
        value: Record<string, unknown>,
        ac: AudioContext,
      ) => Promise<AudioBufferSourceNode>
    }
  ).getFontBufferSource

  const gm = (gmMod as { default: Record<string, string[]> }).default
  let count = 0

  for (const [name, fonts] of Object.entries(gm)) {
    if (!fonts.length) continue
    g.registerSound(
      name,
      async (time, value, onended) => {
        const [attack, decay, sustain, release] = g.getADSRValues!([
          value.attack,
          value.decay,
          value.sustain,
          value.release,
        ])
        const duration = typeof value.duration === 'number' ? value.duration : 0.5
        const font = fonts[soundIndex(value.n, fonts.length)]!
        const ctx = g.getAudioContext!()
        const bufferSource = (await getFontBufferSource(font, value, ctx)) as AudioBufferSourceNode
        bufferSource.start(time)
        const envGain = ctx.createGain()
        const node = bufferSource.connect(envGain) as GainNode
        const holdEnd = time + duration
        g.getParamADSR!(node.gain, attack, decay, sustain, release, 0, 0.3, time, holdEnd, 'linear')
        const envEnd = holdEnd + release + 0.01
        const vibratoHandle = g.getVibratoOscillator?.(bufferSource.detune, value, time) ?? null
        g.getPitchEnvelope?.(bufferSource.detune, value, time, holdEnd)
        bufferSource.stop(envEnd)
        g.onceEnded!(bufferSource, () => {
          g.releaseAudioNode!(bufferSource)
          vibratoHandle?.stop?.()
          onended()
        })
        return {
          node,
          stop: () => {},
          nodes: { source: [bufferSource], ...vibratoHandle?.nodes },
        }
      },
      { type: 'soundfont', prebake: true, fonts },
    )
    count++
  }
  return count
}

/**
 * Prefetch WebAudioFont buffers for catalog GM ids so stack haps are not
 * discarded as "still loading" on first hit (same class as VCSL cold start).
 */
export async function warmGmFonts(
  ids: string[] = catalogGmSoundIds(),
): Promise<{ ok: string[]; fail: string[] }> {
  const g = dough()
  if (typeof g.getSound !== 'function' || typeof g.getAudioContext !== 'function') {
    return { ok: [], fail: [...ids] }
  }

  const sfMod = await import('@strudel/soundfonts')
  const getFontBufferSource = (
    sfMod as unknown as {
      getFontBufferSource: (
        font: string,
        value: Record<string, unknown>,
        ac: AudioContext,
      ) => Promise<AudioBufferSourceNode>
    }
  ).getFontBufferSource
  const ac = g.getAudioContext()
  const ok: string[] = []
  const fail: string[] = []
  const queue = [...ids]

  const workers = Array.from({ length: Math.min(6, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
      const id = queue.shift()!
      const sound = g.getSound!(id)
      const font = sound?.data?.fonts?.[0]
      if (!font) {
        fail.push(id)
        continue
      }
      try {
        await getFontBufferSource(font, { note: 'c4', duration: 0.05 }, ac)
        ok.push(id)
      } catch {
        fail.push(id)
      }
    }
  })
  await Promise.all(workers)
  return { ok, fail }
}

/** True when live registry has gm_violin (sanity after register). */
export function gmRegistryReady(): boolean {
  const getSound = dough().getSound
  return typeof getSound === 'function' && !!getSound('gm_violin')?.onTrigger
}
