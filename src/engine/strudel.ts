import { useUIStore } from '../store/ui-store'
import { registerDynamicSamples } from '../components/editor/autocomplete-data'
import { COMMUNITY_SAMPLE_BANKS } from './samples'
import { syncToStrudelAudioContext, unlockAudio } from './audio-context'
export { composeTracks } from './compose-tracks'

declare global {
  // eslint-disable-next-line no-var
  var __strudelEngine: {
    initialized: boolean
    evaluateFn: ((code: string) => Promise<unknown>) | null
    /** Strudel scheduler — `.now()` returns musical cycle when playing. */
    scheduler: { now: () => number } | null
    communityBanksLoaded: boolean
  } | undefined
}

function getEngine() {
  if (!globalThis.__strudelEngine) {
    globalThis.__strudelEngine = {
      initialized: false,
      evaluateFn: null,
      scheduler: null,
      communityBanksLoaded: false,
    }
  }
  return globalThis.__strudelEngine
}

/** Musical cycle from Strudel scheduler, or null if not ready. */
export function getSchedulerCycle(): number | null {
  const sched = getEngine().scheduler
  if (!sched || typeof sched.now !== 'function') return null
  try {
    const n = sched.now()
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function isMobileLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true
  if (navigator.maxTouchPoints > 1 && /Mac/.test(ua)) return true
  return false
}

const SESSION_KEY = '__strudel_community_banks_loaded'

async function loadCommunityBanks(): Promise<void> {
  const engine = getEngine()
  if (engine.communityBanksLoaded || sessionStorage.getItem(SESSION_KEY)) {
    engine.communityBanksLoaded = true
    const ui = useUIStore.getState()
    ui.beginSampleLoading(COMMUNITY_SAMPLE_BANKS.length, 'community')
    for (let i = 0; i < COMMUNITY_SAMPLE_BANKS.length; i++) ui.onBankLoaded(true)
    ui.setSampleLoadingDone()
    registerLoadedSamples()
    console.log('[Strudel Studio] Community banks already cached this session')
    return
  }

  const BATCH_SIZE = 5
  const BATCH_DELAY = 1500
  useUIStore.getState().beginSampleLoading(COMMUNITY_SAMPLE_BANKS.length, 'community')

  for (let i = 0; i < COMMUNITY_SAMPLE_BANKS.length; i += BATCH_SIZE) {
    const batch = COMMUNITY_SAMPLE_BANKS.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((bank) => {
        try { return samples(bank) } catch { return Promise.resolve() }
      })
    )
    for (const r of results) useUIStore.getState().onBankLoaded(r.status === 'fulfilled')
    if (i + BATCH_SIZE < COMMUNITY_SAMPLE_BANKS.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
    }
  }

  try {
    await samples('github:tidalcycles/dirt-samples')
  } catch { /* silent */ }

  engine.communityBanksLoaded = true
  sessionStorage.setItem(SESSION_KEY, '1')
  useUIStore.getState().setSampleLoadingDone()
  registerLoadedSamples()
  await refreshPlayback()
}

function registerLoadedSamples(): void {
  try {
    type GetSoundFn = (name: string) => { onTrigger?: unknown } | undefined
    const getSound = (globalThis as Record<string, unknown>).getSound as GetSoundFn | undefined
    if (typeof getSound !== 'function') return
    const candidates = [
      'bd','sd','hh','oh','cp','rim','cr','ride','bass','pluck','arpy','juno','pad',
      'perc','metal','noise','stab','house','techno','sine','sawtooth','square','triangle',
      'amen','kick','snare','hihat','clap','tom',
    ]
    const found: string[] = []
    const seen = new Set<string>()
    for (const name of candidates) {
      if (seen.has(name)) continue
      seen.add(name)
      try {
        const s = getSound(name)
        if (s && s.onTrigger) found.push(name)
      } catch { /* skip */ }
    }
    if (found.length > 0) registerDynamicSamples(found)
  } catch (err) {
    console.warn('[Strudel Studio] Failed to probe sample registry:', err)
  }
}

async function refreshPlayback(): Promise<void> {
  const engine = getEngine()
  if (!engine.evaluateFn) return
  const { useSessionStore } = await import('../store/session-store')
  const state = useSessionStore.getState()
  if (!state.isPlaying) return
  try {
    const { composeTracks } = await import('./strudel')
    await engine.evaluateFn(composeTracks(state.tracks, state.bpm))
  } catch { /* silent */ }
}

