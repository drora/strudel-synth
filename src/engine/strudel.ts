import type { Track } from './types'
import { useUIStore } from '../store/ui-store'
import { registerDynamicSamples } from '../components/editor/autocomplete-data'
import { syncToStrudelAudioContext, unlockAudio } from './audio-context'

declare global {
  // eslint-disable-next-line no-var
  var __strudelEngine: {
    initialized: boolean
    evaluateFn: ((code: string) => Promise<unknown>) | null
    communityBanksLoaded: boolean
  } | undefined
}

function getEngine() {
  if (!globalThis.__strudelEngine) {
    globalThis.__strudelEngine = {
      initialized: false,
      evaluateFn: null,
      communityBanksLoaded: false,
    }
  }
  return globalThis.__strudelEngine
}

function isMobileLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true
  if (navigator.maxTouchPoints > 1 && /Mac/.test(ua)) return true
  return false
}

const COMMUNITY_SAMPLE_BANKS = [
  'github:yaxu/clean-breaks',
  'github:Bubobubobubobubo/Dough-Amen',
  'github:Bubobubobubobubo/Dough-Juj',
  'github:eddyflux/crate',
  'github:TodePond/samples',
  'github:algorave-dave/samples',
  'github:AuditeMarlow/samples',
  'github:terrorhank/samples',
  'github:tesspilot/samples',
  'github:TristanCacqueray/mirus',
  'github:k09/samples',
  'github:EloMorelo/samples',
  'github:Nikeryms/Samples',
  'github:RikyBac15/samples',
  'github:fstiffo/polifonia-samples',
  'github:kaiye10/strudelSamples',
  'github:fjpolo/fjpolo-Strudel',
  'github:mysinglelise/msl-strudel-samples',
  'github:salsicha/capoeira_strudel',
  'github:sonidosingapura/rochormatic',
  'github:hvillase/cavlp-25p',
  'github:bruveping/RepositorioDesonidosParaExperimentar02',
  'github:QuantumVillage/quantum-music',
  'github:Veikkosuhonen/graffathon25-demo',
  'github:AustinOliverHaskell/ms-teams-sounds-strudel',
]

const SESSION_KEY = '__strudel_community_banks_loaded'

async function loadCommunityBanks(): Promise<void> {
  const engine = getEngine()
  if (engine.communityBanksLoaded || sessionStorage.getItem(SESSION_KEY)) {
    engine.communityBanksLoaded = true
    const ui = useUIStore.getState()
    ui.setSampleLoadingTotal(COMMUNITY_SAMPLE_BANKS.length)
    for (let i = 0; i < COMMUNITY_SAMPLE_BANKS.length; i++) ui.onBankLoaded(true)
    ui.setSampleLoadingDone()
    registerLoadedSamples()
    console.log('[Strudel Studio] Community banks already cached this session')
    return
  }

  const BATCH_SIZE = 5
  const BATCH_DELAY = 1500
  useUIStore.getState().setSampleLoadingTotal(COMMUNITY_SAMPLE_BANKS.length)

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
      await samples('github:tidalcycles/dirt-samples')
      // Official Strudel drum-machine banks (RolandTR909 etc.) — required for kit .bank()
      const DRUM_CDN = 'https://strudel.b-cdn.net'
      await samples(
        `${DRUM_CDN}/tidal-drum-machines.json`,
        `${DRUM_CDN}/tidal-drum-machines/machines/`,
        { prebake: true, tag: 'drum-machines' },
      )
      try {
        const alias = (globalThis as any).aliasBank
        if (typeof alias === 'function') {
          const aliasRes = await fetch(`${DRUM_CDN}/tidal-drum-machines-alias.json`)
          const json = await aliasRes.json()
          for (const [k, v] of Object.entries(json)) alias(k, v)
        }
      } catch { /* optional */ }
    },
  })
  engine.evaluateFn = res.evaluate
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

export async function setBpm(bpm: number): Promise<void> {
  const cps = bpm / 60 / 4
  const engine = getEngine()
  if (engine.evaluateFn) {
    try { await engine.evaluateFn(`setcps(${cps})`) }
    catch (e) { console.warn('[Strudel Studio] setcps() failed:', e) }
  }
}

export function composeTracks(tracks: Track[], bpm: number): string {
  const cps = bpm / 60 / 4
  const activeTracks = tracks.filter((t) => {
    if (tracks.some((tr) => tr.soloed)) return t.soloed && !t.muted
    return !t.muted
  })
  const header = `setcps(${cps})\n`
  if (activeTracks.length === 0) return header + 'silence'
  if (activeTracks.length === 1) {
    const t = activeTracks[0]
    return `${header}(${t.code}).gain(${t.volume})`
  }
  const parts = activeTracks.map((t) => `  (${t.code}).gain(${t.volume})`).join(',\n')
  return `${header}stack(\n${parts}\n)`
}

declare global {
  function hush(): void
  function setcps(cps: number): void
  function samples(...args: unknown[]): unknown
}
