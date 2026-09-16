/**
 * Walk length picker / sticky N / dice N smoke.
 * Run: npx --yes tsx src/engine/walk-length-smoke.test.ts
 * Or:  npm run test:walk-length
 */
import assert from 'node:assert/strict'

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

const { useJamStore } = await import('../store/jam-store.ts')
const { useSessionStore } = await import('../store/session-store.ts')
const { applyKit, setWalkLength, rollSongHarmony, reshuffleUnlocked } = await import(
  './jam-actions.ts'
)
const { rollSeed } = await import('./song-seed.ts')
type WalkLength = 1 | 2 | 3 | 4
const { KITS } = await import('./kits.ts')
const { isMelodicRole } = await import('./note-harmony.ts')

console.log('=== Walk length smoke ===')

{
  const kit =
    KITS.find((k) => k.tracks.some((t) => t.role === 'drums') && k.tracks.some((t) => t.role === 'bass')) ??
    KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit')

  // Force a known length-4 walk
  const jam0 = useJamStore.getState()
  jam0.setSongSeed(
    rollSeed({
      root: jam0.songRoot,
      scale: jam0.songScale,
      walkLength: 4,
      vibe: kit.vibe,
    }),
  )
  assert.equal(useJamStore.getState().songSeed!.walk.length, 4)

  const session = useSessionStore.getState()
  const drums = session.tracks.filter((t) => t.role === 'drums')
  assert.ok(drums.length >= 1, 'need drums track')
  const drumsBefore = Object.fromEntries(drums.map((t) => [t.id, t.code]))
  const melodicBefore = Object.fromEntries(
    session.tracks.filter((t) => isMelodicRole(t.role)).map((t) => [t.id, t.code]),
  )

  const r2 = setWalkLength(2)
  assert.equal(r2.ok, true)
  if (!r2.ok) throw new Error(r2.error)
  assert.equal(r2.walkLength, 2)
  assert.equal(useJamStore.getState().songSeed!.walk.length, 2)
  assert.ok(!String(r2.patternId).includes('cat'), 'pattern id not cat')

  const after = useSessionStore.getState()
  for (const t of after.tracks.filter((x) => x.role === 'drums')) {
    assert.equal(t.code, drumsBefore[t.id], `drums ${t.id} must be unchanged`)
  }
  for (const t of after.tracks.filter((x) => isMelodicRole(x.role) && !x.locked)) {
    assert.ok(t.code.includes('note(') || t.code.includes('s('), `melodic ${t.id} still code`)
    assert.ok(!t.code.includes('cat('), `no cat() on ${t.id}`)
  }
  // At least one unlocked melodic lane changed (reshuffled to new walk)
  const melodicChanged = after.tracks.some(
    (t) => isMelodicRole(t.role) && !t.locked && melodicBefore[t.id] !== t.code,
  )
  assert.ok(melodicChanged, 'expected unlocked melodic reshuffle')
  console.log(`  setWalkLength 4→2 pattern=${r2.patternId}; drums pinned; melodic reshuffled`)

  const same = setWalkLength(2)
  assert.equal(same.ok, true)
  assert.equal(useJamStore.getState().songSeed!.walk.length, 2)
  console.log('  setWalkLength no-op same N: ok')

  const nBefore = useJamStore.getState().songSeed!.walk.length
  reshuffleUnlocked()
  assert.equal(useJamStore.getState().songSeed!.walk.length, nBefore, 'Shuffle sticky N')
  console.log(`  reshuffleUnlocked sticky N=${nBefore}: ok`)

  // Dice: new N (prefer avoid current)
  let changed = 0
  for (let i = 0; i < 16; i++) {
    const jam = useJamStore.getState()
    const cur = 2 as WalkLength
    jam.setSongSeed(rollSeed({ root: 'c', scale: 'minor', walkLength: cur }))
    jam.setSongRoot('c')
    jam.setSongScale('minor')
    const dice = rollSongHarmony()
    assert.ok(dice.walkLength >= 1 && dice.walkLength <= 4)
    if (dice.walkLength !== cur) changed++
  }
  assert.ok(changed >= 10, `dice usually changes N (changed=${changed}/16)`)
  console.log(`  rollSongHarmony new N (changed ${changed}/16): ok`)

  // applyKit pins existing N
  useJamStore.getState().setSongSeed(rollSeed({ root: 'd', scale: 'dorian', walkLength: 3 }))
  const again = applyKit(kit.id)
  assert.equal(again.ok, true)
  assert.equal(useJamStore.getState().songSeed!.walk.length, 3, 'applyKit pins N')
  console.log('  applyKit pins N=3: ok')
}

console.log('ALL WALK-LENGTH CHECKS PASSED')