export async function initEngine(): Promise<void> {
  const engine = getEngine()
  const mobile = isMobileLike()

  if (engine.initialized) {
    await syncToStrudelAudioContext()
    if (!mobile && !engine.communityBanksLoaded && !sessionStorage.getItem(SESSION_KEY)) {
      loadCommunityBanks().catch(() => {
        console.warn('[Strudel Studio] Some community sample banks failed to load')
      })
    }
    return
  }

  await unlockAudio()

  if (typeof globalThis.speechSynthesis === 'undefined') {
    (globalThis as any).speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {} }
  } else if (typeof globalThis.speechSynthesis.getVoices === 'function') {
    const origGetVoices = globalThis.speechSynthesis.getVoices.bind(globalThis.speechSynthesis)
    globalThis.speechSynthesis.getVoices = () => {
      try { return origGetVoices() || [] } catch { return [] }
    }
  }

  const { initStrudel } = await import('@strudel/web')
  const res = await initStrudel({
    prebake: async () => {
      const ui = useUIStore.getState()
      const DRUM_CDN = 'https://strudel.b-cdn.net'
      // dirt + tidal-drum-machines + piano + VCSL + mridangam + uzu-drumkit + uzu-wavetables
      const PREBAKE_TOTAL = 7
      ui.beginSampleLoading(PREBAKE_TOTAL, 'prebake')
      // Let React paint the Jam/Studio loading banner before CDN fetches block the main thread.
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        } else {
          setTimeout(resolve, 32)
        }
      })

      const track = async (fn: () => unknown) => {
        try {
          await Promise.resolve(fn())
          ui.onBankLoaded(true)
        } catch {
          ui.onBankLoaded(false)
        }
      }

      await track(() => samples('github:tidalcycles/dirt-samples'))
      // Official Strudel CDN packs — drum machines + piano/VCSL/mridangam/uzu
      await Promise.all([
        track(() =>
          samples(
            `${DRUM_CDN}/tidal-drum-machines.json`,
            `${DRUM_CDN}/tidal-drum-machines/machines/`,
            { prebake: true, tag: 'drum-machines' },
          ),
        ),
        track(() => samples(`${DRUM_CDN}/piano.json`, `${DRUM_CDN}/piano/`, { prebake: true })),
        track(() => samples(`${DRUM_CDN}/vcsl.json`, `${DRUM_CDN}/VCSL/`, { prebake: true })),
        track(() =>
          samples(`${DRUM_CDN}/mridangam.json`, `${DRUM_CDN}/mrid/`, { prebake: true, tag: 'drum-machines' }),
        ),
        track(() =>
          samples(`${DRUM_CDN}/uzu-drumkit.json`, `${DRUM_CDN}/uzu-drumkit/`, { prebake: true, tag: 'drum-machines' }),
        ),
        track(() => samples(`${DRUM_CDN}/uzu-wavetables.json`, `${DRUM_CDN}/uzu-wavetables/`, { prebake: true })),
      ])
      try {
        const alias = (globalThis as any).aliasBank
        if (typeof alias === 'function') {
          const aliasRes = await fetch(`${DRUM_CDN}/tidal-drum-machines-alias.json`)
          const json = await aliasRes.json()
          for (const [k, v] of Object.entries(json)) alias(k, v)
        }
      } catch { /* optional */ }

      // Always mark prebake done so Jam can clear "Loading kit samples…".
      // Desktop then begins a fresh community phase via loadCommunityBanks().
      ui.setSampleLoadingDone()
    },
  })
  engine.evaluateFn = res.evaluate
  const sched = (res as { scheduler?: { now: () => number } }).scheduler
  engine.scheduler = sched && typeof sched.now === 'function' ? sched : null
  engine.initialized = true

  const unlock = await syncToStrudelAudioContext()
  if (!unlock.ok) {
    console.warn('[Strudel Studio] Audio still suspended after init:', unlock.state, unlock.detail)
  }

  if (!mobile) {
    loadCommunityBanks().catch(() => {
      console.warn('[Strudel Studio] Some community sample banks failed to load')
    })
  } else {
    console.log('[Strudel Studio] Mobile: deferred community banks until after first sound')
  }
}

export function maybeLoadCommunityBanks(): void {
  const engine = getEngine()
  if (!engine.initialized) return
  if (engine.communityBanksLoaded || sessionStorage.getItem(SESSION_KEY)) return
  window.setTimeout(() => {
    loadCommunityBanks().catch(() => {
      console.warn('[Strudel Studio] Some community sample banks failed to load')
    })
  }, 2500)
}

export async function evaluateCode(code: string): Promise<void> {
  const engine = getEngine()
  if (!engine.evaluateFn) await initEngine()
  await getEngine().evaluateFn!(code)
}

export async function stop(): Promise<void> {
  const engine = getEngine()
  if (engine.evaluateFn) {
    try { await engine.evaluateFn('hush()') }
    catch (e) { console.warn('[Strudel Studio] hush() failed:', e) }
  }
}

/** Debounce live recompose so ± hold-repeat (~80ms) does not thrash evaluate. */
const BPM_REEVAL_MS = 120
let bpmReevalTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Apply tempo to the live engine.
 * Callers must update session-store bpm first.
 * Bare `evaluate(setcps(...))` replaces the running pattern and silences audio —
 * while playing we recompose the full session. When stopped, this is a no-op
 * (store already holds the new bpm).
 */
export async function setBpm(_bpm: number): Promise<void> {
  const { useSessionStore } = await import('../store/session-store')
  if (!useSessionStore.getState().isPlaying) return

  if (bpmReevalTimer) clearTimeout(bpmReevalTimer)
  bpmReevalTimer = setTimeout(() => {
    bpmReevalTimer = null
    void refreshPlayback()
  }, BPM_REEVAL_MS)
}

declare global {
  function hush(): void
  function setcps(cps: number): void
  function samples(...args: unknown[]): unknown
}
