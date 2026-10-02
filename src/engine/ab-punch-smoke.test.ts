/**
 * A/B punch defers to walk-loop end while playing.
 * Run: npx --yes tsx src/engine/ab-punch-smoke.test.ts
 */
import assert from 'node:assert/strict'
import {
  cancelAbAtLoopEnd,
  hasPendingAbAtLoopEnd,
  shouldFireAbBoundary,
  walkLoopCycles,
  __abPunchPollOnceForTest,
} from './ab-punch'
import { liveUpdateEngine } from './live-update'

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

// Stub RAF so queue doesn't spin — tests drive __abPunchPollOnceForTest.
const rafQueue: FrameRequestCallback[] = []
;(globalThis as typeof globalThis & { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame =
  ((cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  }) as typeof requestAnimationFrame
;(globalThis as typeof globalThis & { cancelAnimationFrame: typeof cancelAnimationFrame }).cancelAnimationFrame =
  ((_id: number) => {
    /* no-op — polls are driven manually */
  }) as typeof cancelAnimationFrame

const { useSessionStore } = await import('../store/session-store')
const { useJamStore } = await import('../store/jam-store')
const { rollSeed } = await import('./song-seed')

console.log('=== A/B punch loop-end smoke ===')

{
  assert.equal(walkLoopCycles(undefined), 1)
  assert.equal(walkLoopCycles(4), 4)
  assert.equal(walkLoopCycles(3), 3)
  assert.equal(walkLoopCycles(99), 4)
  assert.equal(walkLoopCycles(0), 1)
  console.log('  walkLoopCycles clamp: ok')
}

{
  // Mid walk-4 phrase: no fire until cycle 8
  let r = shouldFireAbBoundary(4.5, 4, 4)
  assert.equal(r.fire, false)
  r = shouldFireAbBoundary(7.9, 7, 4)
  assert.equal(r.fire, false)
  r = shouldFireAbBoundary(8.02, 7, 4)
  assert.equal(r.fire, true, 'cross into 8 (walk-4 boundary)')
  // Walk 1: every new integer near boundary
  r = shouldFireAbBoundary(3.02, 2, 1)
  assert.equal(r.fire, true)
  // Same cycleInt — no cross
  r = shouldFireAbBoundary(8.02, 8, 4)
  assert.equal(r.fire, false)
  console.log('  shouldFireAbBoundary: ok')
}

function resetTracks() {
  cancelAbAtLoopEnd()
  useJamStore.getState().cancelPendingAb()
  useSessionStore.setState({
    tracks: [
      {
        id: 't1',
        name: 'Kick',
        role: 'drums',
        code: 's("bd")',
        color: '#ff8c42',
        muted: false,
        soloed: false,
        volume: 0.8,
        locked: false,
        octave: 0,
        error: null,
      },
    ],
    bpm: 120,
    isPlaying: false,
    activeTrackId: 't1',
    pausedCycle: null,
  })
  useJamStore.setState({
    variantA: null,
    variantB: null,
    activeVariant: null,
    pendingVariant: null,
    songRoot: 'c',
    songScale: 'minor',
    songSeed: rollSeed({ root: 'c', scale: 'minor', walkLength: 4 }),
    songTimeFeel: 'normal',
    songTimeFeelBase: null,
  })
}

{
  resetTracks()
  const jam = useJamStore.getState()
  jam.stashVariant('a')
  useSessionStore.getState().setCode('t1', 's("sd")')
  jam.stashVariant('b')
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("sd")')

  // Stopped: punch applies immediately
  jam.punchVariant('a')
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("bd")', 'stopped punch A immediate')
  assert.equal(useJamStore.getState().activeVariant, 'a')
  assert.equal(useJamStore.getState().pendingVariant, null)
  assert.equal(hasPendingAbAtLoopEnd(), false)
  console.log('  stopped punch immediate: ok')
}

{
  resetTracks()
  const jam = useJamStore.getState()
  jam.stashVariant('a')
  useSessionStore.getState().setCode('t1', 's("sd")')
  jam.stashVariant('b')

  useSessionStore.getState().setPlaying(true)
  // Fake cycle mid walk-4 phrase
  const eng = liveUpdateEngine as unknown as { getCurrentCycle: () => number }
  const orig = eng.getCurrentCycle.bind(liveUpdateEngine)
  let fakeCycle = 5.3
  eng.getCurrentCycle = () => fakeCycle

  jam.punchVariant('a')
  assert.equal(useJamStore.getState().pendingVariant, 'a', 'pending while playing')
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("sd")', 'store not swapped yet')
  assert.equal(useJamStore.getState().activeVariant, 'b', 'active stays B until fire')
  assert.ok(hasPendingAbAtLoopEnd())

  // Mid-phrase poll — no fire
  __abPunchPollOnceForTest()
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("sd")')

  // Advance toward end of walk (cycles 4..7 → boundary at 8)
  fakeCycle = 7.5
  __abPunchPollOnceForTest()
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("sd")', 'still waiting at 7.5')

  fakeCycle = 8.02
  __abPunchPollOnceForTest()
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("bd")', 'fires at walk loop end')
  assert.equal(useJamStore.getState().activeVariant, 'a')
  assert.equal(useJamStore.getState().pendingVariant, null)
  assert.equal(hasPendingAbAtLoopEnd(), false)

  eng.getCurrentCycle = orig
  useSessionStore.getState().setPlaying(false)
  cancelAbAtLoopEnd()
  console.log('  playing punch defers to walk-4 boundary: ok')
}

{
  resetTracks()
  const jam = useJamStore.getState()
  jam.stashVariant('a')
  useSessionStore.getState().setCode('t1', 's("hh")')
  jam.stashVariant('b')
  useSessionStore.getState().setPlaying(true)
  const eng = liveUpdateEngine as unknown as { getCurrentCycle: () => number }
  const orig = eng.getCurrentCycle.bind(liveUpdateEngine)
  eng.getCurrentCycle = () => 5.1

  jam.punchVariant('a')
  assert.equal(useJamStore.getState().pendingVariant, 'a')
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("hh")')

  // Pause/stop path: flush applies immediately
  useSessionStore.getState().setPlaying(false)
  jam.flushPendingAb()
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("bd")', 'flush applies on stop')
  assert.equal(useJamStore.getState().pendingVariant, null)

  eng.getCurrentCycle = orig
  console.log('  flushPendingAb on stop: ok')
}

{
  resetTracks()
  const jam = useJamStore.getState()
  jam.stashVariant('a')
  useSessionStore.getState().setCode('t1', 's("cp")')
  jam.stashVariant('b')
  useSessionStore.getState().setPlaying(true)
  const eng = liveUpdateEngine as unknown as { getCurrentCycle: () => number }
  const orig = eng.getCurrentCycle.bind(liveUpdateEngine)
  eng.getCurrentCycle = () => 2.2
  jam.punchVariant('a')
  assert.ok(hasPendingAbAtLoopEnd())
  jam.stashVariant('a') // overwrite stash cancels pending
  assert.equal(hasPendingAbAtLoopEnd(), false)
  assert.equal(useJamStore.getState().pendingVariant, null)
  assert.equal(useSessionStore.getState().tracks[0]!.code, 's("cp")', 'stash does not punch')
  eng.getCurrentCycle = orig
  useSessionStore.getState().setPlaying(false)
  console.log('  stash cancels pending: ok')
}

console.log('ALL A/B PUNCH LOOP-END CHECKS PASSED')
