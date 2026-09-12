/**
 * iOS-safe AudioContext unlock + sync with Strudel/superdough.
 *
 * Root cause of silent iPhone playback: a standalone `new AudioContext()`
 * was resumed by Play, while @strudel/web / superdough kept a different
 * suspended context. We unlock on user gesture, prefer webkitAudioContext,
 * and after Strudel inits we adopt its context if exposed.
 */

type UnlockResult = { ok: boolean; state: string; detail?: string }

type AudioContextCtor = typeof AudioContext

let localCtx: AudioContext | null = null
let strudelSynced = false

function getAudioContextCtor(): AudioContextCtor {
  const g = globalThis as typeof globalThis & {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (!Ctor) {
    throw new Error('Web Audio API not available in this browser')
  }
  return Ctor
}

/** Resolve Strudel/superdough's shared AudioContext if already created. */
function resolveStrudelAudioContext(): AudioContext | null {
  const g = globalThis as Record<string, unknown>

  const fromGlobal = g.getAudioContext
  if (typeof fromGlobal === 'function') {
    try {
      const ctx = (fromGlobal as () => AudioContext)()
      if (ctx && typeof ctx.resume === 'function') return ctx
    } catch {
      /* ignore */
    }
  }

  // Some builds hang the getter on a module namespace
  for (const key of ['superdough', 'webaudio', '__strudel']) {
    const mod = g[key] as { getAudioContext?: () => AudioContext } | undefined
    if (mod && typeof mod.getAudioContext === 'function') {
      try {
        const ctx = mod.getAudioContext()
        if (ctx && typeof ctx.resume === 'function') return ctx
      } catch {
        /* ignore */
      }
    }
  }

  return null
}

function ensureLocalContext(): AudioContext {
  if (!localCtx || localCtx.state === 'closed') {
    localCtx = new (getAudioContextCtor())()
  }
  return localCtx
}

/**
 * Preferred AudioContext: Strudel's if available, else local fallback.
 * Call syncToStrudelAudioContext() after initStrudel so we stop orphaning.
 */
export function getAudioContext(): AudioContext {
  const strudel = resolveStrudelAudioContext()
  if (strudel) {
    localCtx = strudel
    strudelSynced = true
    return strudel
  }
  return ensureLocalContext()
}

export function getAudioContextState(): AudioContextState | 'missing' {
  try {
    const strudel = resolveStrudelAudioContext()
    if (strudel) return strudel.state
    return localCtx?.state ?? 'missing'
  } catch {
    return 'missing'
  }
}

/** Play a silent 1-sample buffer — classic iOS unlock trick inside a gesture. */
async function playSilentUnlock(ctx: AudioContext): Promise<void> {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    /* some environments disallow empty buffers — resume alone may still work */
  }
}

async function resumeContext(ctx: AudioContext): Promise<AudioContextState> {
  if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
    try {
      await ctx.resume()
    } catch (err) {
      console.warn('[audio] resume failed:', err)
    }
  }
  await playSilentUnlock(ctx)
  // Second resume after silent buffer helps stubborn iOS WebViews
  if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
    try {
      await ctx.resume()
    } catch {
      /* ignore */
    }
  }
  return ctx.state
}

/**
 * Unlock audio on a user gesture. Safe to call multiple times.
 * Prefer calling this FIRST in the same click handler before initEngine.
 */
export async function unlockAudio(): Promise<UnlockResult> {
  try {
    let ctx = resolveStrudelAudioContext() ?? ensureLocalContext()
    const state = await resumeContext(ctx)

    // If Strudel created its own context after we started, unlock that too
    const strudel = resolveStrudelAudioContext()
    if (strudel && strudel !== ctx) {
      localCtx = strudel
      strudelSynced = true
      const s2 = await resumeContext(strudel)
      return {
        ok: s2 === 'running',
        state: s2,
        detail: s2 === 'running' ? undefined : 'Strudel AudioContext still suspended',
      }
    }

    return {
      ok: state === 'running',
      state,
      detail: state === 'running' ? undefined : `AudioContext is ${state}`,
    }
  } catch (err) {
    return {
      ok: false,
      state: 'missing',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * After initStrudel / evaluate, adopt Strudel's AudioContext and resume it.
 */
export async function syncToStrudelAudioContext(): Promise<UnlockResult> {
  try {
    let ctx = resolveStrudelAudioContext()
    if (!ctx) {
      // Fall back to local — engine may not expose getter yet
      return unlockAudio()
    }
    localCtx = ctx
    strudelSynced = true
    const state = await resumeContext(ctx)
    return {
      ok: state === 'running',
      state,
      detail: state === 'running' ? undefined : `Strudel context is ${state}`,
    }
  } catch (err) {
    return {
      ok: false,
      state: getAudioContextState(),
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Full unlock path for Play / Update / Learn play:
 * 1) unlock on gesture
 * 2) sync to Strudel context if exposed
 */
export async function ensureAudioUnlocked(): Promise<UnlockResult> {
  const first = await unlockAudio()
  if (strudelSynced || resolveStrudelAudioContext()) {
    const synced = await syncToStrudelAudioContext()
    return synced.ok ? synced : first.ok ? first : synced
  }
  return first
}

/** @deprecated Prefer ensureAudioUnlocked() — kept for call-site compatibility */
export async function resumeAudioContext(): Promise<void> {
  await ensureAudioUnlocked()
}

export function isAudioSyncedToStrudel(): boolean {
  return strudelSynced || !!resolveStrudelAudioContext()
}

type AudioSessionLike = { type: string }

/**
 * After getUserMedia, phones stay in voice/SCO mode (built-in speaker).
 * Stop the mic first. Do not setSinkId or play HTML audio — that muted Rec playback.
 */
export async function restoreMediaRoute(): Promise<void> {
  try {
    const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession
    if (session) session.type = 'playback'
  } catch {
    /* */
  }
  try {
    await resumeContext(getAudioContext())
  } catch {
    /* */
  }
}
