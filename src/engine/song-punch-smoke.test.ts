/**
 * New kit / Shuffle / Dice defer to walk-loop end while playing.
 * Stopped stays immediate. A/B queue is separate.
 * Run: npx --yes tsx src/engine/song-punch-smoke.test.ts
 */
import assert from 'node:assert/strict'
import { liveUpdateEngine } from './live-update'
import {
  cancelSongAtLoopEnd,
  hasPendingSongAtLoopEnd,
  __songPunchPollOnceForTest,
} from './song-punch'

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

installLocalStorage()

const rafQueue: FrameRequestCallback[] = []
;(globalThis as typeof globalThis & { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame =
  ((cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  }) as typeof requestAnimationFrame
;(globalThis as typeof globalThis & { cancelAnimationFrame: typeof cancelAnimationFrame }).cancelAnimationFrame =
  ((_id: number) => {}) as typeof cancelAnimationFrame

const { useSessionStore } = await import('../store/session-store')
const { useJamStore } = await import('../store/jam-store')
const { useUIStore } = await import('../store/ui-store')
const { applyKit, reshuffleUnlocked, rollSongHarmony } = await import('./jam-actions')
const { KITS } = await import('./kits')
const { rollSeed } = await import('./song-seed')

console.log('=== song punch loop-end smoke ===')

const kitA = KITS[0]!
const kitB = KITS.find((k) => k.id !== kitA.id)!
assert.ok(kitA && kitB && kitA.id !== kitB.id)

const quants: string[] = []
const eng = liveUpdateEngine as unknown as {
  queueUpdate: (q: string, reason?: string) => void
  getCurrentCycle: () => number
}
const origQueue = eng.queueUpdate.bind(liveUpdateEngine)
const origCycle = eng.getCurrentCycle.bind(liveUpdateEngine)
eng.queueUpdate = (q: string) => {
  quants.push(q)
}
let fakeCycle = 0
eng.getCurrentCycle = () => fakeCycle

function resetJam() {
  cancelSongAtLoopEnd()
  useJamStore.getState().cancelPendingSong()
  useJamStore.getState().cancelPendingAb()
  quants.length = 0
  fakeCycle = 5.3
  useUIStore.setState({ defaultQuantization: '4', trackQuantization: {} })
  useSessionStore.setState({
    tracks: [],
    bpm: 100,
    isPlaying: false,
    activeTrackId: null,
    pausedCycle: null,
  })
  useJamStore.setState({
    kitId: null,
    hasPickedKit: true,
    showKitPicker: true,
    pendingSong: null,
    pendingVariant: null,
    songRoot: 'c',
    songScale: 'minor',
    songSeed: rollSeed({ root: 'c', scale: 'minor', walkLength: 4 }),
    intensityLevel: 1,
    intensitySnaps: {},
    songTimeFeel: 'normal',
    songTimeFeelBase: null,
    lastPeek: null,
  })
}

{
  resetJam()
  const r = applyKit(kitB.id, { deferToLoopEnd: true, fromPicker: true })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.queued, undefined)
  assert.equal(useJamStore.getState().kitId, kitB.id, 'stopped new kit immediate')
  assert.equal(useJamStore.getState().pendingSong, null)
  assert.equal(hasPendingSongAtLoopEnd(), false)
  assert.equal(useSessionStore.getState().bpm, kitB.bpm, 'stopped adopts kit bpm')
  assert.match(useJamStore.getState().lastPeek ?? '', /^kit · /)
  assert.equal(quants.length, 0, 'stopped does not queue audio')
  console.log('  stopped kit immediate: ok')
}

{
  resetJam()
  applyKit(kitA.id)
  assert.equal(useJamStore.getState().kitId, kitA.id)
  const codes = useSessionStore.getState().tracks.map((t) => t.code).join('\n')
  const seed = useJamStore.getState().songSeed
  const bpm = useSessionStore.getState().bpm
  useJamStore.setState({
    songSeed: rollSeed({ root: useJamStore.getState().songRoot, scale: useJamStore.getState().songScale, walkLength: 4 }),
    intensityLevel: 3,
    showKitPicker: true,
  })
  // codes unchanged by setState
  useSessionStore.getState().setPlaying(true)
  fakeCycle = 5.3
  quants.length = 0
  const r = applyKit(kitB.id, { deferToLoopEnd: true, fromPicker: true })
  assert.equal(r.ok && r.queued, true)
  assert.equal(useJamStore.getState().kitId, kitA.id, 'kit not applied yet')
  assert.equal(useSessionStore.getState().tracks.map((t) => t.code).join('\n'), codes)
  assert.equal(useSessionStore.getState().bpm, bpm, 'bpm unchanged while queued')
  assert.equal(useJamStore.getState().intensityLevel, 3, 'intensity untouched until apply')
  assert.equal(useJamStore.getState().pendingSong?.kind, 'kit')
  assert.equal(useJamStore.getState().pendingSong?.kind === 'kit' && useJamStore.getState().pendingSong?.kitId, kitB.id)
  assert.equal(useJamStore.getState().lastPeek, `Kit · ${kitB.name} at loop end`)
  assert.equal(useJamStore.getState().showKitPicker, false, 'picker closes when queued')
  assert.equal(hasPendingSongAtLoopEnd(), true)
  __songPunchPollOnceForTest()
  assert.equal(useJamStore.getState().kitId, kitA.id, 'mid-phrase no fire')
  fakeCycle = 7.5
  __songPunchPollOnceForTest()
  assert.equal(useJamStore.getState().kitId, kitA.id)
  fakeCycle = 8.02
  __songPunchPollOnceForTest()
  assert.equal(useJamStore.getState().kitId, kitB.id, 'kit fires at walk loop end')
  assert.equal(useJamStore.getState().pendingSong, null)
  assert.equal(hasPendingSongAtLoopEnd(), false)
  assert.equal(useJamStore.getState().intensityLevel, 1, 'real apply still resets intensity')
  assert.equal(useSessionStore.getState().bpm, bpm, 'playing apply preserves bpm')
  assert.deepEqual(quants, ['immediate'], 'audio is immediate at loop end, not Update quant')
  assert.notEqual(seed?.patternId, 'unused')
  console.log('  playing new kit defers to walk-4 boundary: ok')
}

{
  resetJam()
  applyKit(kitA.id)
  useJamStore.setState({
    songSeed: rollSeed({
      root: useJamStore.getState().songRoot,
      scale: useJamStore.getState().songScale,
      walkLength: 4,
    }),
  })
  const seedId = useJamStore.getState().songSeed?.patternId
  const root = useJamStore.getState().songRoot
  const codes = useSessionStore.getState().tracks.map((t) => t.code).join('\n')
  useSessionStore.getState().setPlaying(true)
  fakeCycle = 5.3
  quants.length = 0
  const r = reshuffleUnlocked({ deferToLoopEnd: true })
  assert.equal(r.queued, true)
  assert.equal(useJamStore.getState().pendingSong?.kind, 'shuffle')
  assert.equal(useJamStore.getState().lastPeek, 'Shuffle · at loop end')
  assert.equal(useJamStore.getState().songSeed?.patternId, seedId)
  assert.equal(useSessionStore.getState().tracks.map((t) => t.code).join('\n'), codes)
  fakeCycle = 8.02
  __songPunchPollOnceForTest()
  assert.equal(useJamStore.getState().pendingSong, null)
  assert.equal(useJamStore.getState().songRoot, root, 'shuffle keeps root')
  assert.notEqual(useJamStore.getState().songSeed?.patternId, seedId, 'shuffle rolls a new walk at the boundary')
  assert.deepEqual(quants, ['immediate'])
  console.log('  playing shuffle defers to walk-4 boundary: ok')
}

{
  resetJam()
  applyKit(kitA.id)
  useJamStore.setState({
    songRoot: 'c',
    songScale: 'minor',
    songSeed: rollSeed({ root: 'c', scale: 'minor', walkLength: 4 }),
  })
  const root = useJamStore.getState().songRoot
  const scale = useJamStore.getState().songScale
  useSessionStore.getState().setPlaying(true)
  fakeCycle = 5.3
  quants.length = 0
  const r = rollSongHarmony({ deferToLoopEnd: true })
  assert.equal(r.queued, true)
  assert.equal(r.root, root, 'queued dice reports current key')
  assert.equal(useJamStore.getState().songRoot, root)
  assert.equal(useJamStore.getState().songScale, scale)
  assert.equal(useJamStore.getState().pendingSong?.kind, 'dice')
  assert.equal(useJamStore.getState().lastPeek, 'Dice · at loop end')
  fakeCycle = 8.02
  __songPunchPollOnceForTest()
  assert.notEqual(useJamStore.getState().songRoot, root, 'dice re-rolls root at loop end')
  assert.notEqual(useJamStore.getState().songScale, scale, 'dice re-rolls scale at loop end')
  assert.equal(useJamStore.getState().pendingSong, null)
  assert.deepEqual(quants, ['immediate'])
  console.log('  playing dice defers to walk-4 boundary: ok')
}

{
  resetJam()
  applyKit(kitA.id)
  useJamStore.setState({
    songSeed: rollSeed({
      root: useJamStore.getState().songRoot,
      scale: useJamStore.getState().songScale,
      walkLength: 4,
    }),
  })
  useSessionStore.getState().setPlaying(true)
  fakeCycle = 2.2
  applyKit(kitB.id, { deferToLoopEnd: true })
  assert.equal(useJamStore.getState().kitId, kitA.id)
  useSessionStore.getState().setPlaying(false)
  quants.length = 0
  useJamStore.getState().flushPendingSong()
  assert.equal(useJamStore.getState().kitId, kitB.id, 'flush applies kit on stop')
  assert.equal(useJamStore.getState().pendingSong, null)
  assert.equal(quants.length, 0, 'flush while stopped does not queue audio')
  assert.equal(useSessionStore.getState().bpm, kitB.bpm, 'flushed while stopped adopts kit bpm')
  console.log('  flushPendingSong on stop: ok')
}

{
  resetJam()
  applyKit(kitA.id)
  const kit = useJamStore.getState().kitId
  useJamStore.setState({
    songSeed: rollSeed({
      root: useJamStore.getState().songRoot,
      scale: useJamStore.getState().songScale,
      walkLength: 4,
    }),
  })
  useSessionStore.getState().setPlaying(true)
  fakeCycle = 5.1
  applyKit(kitB.id, { deferToLoopEnd: true })
  assert.equal(useJamStore.getState().pendingSong?.kind, 'kit')
  reshuffleUnlocked({ deferToLoopEnd: true })
  assert.equal(useJamStore.getState().pendingSong?.kind, 'shuffle', 'later action replaces queue')
  assert.equal(useJamStore.getState().kitId, kit)
  fakeCycle = 8.02
  __songPunchPollOnceForTest()
  assert.equal(useJamStore.getState().kitId, kit, 'replaced kit queue does not apply')
  assert.equal(useJamStore.getState().pendingSong, null)
  console.log('  later song action replaces pending: ok')
}

{
  resetJam()
  applyKit(kitA.id)
  useSessionStore.getState().setPlaying(true)
  fakeCycle = 3.2
  quants.length = 0
  useUIStore.setState({ defaultQuantization: '4' })
  const r = applyKit(kitB.id)
  assert.equal(r.ok && r.queued, undefined)
  assert.equal(useJamStore.getState().kitId, kitB.id, 'bare applyKit while playing stays immediate')
  assert.equal(useJamStore.getState().pendingSong, null)
  assert.equal(hasPendingSongAtLoopEnd(), false)
  assert.deepEqual(quants, ['4'], 'bare apply still uses Update quant')
  console.log('  bare applyKit while playing unchanged: ok')
}

eng.queueUpdate = origQueue
eng.getCurrentCycle = origCycle
useSessionStore.getState().setPlaying(false)
cancelSongAtLoopEnd()

console.log('ALL SONG PUNCH LOOP-END CHECKS PASSED')
