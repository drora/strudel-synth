/**
 * Walk length picker / Shuffle avoid-N / dice N / applyKit unpinned smoke.
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

  // Shuffle from N=2 (set above): avoid current → 3 or 4
  {
    const jam = useJamStore.getState()
    jam.setSongSeed(rollSeed({ root: jam.songRoot, scale: jam.songScale, walkLength: 3, vibe: kit.vibe }))
    assert.equal(useJamStore.getState().songSeed!.walk.length, 3)
    reshuffleUnlocked()
    const after3 = useJamStore.getState().songSeed!.walk.length
    assert.ok(after3 === 2 || after3 === 4, `Shuffle from 3 → 2|4 got ${after3}`)
    console.log(`  reshuffleUnlocked from 3 → ${after3}: ok`)
  }
  // Shuffle from N=1 (user hold): stays 1
  {
    const hold = setWalkLength(1)
    assert.equal(hold.ok, true)
    assert.equal(useJamStore.getState().songSeed!.walk.length, 1)
    reshuffleUnlocked()
    assert.equal(useJamStore.getState().songSeed!.walk.length, 1, 'Shuffle keeps hold 1')
    console.log('  reshuffleUnlocked from 1 stays 1: ok')
    // restore to 2 for later dice tests
    setWalkLength(2)
  }

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

  // applyKit does NOT pin N — over several rolls, not all stay 3
  {
    const lengths = new Set<number>()
    for (let i = 0; i < 24; i++) {
      useJamStore.getState().setSongSeed(rollSeed({ root: 'd', scale: 'dorian', walkLength: 3 }))
      assert.equal(useJamStore.getState().songSeed!.walk.length, 3)
      const again = applyKit(kit.id)
      assert.equal(again.ok, true)
      const n = useJamStore.getState().songSeed!.walk.length
      assert.ok(n === 2 || n === 3 || n === 4, `applyKit length ${n}`)
      assert.notEqual(n, 1, 'applyKit never 1')
      lengths.add(n)
    }
    assert.ok(lengths.size >= 2, `applyKit not pinned to 3 (seen=${[...lengths]})`)
    console.log(`  applyKit unpinned (seen ${[...lengths].sort()}): ok`)
  }

  // Display: walk stepper shows {walkN} only — no /4
  {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'src/components/jam/JamShell.tsx'), 'utf8')
    assert.ok(src.includes('{walkN}'), 'JamShell shows {walkN}')
    assert.ok(!src.includes('{walkN}/4'), 'JamShell must not show walkN/4')
    console.log('  display {walkN} only (no /4): ok')
  }
}

console.log('ALL WALK-LENGTH CHECKS PASSED')
