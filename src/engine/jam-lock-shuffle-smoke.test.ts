/**
 * Per-track Lock vs Shuffle: song Shuffle + Mix/Code Shuffle this.
 * Run: npx --yes tsx src/engine/jam-lock-shuffle-smoke.test.ts
 * Or:  npm run test:jam-lock
 */
import assert from 'node:assert/strict'
import { isTrackShuffleLocked, planShuffleTargets } from './shuffle-lock'
import type { Track } from './types'

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

function track(partial: Partial<Track> & Pick<Track, 'id' | 'name' | 'role' | 'code'>): Track {
  return {
    color: '#fff',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
    ...partial,
  }
}

console.log('=== Jam lock shuffle smoke ===')

{
  const locked = track({
    id: 'kick',
    name: 'Kick',
    role: 'drums',
    code: 's("bd sd").bank("RolandTR909")',
    locked: true,
  })
  const open = track({
    id: 'bass',
    name: 'Bass',
    role: 'bass',
    code: 'note("c3").sound("sawtooth")',
  })
  assert.equal(isTrackShuffleLocked(locked), true)
  assert.equal(isTrackShuffleLocked(open), false)
  const song = planShuffleTargets([locked, open])
  assert.equal(song.ok, true)
  if (song.ok) assert.deepEqual(song.targets.map((t) => t.id), ['bass'])
  const mixOrCode = planShuffleTargets([locked, open], 'kick')
  assert.equal(mixOrCode.ok, false)
  if (!mixOrCode.ok) assert.match(mixOrCode.error, /locked/i)
  console.log('  planShuffleTargets: Mix/Code skip locked; song skips locked')
}

installLocalStorage()

const { useSessionStore } = await import('../store/session-store.ts')
const { reshuffleUnlocked, reshuffleTrackById } = await import('./jam-actions.ts')

{
  const session = useSessionStore.getState()
  const lockedCode = 's("bd sd hh cp").bank("RolandTR909").gain(1.05)'
  const unlockedCode = 'note("c3 eb3 g3").sound("sawtooth").gain(0.5)'
  const kickId = session.addTrack({
    name: 'Kick',
    role: 'drums',
    code: lockedCode,
    color: '#ff8c42',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  })
  const bassId = session.addTrack({
    name: 'Bass',
    role: 'bass',
    code: unlockedCode,
    color: '#00e5ff',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  })
  session.toggleLock(kickId)
  assert.equal(useSessionStore.getState().tracks.find((t) => t.id === kickId)?.locked, true)

  const song = reshuffleUnlocked()
  assert.equal(song.ok, true)
  assert.ok(song.shuffled >= 1, 'song shuffle still hits unlocked lanes')
  const afterSong = useSessionStore.getState()
  assert.equal(
    afterSong.tracks.find((t) => t.id === kickId)?.code,
    lockedCode,
    'reshuffleUnlocked leaves locked code unchanged',
  )
  const bassAfterSong = afterSong.tracks.find((t) => t.id === bassId)?.code
  assert.ok(bassAfterSong)
  assert.notEqual(bassAfterSong, unlockedCode, 'reshuffleUnlocked still changes unlocked')

  const lockedHit = reshuffleTrackById(kickId)
  assert.equal(lockedHit.ok, false)
  if (!lockedHit.ok) assert.match(lockedHit.error, /locked/i)
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === kickId)?.code,
    lockedCode,
    'reshuffleTrackById (Mix/Code Shuffle) no-ops locked',
  )

  const beforeBass = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
  let changed = false
  for (let i = 0; i < 8; i++) {
    const r = reshuffleTrackById(bassId)
    assert.equal(r.ok, true)
    const now = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code
    if (now !== beforeBass) {
      changed = true
      break
    }
  }
  assert.equal(changed, true, 'reshuffleTrackById still changes unlocked')
  console.log('  reshuffleUnlocked + reshuffleTrackById: locked pinned, unlocked changes')
}

console.log('ALL LOCK SHUFFLE CHECKS PASSED')
