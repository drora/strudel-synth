import type { Track } from './types'
import { useUIStore } from '../store/ui-store'
import { registerDynamicSamples } from '../components/editor/autocomplete-data'

// ── HMR-safe globals ──────────────────────────────────────────
// Vite HMR resets module-level variables, so persist on globalThis.
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

/**
 * Additional community sample banks from awesome-strudel.
 * These load progressively in the background after init so they
 * don't block startup or hit GitHub rate limits all at once.
 */
const COMMUNITY_SAMPLE_BANKS = [
  'github:yaxu/clean-breaks',
  'github:Bubobubobubobubo/Dough-Amen',
  'github:Bubobubobubobubo/Dough-Juj',
  'github:eddyflux/crate',
  'github:TodePond/samples',
  // Excluded: wyan/livecoding-samples (collides: bass)
  'github:algorave-dave/samples',
  'github:AuditeMarlow/samples',
  'github:terrorhank/samples',
  'github:tesspilot/samples',
  // Excluded: prismograph/departure (collides: bass, breaks, pad, short)
  'github:TristanCacqueray/mirus',
  'github:k09/samples',
  'github:EloMorelo/samples',
  'github:Nikeryms/Samples',
  'github:RikyBac15/samples',
  'github:fstiffo/polifonia-samples',
  // Excluded: mot4i/garden (collides: metal)
  'github:kaiye10/strudelSamples',
  // Excluded: emrexdeger/strudelSamples (collides: pad, perc, ride)
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

/** Load community banks in batches to avoid GitHub rate limits */
async function loadCommunityBanks(): Promise<void> {
  const engine = getEngine()

  // Already loaded this session (survives HMR + same-tab navigations)
  if (engine.communityBanksLoaded || sessionStorage.getItem(SESSION_KEY)) {
    engine.communityBanksLoaded = true
    // Mark UI as done immediately
    const ui = useUIStore.getState()
    ui.setSampleLoadingTotal(COMMUNITY_SAMPLE_BANKS.length)
    // Simulate all loaded
    for (let i = 0; i < COMMUNITY_SAMPLE_BANKS.length; i++) {
      ui.onBankLoaded(true)
    }
    ui.setSampleLoadingDone()
    // Still register dynamic samples for autocomplete (cached session)
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
        try {
          return samples(bank)
        } catch {
          return Promise.resolve()
        }
      })
    )
    for (const r of results) {
      useUIStore.getState().onBankLoaded(r.status === 'fulfilled')
    }
    const loaded = results.filter((r) => r.status === 'fulfilled').length
    console.log(
      `[Strudel Studio] Sample batch ${Math.floor(i / BATCH_SIZE) + 1}: ${loaded}/${batch.length}`
    )
    if (i + BATCH_SIZE < COMMUNITY_SAMPLE_BANKS.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
    }
  }

  // Re-register dirt-samples LAST so core sounds (bd, sd, hh, etc.) always
  // take priority over community banks that may have same-named folders.
  try {
    await samples('github:tidalcycles/dirt-samples')
    console.log('[Strudel Studio] Dirt-samples re-registered (priority restored)')
  } catch { /* silent */ }

  engine.communityBanksLoaded = true
  sessionStorage.setItem(SESSION_KEY, '1')
  useUIStore.getState().setSampleLoadingDone()
  console.log('[Strudel Studio] All community sample banks loaded')

  // Register all available sample names into the autocomplete system
  registerLoadedSamples()

  // Re-evaluate current composition so playing tracks rebind to correct samples
  await refreshPlayback()
}

/**
 * Introspect Strudel's internal sample registry and feed all
 * available sample names into the autocomplete system.
 *
 * Strudel doesn't expose a bulk "list all sounds" API, but
 * `getSound(name)` returns truthy for registered names.
 * We probe a comprehensive candidate list built from:
 *  - All known dirt-samples folder names
 *  - Common community bank folder names
 *  - Synth oscillator names
 */
