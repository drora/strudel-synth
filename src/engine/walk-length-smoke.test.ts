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
    // Stretch default: N>=2 melodic uses slowcat (not N-packed into one cycle).
    if (r2.walkLength >= 2) {
      assert.ok(
        t.code.includes('slowcat(') || !t.code.includes('note('),
        `stretch slowcat expected on ${t.id}: ${t.code.slice(0, 120)}`,
      )
    }
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

  
  // Stretch: setWalkLength N=2 vs N=4 — melodic slowcat arity equals N (chord duration equal)
  {
    function slowcatArity(code: string): number | null {
      const m = code.match(/slowcat\((.*)\)\s*(?:\.sound|\.s\b|$)/s)
      if (!m) {
        // N=1 may be a bare note("…")
        return code.includes('note(') ? 1 : null
      }
      // Count top-level note("…") / s("…").note("…") args
      const body = m[1]!
      const notes = body.match(/\bnote\s*\(/g)
      return notes ? notes.length : null
    }
    const kitOk = applyKit(kit.id, { fromPicker: true })
    assert.equal(kitOk.ok, true)
    for (const n of [2, 4] as WalkLength[]) {
      const r = setWalkLength(n)
      assert.equal(r.ok, true)
      assert.equal(useJamStore.getState().songSeed!.walk.length, n)
      let seen = 0
      for (const tr of useSessionStore.getState().tracks) {
        if (!isMelodicRole(tr.role) || tr.locked) continue
        if (!tr.code.includes('note(')) continue
        const arity = slowcatArity(tr.code)
        if (arity == null) continue
        assert.equal(
          arity,
          n,
          `walk=${n} ${tr.role} slowcat arity=${arity} code=${tr.code.slice(0, 140)}`,
        )
        seen++
      }
      assert.ok(seen >= 1, `expected melodic stretch arity for N=${n}`)
    }
    console.log('  stretch slowcat arity N=2 vs N=4: ok')
  }

  // Densify walk 1→2; second densify no-op; undensify 2→1; drums untouched
  {
    const { setWalkDensity, applyMutate } = await import('./jam-actions.ts')
    setWalkLength(3)
    useJamStore.getState().setWalkDensity(1)
    const drumsBefore = Object.fromEntries(
      useSessionStore.getState().tracks.filter((x) => x.role === 'drums').map((x) => [x.id, x.code]),
    )
    const d1 = setWalkDensity(2)
    assert.equal(d1.ok, true)
    assert.equal(d1.noop, false)
    assert.equal(useJamStore.getState().walkDensity, 2)
    const d2 = setWalkDensity(2)
    assert.equal(d2.ok, true)
    assert.equal(d2.noop, true, 'second densify is no-op')
    for (const tr of useSessionStore.getState().tracks) {
      if (tr.role !== 'drums') continue
      assert.equal(tr.code, drumsBefore[tr.id], 'densify skips drums')
    }
    // Mutate path
    const u = applyMutate('undensify-walk')
    assert.equal(u.ok, true)
    assert.equal(useJamStore.getState().walkDensity, 1)
    const u2 = applyMutate('undensify-walk')
    assert.equal(u2.ok, true)
    assert.equal(u2.changed, 0, 'second undensify no-op / zero changed')
    console.log('  densify/undensify 1↔2 + drums pinned: ok')
  }

  // Structure change resets densify (align with half/double + intensity)
  {
    const { setWalkDensity, setWalkLength: setWL, reshuffleUnlocked } = await import('./jam-actions.ts')
    setWL(3)
    setWalkDensity(2)
    assert.equal(useJamStore.getState().walkDensity, 2)
    setWL(4)
    assert.equal(useJamStore.getState().walkDensity, 1, 'setWalkLength resets densify')
    setWalkDensity(2)
    reshuffleUnlocked()
    assert.equal(useJamStore.getState().walkDensity, 1, 'Shuffle resets densify')
    console.log('  densify resets on walk N + Shuffle: ok')
  }

  // Highlight math: cycleInt % N (integer cycles) — source smoke
  {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'src/components/jam/JamShell.tsx'), 'utf8')
    assert.ok(/cycleInt\s*%\s*walkChips\.length/.test(src), 'highlight uses cycleInt % N')
    console.log('  highlight cycleInt % N: ok')
  }

  // Intensity-adjacent smoke: N=3 + density 1/2 melodic generate does not throw
  {
    const { setWalkDensity: setWD, reshuffleUnlocked } = await import('./jam-actions.ts')
    setWalkLength(3)
    useJamStore.getState().setWalkDensity(1)
    assert.doesNotThrow(() => reshuffleUnlocked())
    setWD(2)
    assert.doesNotThrow(() => reshuffleUnlocked())
    // L4 recipe on stretched bass should still touch note() cells (enrich), not throw
    const { applyIntensityL4Layer } = await import('./mutate.ts')
    const bass = useSessionStore.getState().tracks.find((x) => x.role === 'bass' && !x.locked)
    if (bass) {
      assert.doesNotThrow(() => applyIntensityL4Layer(bass.code, 'bass'))
      const out = applyIntensityL4Layer(bass.code, 'bass')
      assert.ok(typeof out === 'string' && out.length > 0)
    }
    console.log('  intensity N=3 density 1/2 smoke: ok')
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


  // Pads Keep / jam_mic survives setWalkLength (structure change skips isPadsKeepTrack)
  {
    const session = useSessionStore.getState()
    const padsCode = 'note("c3@16").s("jam_mic_9").speed(0.1).stretch(9).clip(1).slow(4)'
    const id = session.addTrack({
      name: 'Pads',
      role: 'vox',
      code: padsCode,
      color: '#a78bfa',
      muted: false,
      soloed: false,
      locked: false,
      volume: 1,
      octave: 0,
      error: null,
    })
    setWalkLength(2)
    const after = useSessionStore.getState().tracks.find((x) => x.id === id)
    assert.ok(after, 'Pads track still present')
    assert.equal(after!.code, padsCode, 'setWalkLength must not wipe Pads Keep')
    console.log('  Pads Keep survives setWalkLength: ok')
  }

console.log('ALL WALK-LENGTH CHECKS PASSED')
