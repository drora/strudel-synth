/**
 * Per-track Swap sound (track dialog, beside Shuffle this).
 * Sound-only, role catalog, Lock blocks, not walk-loop deferred.
 * Run: npm run test:swap-sound
 */
import assert from 'node:assert/strict'
import { soundChoicesForKit } from './kit-sound-choices'
import { getKit, matchSoundChoice } from './kits'
import type { SoundChoice } from './kits'

function installLocalStorage() {
  const g = globalThis as typeof globalThis & { localStorage?: Storage; window?: typeof globalThis }
  if (g.localStorage) return
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  if (typeof g.window === 'undefined') g.window = globalThis
}

function poolIndex(choices: SoundChoice[], code: string, pred: (c: SoundChoice) => boolean): number {
  const usable = choices.filter((c) => c.sound || c.bank)
  const current = usable.find((c) => matchSoundChoice(code, c))
  const pool = current ? usable.filter((c) => c.id !== current.id) : usable
  const idx = pool.findIndex(pred)
  assert.ok(idx >= 0, 'expected an alternate tile')
  return (idx + 0.01) / pool.length
}

installLocalStorage()
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
}

const { useSessionStore } = await import('../store/session-store.ts')
const { useJamStore } = await import('../store/jam-store.ts')
const { swapTrackSoundById } = await import('./jam-actions.ts')
const { liveUpdateEngine } = await import('./live-update.ts')

console.log('=== Swap track sound smoke ===')

const session = useSessionStore.getState()
const bassCode = 'note("c3 eb3 g3").sound("sawtooth").gain(0.5)'
const drumCode = 's("bd sd").bank("RolandTR909").gain(1.05)'
const hatCode = 's("hh ~ hh ~").bank("RolandTR909")'
const fxCode = 's("cp ~ ~ cp").bank("RolandTR909").gain(0.8)'

const bassId = session.addTrack({
  name: 'Bass',
  role: 'bass',
  code: bassCode,
  color: '#00e5ff',
  muted: false,
  soloed: false,
  locked: false,
  volume: 1,
  octave: 0,
  error: null,
})
const drumId = session.addTrack({
  name: 'Kick',
  role: 'drums',
  code: drumCode,
  color: '#ff8c42',
  muted: false,
  soloed: false,
  locked: false,
  volume: 1,
  octave: 0,
  error: null,
})
const hatId = session.addTrack({
  name: 'Hats',
  role: 'hihats',
  code: hatCode,
  color: '#ccc',
  muted: false,
  soloed: false,
  locked: false,
  volume: 1,
  octave: 0,
  error: null,
})
const fxId = session.addTrack({
  name: 'Clap',
  role: 'fx',
  code: fxCode,
  color: '#f6c',
  muted: false,
  soloed: false,
  locked: false,
  volume: 1,
  octave: 0,
  error: null,
})

useJamStore.getState().setKitId('techno-punch909')
const kit = getKit('techno-punch909')
assert.ok(kit)

{
  const choices = soundChoicesForKit('bass', kit)
  const rng = poolIndex(choices, bassCode, (c) => c.sound === 'square')
  const r = swapTrackSoundById(bassId, { random: () => rng })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.label, 'Square bass')
  const next = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  assert.match(next, /note\("c3 eb3 g3"\)/, `notes stay; got ${next}`)
  assert.match(next, /\.sound\("square"\)/, `square voice; got ${next}`)
  assert.ok(!kit!.shuffle.melodicSounds?.includes('square'), 'square is outside kit.melodicSounds')
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === drumId)!.code,
    drumCode,
    'other tracks unchanged',
  )
  console.log('  bass: catalog square, pattern kept, drums untouched')
}

{
  // sine is a legal bass catalog voice (no sine ban)
  const code = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  const choices = soundChoicesForKit('bass', kit)
  const rng = poolIndex(choices, code, (c) => c.sound === 'sine')
  const r = swapTrackSoundById(bassId, { random: () => rng })
  assert.equal(r.ok, true)
  const next = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  assert.match(next, /\.sound\("sine"\)/, `sine allowed; got ${next}`)
  console.log('  bass: sine is a legal roll')
}

{
  const choices = soundChoicesForKit('drums', kit)
  const rng = poolIndex(choices, drumCode, (c) => c.bank === 'RolandTR808')
  const r = swapTrackSoundById(drumId, { random: () => rng })
  assert.equal(r.ok, true)
  const next = useSessionStore.getState().tracks.find((t) => t.id === drumId)!.code
  assert.match(next, /s\("bd sd"\)/, `drum pattern stays; got ${next}`)
  assert.match(next, /RolandTR808/, `808 bank; got ${next}`)
  assert.doesNotMatch(next, /note\(/, 'drums stay a drum line')
  const hatChoices = soundChoicesForKit('hihats', kit).filter((c) => c.bank).map((c) => c.bank)
  assert.ok(!hatChoices.includes('square' as never))
  console.log('  drums: another drum-bank tile, pattern kept')
}

{
  const choices = soundChoicesForKit('hihats', kit)
  const rng = poolIndex(choices, hatCode, (c) => c.bank === 'RolandTR808')
  const r = swapTrackSoundById(hatId, { random: () => rng })
  assert.equal(r.ok, true)
  const next = useSessionStore.getState().tracks.find((t) => t.id === hatId)!.code
  assert.match(next, /s\("hh ~ hh ~"\)/)
  assert.match(next, /RolandTR808/)
  assert.doesNotMatch(next, /\.sound\(/)
  console.log('  hats: stay in hat bank catalog')
}

{
  const choices = soundChoicesForKit('fx', kit)
  const rng = poolIndex(choices, fxCode, (c) => c.sound === 'pad')
  const r = swapTrackSoundById(fxId, { random: () => rng })
  assert.equal(r.ok, true)
  const next = useSessionStore.getState().tracks.find((t) => t.id === fxId)!.code
  assert.equal(next, 's("pad").gain(0.8)', `dirt sound-only strips bank; got ${next}`)
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code.includes('note('),
    true,
  )
  console.log('  fx: dirt pad tile strips bank, others untouched')
}

{
  const before = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  useSessionStore.getState().toggleLock(bassId)
  assert.equal(useSessionStore.getState().tracks.find((t) => t.id === bassId)?.locked, true)
  const r = swapTrackSoundById(bassId)
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /locked/i)
  const after = useSessionStore.getState().tracks.find((t) => t.id === bassId)!
  assert.equal(after.code, before, 'locked lane sound unchanged')
  assert.equal(after.locked, true, 'swap does not unpin')
  console.log('  lock: blocked, still locked')
}

{
  useSessionStore.getState().toggleLock(bassId)
  assert.equal(useSessionStore.getState().tracks.find((t) => t.id === bassId)?.locked, false)
  useJamStore.setState({ pendingSong: null })
  useSessionStore.getState().setPlaying(true)
  const code = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  const choices = soundChoicesForKit('bass', kit)
  const rng = poolIndex(choices, code, (c) => c.sound === 'piano')
  const r = swapTrackSoundById(bassId, { random: () => rng })
  assert.equal(r.ok, true)
  const next = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  assert.notEqual(next, code, 'playing applies sound immediately in the store')
  assert.equal(useJamStore.getState().pendingSong, null, 'not queued to walk-loop end')
  liveUpdateEngine.cancel()
  useSessionStore.getState().setPlaying(false)
  console.log('  playing: store now, no pendingSong')
}

console.log('ALL SWAP SOUND CHECKS PASSED')