function registerLoadedSamples(): void {
  try {
    type GetSoundFn = (name: string) => { onTrigger?: unknown } | undefined
    const getSound = (globalThis as Record<string, unknown>).getSound as GetSoundFn | undefined
    if (typeof getSound !== 'function') {
      console.log('[Strudel Studio] getSound not available, using static sample list')
      return
    }

    // Comprehensive candidate list — dirt-samples + known community names
    const candidates = [
      // dirt-samples core (all 120+ folders)
      'bd','sd','hh','hh27','oh','cp','rim','cb','lt','mt','ht','cr','ride','rs','sn',
      'clubkick','hardkick','kicklinn','popkick','reverbkick','realclaps','hand','linnhats',
      '808','dr','dr2','dr55','dr_few','drum','drumtraks','electro1','casio','gretsch',
      'breaks125','breaks152','breaks157','breaks165','amencutup',
      'bass','bass0','bass1','bass2','bass3','bassdm','bassfoo','jvbass','jungbass','wobble',
      'pluck','arpy','juno','sax','gtr','pad','padlong','sitar','fm','arp','newnotes','notes','sid',
      'perc','peri','tabla','tabla2','tablex','metal','click','tink','tok','glasstap','pebbles',
      'noise','noise2','glitch','glitch2','fire','insect','bubble',
      'stab','rave','rave2','ravemono','hoover','hit','blip','flick',
      'house','techno','jazz','hardcore','gabba','gabbaloud','gabbalouder','jungle','industrial',
      'mouth','yeah','auto','moan','hmm','speechless','diphone','diphone2','numbers','alphabet',
      'space','wind','birds','birds3','breath','outdoor','crow',
      'future','invaders','circus','toys','kurt','xmas','bottle','can','lighter','print',
      'sine','triangle','sawtooth','square',
      'ab','acid','ades','alex','armora','auto','baa','battles','bend','bev','bin','blue',
      'cc','chin','clak','co','cosmicg','d','db','dork2','e','east','em2','erk','f',
      'feel','feelfx','fest','foo','gab','h','hardcore','haw','hc','ho','if','ifdrums',
      'incoming','koy','latibro','led','less','mad','made','made2','mash','mash2',
      'miniyeah','monatra','mp3','msg','mute','oc','odx','off','proc','procshort','psr',
      'rm','seawolf','sequential','sf','sheffield','short','stomp','str','subroc3d',
      'sugar','sundance','tacscan','tech','trump','ul','ulgab','uxay','v','voodoo','world',
      // Community bank samples (probed names)
      'amen','break','crate','kick','snare','hihat','clap','tom','cymbal','shaker',
      'conga','bongo','cowbell','guiro','claves','maracas','tambourine',
      'cocaina','juj','supersaw','mirus','dough',
      'berimbau','atabaque','pandeiro','agogo','reco','surdo',
      'amen1','amen2','amen3','amen4',
    ]

    const found: string[] = []
    const seen = new Set<string>()
    for (const name of candidates) {
      const lower = name.toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)
      try {
        const s = getSound(lower)
        if (s && s.onTrigger) found.push(lower)
      } catch { /* skip */ }
    }

    if (found.length > 0) {
      registerDynamicSamples(found)
      console.log(`[Strudel Studio] Probed ${candidates.length} names, found ${found.length} available sounds`)
    } else {
      console.log('[Strudel Studio] No sounds found via probing, using static list')
    }
  } catch (err) {
    console.warn('[Strudel Studio] Failed to probe sample registry:', err)
  }
}

/**
 * Re-evaluate the current composition if playing.
 * Called after community banks finish loading so tracks rebind to
 * the correct (original dirt-samples) sample mappings.
 */
async function refreshPlayback(): Promise<void> {
  const engine = getEngine()
  if (!engine.evaluateFn) return

  // Dynamic import to avoid circular dependency
  const { useSessionStore } = await import('../store/session-store')
  const state = useSessionStore.getState()
  if (!state.isPlaying) return

  try {
    const { composeTracks } = await import('./strudel')
    const code = composeTracks(state.tracks, state.bpm)
    await engine.evaluateFn(code)
    console.log('[Strudel Studio] Refreshed playback after bank loading')
  } catch {
    // Silent — don't interrupt the user
  }
}

export async function initEngine(): Promise<void> {
  const engine = getEngine()
  if (engine.initialized) {
    // Even if already initialized, kick off community banks if not done
    if (!engine.communityBanksLoaded && !sessionStorage.getItem(SESSION_KEY)) {
      loadCommunityBanks().catch(() => {
        console.warn('[Strudel Studio] Some community sample banks failed to load')
      })
    }
    return
  }

  // Polyfill speechSynthesis.getVoices() for environments where
  // SpeechSynthesis is unavailable (mobile Safari, restricted contexts).
  // Strudel's initStrudel() internally calls getVoices() and crashes
  // with "Object.getPrototypeOf(voice)" when voices are undefined.
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
    },
  })
  engine.evaluateFn = res.evaluate
  engine.initialized = true

  // Load community banks in background (non-blocking)
  loadCommunityBanks().catch(() => {
    console.warn('[Strudel Studio] Some community sample banks failed to load')
  })
}

export async function evaluateCode(code: string): Promise<void> {
  const engine = getEngine()
  if (!engine.evaluateFn) {
    await initEngine()
  }
  await getEngine().evaluateFn!(code)
}

/**
 * Stop all playback by evaluating hush() through the Strudel engine.
 */
export async function stop(): Promise<void> {
  const engine = getEngine()
  if (engine.evaluateFn) {
    try {
      await engine.evaluateFn('hush()')
    } catch (e) { console.warn('[Strudel Studio] hush() failed:', e) }
  }
}

/**
 * Set BPM by evaluating setcps() through the Strudel engine.
 */
export async function setBpm(bpm: number): Promise<void> {
  const cps = bpm / 60 / 4
  const engine = getEngine()
  if (engine.evaluateFn) {
    try {
      await engine.evaluateFn(`setcps(${cps})`)
    } catch (e) { console.warn('[Strudel Studio] setcps() failed:', e) }
  }
}

/**
 * Compose all active (non-muted) tracks into a single evaluatable code string.
 * Embeds setcps() at the top so tempo is always correct when re-evaluating.
 * Appends Strudel's built-in visualizers (scope + spectrum) for real-time audio feedback.
 */
export function composeTracks(tracks: Track[], bpm: number): string {
  const cps = bpm / 60 / 4
  const activeTracks = tracks.filter((t) => {
    if (tracks.some((tr) => tr.soloed)) {
      return t.soloed && !t.muted
    }
    return !t.muted
  })

  const header = `setcps(${cps})\n`

  if (activeTracks.length === 0) return header + 'silence'

  if (activeTracks.length === 1) {
    const t = activeTracks[0]
    return `${header}(${t.code}).gain(${t.volume})`
  }

  const parts = activeTracks
    .map((t) => `  (${t.code}).gain(${t.volume})`)
    .join(',\n')

  return `${header}stack(\n${parts}\n)`
}

// Extend globalThis for Strudel globals
declare global {
  function hush(): void
  function setcps(cps: number): void
  function samples(...args: unknown[]): unknown
}
