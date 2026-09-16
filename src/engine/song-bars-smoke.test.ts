/**
 * Smoke: song bar length tile/trim + header + setSongBarsLength.
 * Run: npx --yes tsx src/engine/song-bars-smoke.test.ts
 * Or:  npm run test:song-bars
 */
import assert from 'node:assert/strict'
import {
  clampSongBars,
  fitCodeToSongBars,
  splitSongBarParts,
  songBarIndex,
  joinSongBarParts,
} from './song-bars'
import { formatJamHeader, parseJamHeader } from './all-code'

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

console.log('=== song-bars smoke ===')

{
  assert.equal(clampSongBars(1), 1)
  assert.equal(clampSongBars(2), 2)
  assert.equal(clampSongBars(4), 4)
  assert.equal(clampSongBars(3), 1)
  assert.equal(clampSongBars('4'), 4)
  assert.equal(clampSongBars(undefined), 1)
  assert.equal(songBarIndex(0, 4), 1)
  assert.equal(songBarIndex(3, 4), 4)
  assert.equal(songBarIndex(4, 4), 1)
  console.log('  clamp + barIndex ok')
}

{
  const one = 's("bd sd hh cp").bank("RolandTR909")'
  assert.deepEqual(splitSongBarParts(one), [one])
  const two = fitCodeToSongBars(one, 2)
  assert.equal(two, `cat(${one}, ${one})`)
  const four = fitCodeToSongBars(one, 4)
  assert.equal(splitSongBarParts(four).length, 4)
  assert.equal(fitCodeToSongBars(four, 2), `cat(${one}, ${one})`)
  assert.equal(fitCodeToSongBars(four, 1), one)
  const ab = joinSongBarParts(['s("bd")', 's("sd")'])
  assert.equal(ab, 'cat(s("bd"), s("sd"))')
  assert.equal(fitCodeToSongBars(ab, 4), 'cat(s("bd"), s("sd"), s("bd"), s("sd"))')
  console.log('  locked tile/trim ok')
}

{
  const line = formatJamHeader({
    kitId: 'techno-punch909',
    kitName: 'Punch 909',
    root: 'c',
    scale: 'minor',
    bpm: 128,
    bars: 4,
  })
  assert.equal(
    line,
    '// @jam kit=techno-punch909 name="Punch 909" root=c scale=minor bpm=128 bars=4',
  )
  assert.deepEqual(parseJamHeader(line), {
    kitId: 'techno-punch909',
    kitName: 'Punch 909',
    root: 'c',
    scale: 'minor',
    bpm: 128,
    bars: 4,
  })
  const legacy = parseJamHeader(
    '// @jam kit=techno-punch909 name="Punch 909" root=c scale=minor bpm=128',
  )
  assert.equal(legacy?.bars, undefined, 'missing bars= leaves field absent')
  const def = formatJamHeader({
    kitId: 'x',
    kitName: 'Y',
    root: 'c',
    scale: 'minor',
    bpm: 120,
  })
  assert.match(def, /bars=1/)
  console.log('  jam header bars roundtrip ok')
}

installLocalStorage()

const { useSessionStore } = await import('../store/session-store.ts')
const { useJamStore } = await import('../store/jam-store.ts')
const { setSongBarsLength } = await import('./jam-actions.ts')

{
  assert.equal(useJamStore.getState().songBars, 1, 'default songBars is 1')
  const session = useSessionStore.getState()
  // clear leftover tracks from other smokes in same process if any
  for (const t of [...session.tracks]) session.removeTrack(t.id)

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
  useJamStore.getState().setIntensityLevel(3)

  const r = setSongBarsLength(4)
  assert.equal(r.ok, true)
  assert.equal(r.bars, 4)
  assert.equal(useJamStore.getState().songBars, 4)
  assert.equal(useJamStore.getState().intensityLevel, 1, 'bars change resets intensity')
  const after = useSessionStore.getState()
  const kick = after.tracks.find((t) => t.id === kickId)!
  assert.equal(splitSongBarParts(kick.code).length, 4, 'locked tiled to 4')
  assert.ok(kick.code.includes('bd sd hh cp'), 'locked keeps snippet')
  const bass = after.tracks.find((t) => t.id === bassId)!
  assert.notEqual(bass.code, unlockedCode, 'unlocked regenerated')
  assert.equal(splitSongBarParts(bass.code).length, 4, 'unlocked fitted to 4')

  const short = setSongBarsLength(2)
  assert.equal(short.bars, 2)
  const kick2 = useSessionStore.getState().tracks.find((t) => t.id === kickId)!
  assert.equal(splitSongBarParts(kick2.code).length, 2, 'locked trimmed to 2')
  // first cell preserved from prior 4-bar tile of the same snippet
  assert.equal(splitSongBarParts(kick2.code)[0], lockedCode)

  const back = setSongBarsLength(1)
  assert.equal(back.bars, 1)
  const kick1 = useSessionStore.getState().tracks.find((t) => t.id === kickId)!
  assert.equal(kick1.code, lockedCode, 'locked back to single cell')
  console.log('  setSongBarsLength locked tile + unlocked regen + intensity reset ok')
}

console.log('song-bars-smoke.test.ts: ok')
