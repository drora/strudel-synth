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
    KITS.find(
      (k) =>
        k.tracks.some((t) => t.role === 'drums') &&
        k.tracks.some((t) => t.role === 'bass') &&
        k.tracks.some((t) => t.role === 'pad'),
    ) ??
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

  // Dice: N ∈ {2,3,4} never 1; prefer avoid current
  let changed = 0
  for (let i = 0; i < 24; i++) {
    const jam = useJamStore.getState()
    const cur = 3 as WalkLength
    jam.setSongSeed(rollSeed({ root: 'c', scale: 'minor', walkLength: cur }))
    jam.setSongRoot('c')
    jam.setSongScale('minor')
    const dice = rollSongHarmony()
    assert.ok(dice.walkLength === 2 || dice.walkLength === 3 || dice.walkLength === 4)
    assert.notEqual(dice.walkLength, 1, 'dice never picks 1')
    if (dice.walkLength !== cur) changed++
  }
  assert.ok(changed >= 12, `dice usually changes N (changed=${changed}/24)`)
  console.log(`  rollSongHarmony new N (changed ${changed}/24, never 1): ok`)

  // Explicit setWalkLength(1) still works (user stepper −)
  const hold = setWalkLength(1)
  assert.equal(hold.ok, true)
  if (!hold.ok) throw new Error(hold.error)
  assert.equal(hold.walkLength, 1)
  assert.equal(useJamStore.getState().songSeed!.walk.length, 1)
  console.log('  setWalkLength(1) explicit: ok')

  // Dice from length 1 still escapes to 2–4
  {
    const jam = useJamStore.getState()
    jam.setSongSeed(rollSeed({ root: 'c', scale: 'minor', walkLength: 1 }))
    jam.setSongRoot('c')
    jam.setSongScale('minor')
    const dice = rollSongHarmony()
    assert.notEqual(dice.walkLength, 1)
    assert.ok(dice.walkLength >= 2 && dice.walkLength <= 4)
    console.log(`  dice from hold→${dice.walkLength}: ok`)
  }

  // After dice, unlocked pad note("<…>") cell count matches seed walk length
  {
    function noteAngleArity(code: string): number | null {
      const m = code.match(/note\s*\(\s*[`'"]\s*<([^>]+)>/)
      if (!m) return null
      const parts = m[1]!.trim().split(/\s+/).filter(Boolean)
      return parts.length || null
    }
    const jam = useJamStore.getState()
    let matched = 0
    for (let i = 0; i < 12; i++) {
      jam.setSongSeed(rollSeed({ root: 'c', scale: 'minor', walkLength: 3 }))
      jam.setSongRoot('c')
      jam.setSongScale('minor')
      for (const t of useSessionStore.getState().tracks) {
        if (t.role === 'pad' && !t.locked) {
          useSessionStore
            .getState()
            .setCode(t.id, `note("<[c3,eb3,g3] [c3,eb3,g3] [c3,eb3,g3]>").s("sawtooth").gain(0.4)`)
        }
      }
      const dice = rollSongHarmony()
      const N = dice.walkLength
      assert.equal(useJamStore.getState().songSeed!.walk.length, N)
      for (const t of useSessionStore.getState().tracks) {
        if (t.role !== 'pad' || t.locked) continue
        const arity = noteAngleArity(t.code)
        if (arity == null) continue
        assert.equal(
          arity,
          N,
          `after dice walk=${N} pad note() arity=${arity} code=${t.code.slice(0, 100)}`,
        )
        matched++
      }
    }
    assert.ok(matched >= 1, `expected pad note() arity match (matched=${matched})`)
    console.log(`  dice pad arity matches walk (matched ${matched}): ok`)
  }

  // applyKit pins existing N
  useJamStore.getState().setSongSeed(rollSeed({ root: 'd', scale: 'dorian', walkLength: 3 }))
  const again = applyKit(kit.id)
  assert.equal(again.ok, true)
  assert.equal(useJamStore.getState().songSeed!.walk.length, 3, 'applyKit pins N')
  console.log('  applyKit pins N=3: ok')
}

console.log('ALL WALK-LENGTH CHECKS PASSED')
