/**
 * Audio / playback regression smoke.
 * Catalog lossless is NOT enough — false "I hear nothing" after phone silent.
 *
 * As far as Node/box can go:
 *  1) Punch 909 generate → non-empty code, drums keep playable s()+.bank()
 *  2) Live GM registry contract: registerSound → gmRegistryReady() (same
 *     globalThis.registerSound path production uses after initStrudel)
 *  3) Short onTrigger hits: bank drum stand-in (bd), synth (sawtooth/sine), gm_violin
 *
 * Run: npm run test:audio-regress
 */
import assert from 'node:assert/strict'
import { getKit, generateKitTracks } from './kits'
import { gmRegistryReady, catalogGmSoundIds } from './gm-soundfonts'

console.log('=== Audio regress smoke ===')

// ---------- 1) Punch 909 generate ----------
{
  const kit = getKit('techno-punch909')
  assert.ok(kit, 'techno-punch909 kit')
  const tracks = generateKitTracks(kit!)
  assert.ok(tracks.length >= 3, `expected ≥3 tracks, got ${tracks.length}`)
  for (const t of tracks) {
    assert.ok(String(t.code ?? '').trim().length > 0, `${t.role} empty code`)
  }
  const drumish = tracks.filter((t) => t.role === 'drums' || t.role === 'hihats' || t.role === 'fx')
  assert.ok(drumish.length >= 1, 'Punch 909 drum-family tracks')
  for (const t of drumish) {
    assert.match(t.code, /\bs\s*\(/, `${t.role} missing s(): ${t.code}`)
    assert.match(t.code, /\.bank\s*\(/, `${t.role} missing .bank(): ${t.code}`)
  }
  const kick = tracks.find((t) => t.role === 'drums')
  assert.ok(kick, 'drums track')
  assert.match(kick!.code, /RolandTR909/, `Punch 909 drums bank RolandTR909: ${kick!.code}`)
  console.log(
    `  Punch 909: ${tracks.length} tracks, drum lanes keep s()+.bank() [${drumish.map((d) => d.role).join(', ')}]`,
  )
}

// ---------- SuperDough stub (production registerSound / getSound globals) ----------
type OnTrigger = (
  time: number,
  value: Record<string, unknown>,
  onended: () => void,
) => Promise<{ node?: unknown; stop?: (t?: number) => void } | void> | { node?: unknown; stop?: (t?: number) => void } | void

const soundMap = new Map<string, { onTrigger: OnTrigger; data?: Record<string, unknown> }>()

function installDoughStub() {
  const g = globalThis as any
  const stubNode = () => {
    const n: any = {
      connect(dest: any) {
        return dest ?? n
      },
      disconnect() {},
      start() {},
      stop() {},
      gain: { value: 1 },
      detune: { value: 0 },
      frequency: { value: 440 },
      type: 'sawtooth',
    }
    return n
  }
  const ac: any = {
    currentTime: 0,
    sampleRate: 44100,
    destination: stubNode(),
    state: 'running',
    createGain: () => stubNode(),
    createOscillator: () => stubNode(),
    resume: async () => {},
    close: async () => {},
  }

  g.registerSound = (name: string, onTrigger: OnTrigger, data?: Record<string, unknown>) => {
    soundMap.set(name, { onTrigger, data })
  }
  g.getSound = (name: string) => soundMap.get(name)
  g.getAudioContext = () => ac
  g.getADSRValues = (arr: unknown[]) => {
    const n = arr.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0.01))
    return [n[0] ?? 0.01, n[1] ?? 0.1, n[2] ?? 0.7, n[3] ?? 0.1]
  }
  g.getParamADSR = () => {}
  g.onceEnded = (_node: unknown, cb: () => void) => {
    queueMicrotask(cb)
  }
  g.releaseAudioNode = () => {}
  g.getSoundIndex = (n: unknown, len: number) => {
    const i = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0
    return ((i % len) + len) % len
  }

  const buzz =
    (kind: 'drum' | 'sawtooth' | 'sine'): OnTrigger =>
    async (time, _value, onended) => {
      const ctx = g.getAudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = kind === 'drum' ? 'square' : kind
      if (osc.frequency) osc.frequency.value = kind === 'drum' ? 55 : 440
      gain.gain.value = 0.15
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t0 = typeof time === 'number' ? time : 0
      try {
        osc.start(t0)
        osc.stop(t0 + 0.06)
      } catch {
        /* */
      }
      g.onceEnded(osc, onended)
      return {
        node: gain,
        stop: (t?: number) => {
          try {
            osc.stop(t ?? ctx.currentTime)
          } catch {
            /* */
          }
        },
      }
    }

  // Bank-drum + synth stand-ins (full SuperDough sample banks need browser initStrudel)
  g.registerSound('bd', buzz('drum'), { type: 'sample' })
  g.registerSound('sawtooth', buzz('sawtooth'), { type: 'synth' })
  g.registerSound('sine', buzz('sine'), { type: 'synth' })
}

installDoughStub()

// ---------- 2) GM live registry (same registerSound contract as registerLiveGmSoundfonts) ----------
// Node cannot import @strudel/soundfonts main (kabelsalat CJS named-export hole).
// We load the same gm.mjs map production uses and register via globalThis.registerSound.
{
  const gmMod = await import('@strudel/soundfonts/gm.mjs')
  const gm = (gmMod as { default: Record<string, string[]> }).default
  assert.ok(gm && typeof gm === 'object', 'gm.mjs map')
  assert.ok(gm.gm_violin?.length || (gm as any).violin, 'gm map has violin')

  let n = 0
  const g = globalThis as any
  for (const [name, fonts] of Object.entries(gm)) {
    if (!fonts?.length) continue
    // Keys in gm.mjs are bare ("violin") — production prefixes gm_
    const key = name.startsWith('gm_') ? name : `gm_${name}`
    g.registerSound(
      key,
      async (time: number, value: Record<string, unknown>, onended: () => void) => {
        // Node: skip WebAudioFont PCM fetch; still prove onTrigger is wired & callable
        void time
        void value
        void fonts
        onended()
        return { stop: () => {} }
      },
      { type: 'soundfont', prebake: true, fonts },
    )
    n++
  }
  assert.ok(n > 50, `expected many GM registrations, got ${n}`)
  assert.equal(gmRegistryReady(), true, 'gmRegistryReady() after live registerSound')
  assert.ok(g.getSound('gm_violin')?.onTrigger, 'gm_violin onTrigger present')
  const catalog = catalogGmSoundIds()
  assert.ok(catalog.includes('gm_violin'), 'catalogGmSoundIds includes gm_violin')
  console.log(`  GM live-register: ${n} fonts via registerSound, gmRegistryReady=true`)
}

// ---------- 3) Short onTrigger hits ----------
async function fire(name: string) {
  const sound = (globalThis as any).getSound(name)
  assert.ok(sound?.onTrigger, `${name}: onTrigger missing`)
  const ac = (globalThis as any).getAudioContext()
  const t0 = typeof ac.currentTime === 'number' ? ac.currentTime : 0
  const handle = await sound.onTrigger(
    t0 + 0.01,
    { s: name, note: 'c4', duration: 0.05, gain: 0.25 },
    () => {},
  )
  try {
    handle?.stop?.(t0 + 0.08)
  } catch {
    /* */
  }
  console.log(`  onTrigger ok: ${name}`)
}

await fire('bd')
await fire('sawtooth')
await fire('sine')
await fire('gm_violin')

console.log('ok — audio regress: Punch 909 generate + GM registry + onTrigger hits')
