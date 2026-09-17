/**
 * Song Half/Double-time once-only (songTimeFeel ternary).
 * Run: npx --yes tsx src/engine/song-time-feel-smoke.test.ts
 */
import assert from 'node:assert/strict'
import { transformDoubleTime, transformHalfTime } from './mutate'

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

console.log('=== Song time feel smoke ===')

{
  const toks = ['bd', 'sd', 'hh', 'oh']
  const half = transformHalfTime(toks)
  assert.deepEqual(half, ['bd', '~', 'sd', '~', 'hh', '~', 'oh', '~'])
  assert.deepEqual(transformDoubleTime(half), toks, 'double undoes half (hit/~ pairs)')
  console.log('  transform: half↔double inverse on hit/~: ok')
}

installLocalStorage()

const { useSessionStore } = await import('../store/session-store.ts')
const { useJamStore } = await import('../store/jam-store.ts')
const { applyKit, applyMutate, stashAb, punchAb } = await import('./jam-actions.ts')
const { KITS } = await import('./kits.ts')

function resetKit() {
  const kit = KITS.find((k) => k.tracks.some((t) => t.role === 'drums')) ?? KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit')
  useJamStore.getState().resetSongTimeFeel()
  return kit
}

{
  resetKit()
  const jam = useJamStore.getState()
  assert.equal(jam.songTimeFeel, 'normal')

  const codes0 = Object.fromEntries(useSessionStore.getState().tracks.map((t) => [t.id, t.code]))

  const h1 = applyMutate('half-time')
  assert.equal(h1.ok, true)
  assert.equal(useJamStore.getState().songTimeFeel, 'half')
  assert.ok((useJamStore.getState().songTimeFeelBase?.length ?? 0) > 0, 'base snap after half')

  const h2 = applyMutate('half-time')
  assert.equal(h2.ok, true)
  assert.equal(h2.changed, 0, 'second half-time no-op')
  assert.equal(useJamStore.getState().songTimeFeel, 'half')

  const d1 = applyMutate('double-time')
  assert.equal(d1.ok, true)
  assert.equal(useJamStore.getState().songTimeFeel, 'normal', 'double from half → normal')
  assert.equal(useJamStore.getState().songTimeFeelBase, null)
  for (const tr of useSessionStore.getState().tracks) {
    if (tr.locked) continue
    if (codes0[tr.id] != null) {
      assert.equal(tr.code, codes0[tr.id], `restore base for ${tr.id}`)
    }
  }
  console.log('  half then half no-op; half then double → normal: ok')
}

{
  resetKit()
  const codes0 = Object.fromEntries(useSessionStore.getState().tracks.map((t) => [t.id, t.code]))

  const d1 = applyMutate('double-time')
  assert.equal(d1.ok, true)
  assert.equal(useJamStore.getState().songTimeFeel, 'double')

  const d2 = applyMutate('double-time')
  assert.equal(d2.ok, true)
  assert.equal(d2.changed, 0, 'second double-time no-op')

  const h1 = applyMutate('half-time')
  assert.equal(h1.ok, true)
  assert.equal(useJamStore.getState().songTimeFeel, 'normal', 'half from double → normal')
  for (const tr of useSessionStore.getState().tracks) {
    if (tr.locked) continue
    if (codes0[tr.id] != null) {
      assert.equal(tr.code, codes0[tr.id], `restore base for ${tr.id}`)
    }
  }
  console.log('  double then double no-op; double then half → normal: ok')
}

{
  resetKit()
  useJamStore.getState().resetSongTimeFeel()
  assert.equal(applyMutate('half-time').ok, true)
  assert.equal(useJamStore.getState().songTimeFeel, 'half')
  stashAb('a')

  assert.equal(applyMutate('double-time').ok, true) // → normal
  assert.equal(applyMutate('double-time').ok, true) // → double
  assert.equal(useJamStore.getState().songTimeFeel, 'double')
  stashAb('b')

  punchAb('a')
  assert.equal(useJamStore.getState().songTimeFeel, 'half', 'A/B punch restores songTimeFeel')
  punchAb('b')
  assert.equal(useJamStore.getState().songTimeFeel, 'double')
  console.log('  A/B persists songTimeFeel: ok')
}

console.log('ALL SONG TIME FEEL CHECKS PASSED')
