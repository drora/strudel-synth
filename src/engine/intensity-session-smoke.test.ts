/**
 * Intensity partial-overlay contract:
 * L1 kit base · L2 hats only · L3 spawn only · L4 densify only;
 * edit@N owns+invalidate above; enter M recalc if missing.
 * Run: npm run test:intensity-session
 */
import assert from 'node:assert/strict'
import { intensityLevelsShareSpawn, isSnareBackbeatTrack } from './intensity'

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

console.log('=== Intensity session smoke ===')

{
  assert.equal(intensityLevelsShareSpawn(3, 4), true)
  assert.equal(intensityLevelsShareSpawn(4, 3), true)
  assert.equal(intensityLevelsShareSpawn(2, 3), false)
  console.log('  intensityLevelsShareSpawn: 3↔4 share; others do not')
}

installLocalStorage()

const { useSessionStore } = await import('../store/session-store.ts')
const { useJamStore } = await import('../store/jam-store.ts')
const { applyKit, applyMutate } = await import('./jam-actions.ts')
const { KITS } = await import('./kits.ts')
const { applyIntensityL4Layer } = await import('./mutate.ts')

function resetKit(kitId?: string) {
  const kit =
    (kitId ? KITS.find((k) => k.id === kitId) : null) ??
    KITS.find((k) => k.tracks.some((t) => t.role === 'drums')) ??
    KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit')
  const jam = useJamStore.getState()
  jam.resetIntensitySession()
  jam.setIntensityLevel(1)
  return kit
}

{
  // Snare→rim at L1: L2/L3/L4 keep rim; L4 must not densify snare/rim/clap.
  resetKit()
  let drums = useSessionStore.getState().tracks.find((t) => t.role === 'drums')
  assert.ok(drums, 'drums at L1')
  const drumsId = drums!.id
  if (!/\b(sd|cp)\b/.test(drums!.code)) {
    useSessionStore.getState().setCode(drumsId, 's("sd ~ ~ ~")')
    drums = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  }
  // Cache L2–L4 with original snare, return to L1
  for (let i = 0; i < 3; i++) assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  for (let i = 0; i < 3; i++) assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 1)

  drums = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  // Rim-only lane so L4 kick densify cannot change the code — proves snare/rim skip.
  const edited = 's("rim ~ ~ ~")'
  useSessionStore.getState().setCode(drumsId, edited)

  assert.equal(applyMutate('intensity-up').ok, true) // →2
  let at = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(/\brim\b/.test(at.code), `L2 shows rim from L1, got: ${at.code}`)
  assert.ok(!/\b(sd|cp)\b/.test(at.code), `L2 must not keep old sd/cp, got: ${at.code}`)

  assert.equal(applyMutate('intensity-up').ok, true) // →3
  at = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(/\brim\b/.test(at.code), `L3 shows rim from L1, got: ${at.code}`)

  assert.equal(applyMutate('intensity-up').ok, true) // →4
  at = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(/\brim\b/.test(at.code), `L4 keeps rim from L1, got: ${at.code}`)
  assert.ok(!/\b(sd|cp)\b/.test(at.code), `L4 must not revive old sd/cp, got: ${at.code}`)
  // L4 must not densify rim/snare/clap — pattern stays as edited at L1
  assert.equal(at.code, edited, `L4 leaves snare/rim/clap alone, got: ${at.code}`)
  const s4 = useJamStore.getState().intensitySnaps[4]
  assert.ok(!s4?.codes.some((c) => c.id === drumsId && /\b(sd|cp)\b/.test(c.code) && !/\brim\b/.test(c.code)))

  console.log('  [1] L1 snare→rim: L2/L3/L4 keep rim; L4 does not densify snare/rim/clap')
}

{
  // Hats edited at L2: snap[2] keeps it through 4→2.
  const kit =
    KITS.find(
      (k) =>
        k.tracks.some((t) => t.role === 'hihats' || (t.role === 'drums' && /\b(hh|oh|ch)\b/.test(t.code ?? ''))),
    ) ?? KITS[0]!
  resetKit(kit.id)
  assert.equal(applyMutate('intensity-up').ok, true) // →2
  let hat =
    useSessionStore.getState().tracks.find((t) => t.role === 'hihats') ??
    useSessionStore.getState().tracks.find((t) => t.role === 'drums')
  assert.ok(hat, 'hat-bearing track')
  const hatId = hat!.id
  const marked = `${hat!.code}/*l2-hats*/`
  useSessionStore.getState().setCode(hatId, marked)

  assert.equal(applyMutate('intensity-up').ok, true) // 3
  assert.equal(applyMutate('intensity-up').ok, true) // 4
  assert.ok(
    useSessionStore.getState().tracks.find((t) => t.id === hatId)!.code.includes('/*l2-hats*/'),
    'L4 still has L2 hat edit',
  )
  assert.equal(applyMutate('intensity-down').ok, true) // 3
  assert.equal(applyMutate('intensity-down').ok, true) // 2
  assert.ok(
    useSessionStore.getState().tracks.find((t) => t.id === hatId)!.code.includes('/*l2-hats*/'),
    '4→2 keeps L2 hat edit',
  )
  console.log('  [2] L2 hat edit survives 2→4→2')
}

{
  // Pad one-way: L3 edit carries to 4; L4 pad edit does not return to 3; 3→4 again keeps L4 pad.
  // 3→2 drops; 2→3 restores L3 pad.
  const kit = KITS.find((k) => !k.tracks.some((t) => t.role === 'pad')) ?? KITS[0]!
  resetKit(kit.id)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)

  const spawnId = useJamStore.getState().spawnedPadId
  assert.ok(spawnId, 'L3 spawns')
  const codeAt3 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)!.code
  const editedAt3 = `${codeAt3}/*l3-edit*/`
  useSessionStore.getState().setCode(spawnId!, editedAt3)

  assert.equal(applyMutate('intensity-up').ok, true) // →4
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, 'same spawn id')
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === spawnId)!.code,
    editedAt3,
    '3→4 carries L3 pad',
  )

  const editedAt4 = `${editedAt3}/*l4-edit*/`
  useSessionStore.getState().setCode(spawnId!, editedAt4)

  assert.equal(applyMutate('intensity-down').ok, true) // →3
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === spawnId)!.code,
    editedAt3,
    '4→3 restores L3 pad, not L4',
  )

  assert.equal(applyMutate('intensity-up').ok, true) // →4 again, no L3 pad change
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === spawnId)!.code,
    editedAt4,
    'L4-only pad persists when L3 unchanged',
  )

  assert.equal(applyMutate('intensity-down').ok, true) // 3
  const editedAt3b = `${editedAt3}/*l3-edit-2*/`
  useSessionStore.getState().setCode(spawnId!, editedAt3b)
  assert.equal(applyMutate('intensity-up').ok, true) // 4
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === spawnId)!.code,
    editedAt3b,
    'L3 pad re-edit invalidates L4; next 4 uses new L3 pad',
  )

  assert.equal(applyMutate('intensity-down').ok, true) // 3
  assert.equal(applyMutate('intensity-down').ok, true) // 2
  assert.equal(useJamStore.getState().spawnedPadId, null, '3→2 drops spawn')
  assert.equal(applyMutate('intensity-up').ok, true) // 3
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, '2→3 restores same id')
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === spawnId)!.code,
    editedAt3b,
    '2→3 restores L3 pad edits',
  )

  console.log('  [3] L3 pad edit → next L4 uses that pad')
  console.log('  [4] L4 pad edit → 4→3 still L3 pad')
  console.log('  [5] 3→2 drops spawn; 2→3 restores L3 pad (same id)')
}

{
  // L3 snare edit → still rim at L2 (L2 does not own snare; L1 does).
  resetKit()
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(applyMutate('intensity-up').ok, true)
  const spawnId = useJamStore.getState().spawnedPadId
  const drums = useSessionStore.getState().tracks.find((t) => t.role === 'drums' && t.id !== spawnId)
  assert.ok(drums)
  useSessionStore.getState().setCode(drums!.id, 's("rim ~ ~ ~")')
  assert.equal(applyMutate('intensity-down').ok, true) // →2
  const at2 = useSessionStore.getState().tracks.find((t) => t.id === drums!.id)!
  assert.ok(/\brim\b/.test(at2.code), `L3 snare edit survives at L2, got: ${at2.code}`)
  assert.ok(!/\b(sd|cp)\b/.test(at2.code), `L2 must not roll back snare, got: ${at2.code}`)
  console.log('  L3 snare→rim survives 3→2 via L1 owner')
}

{
  // L2 hat ride + L3 kit densify drop on 4→3 (chain still works).
  const kit =
    KITS.find((k) => k.tracks.some((t) => t.role === 'drums') && k.tracks.some((t) => t.role === 'bass')) ??
    KITS[0]!
  resetKit(kit.id)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(applyMutate('intensity-up').ok, true)
  const spawnId = useJamStore.getState().spawnedPadId
  const bass = useSessionStore.getState().tracks.find((t) => t.role === 'bass' && t.id !== spawnId)
  assert.ok(bass)
  const bassId = bass!.id
  const bassAt3 = bass!.code
  const drums = useSessionStore.getState().tracks.find((t) => t.role === 'drums' && t.id !== spawnId)
  const drumsId = drums?.id
  const drumsAt3 = drums?.code

  assert.equal(applyMutate('intensity-up').ok, true) // 4
  if (drumsId && drumsAt3) {
    const d4 = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
    const expected = applyIntensityL4Layer(drumsAt3, d4.role)
    assert.equal(d4.code, expected, `L4 drums = densify(L3), got: ${d4.code}`)
  }
  assert.equal(applyMutate('intensity-down').ok, true) // 3
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code,
    bassAt3,
    '4→3 restores L3 bass (drops densify)',
  )
  if (drumsId && drumsAt3) {
    assert.equal(
      useSessionStore.getState().tracks.find((t) => t.id === drumsId)!.code,
      drumsAt3,
      '4→3 drums back to L3',
    )
  }
  console.log('  L4 densify drops on 4→3; kit chain intact')
}


{
  assert.equal(isSnareBackbeatTrack({ name: 'Snare' }), true)
  assert.equal(isSnareBackbeatTrack({ name: 'Rim' }), true)
  assert.equal(isSnareBackbeatTrack({ name: 'Clap' }), true)
  assert.equal(isSnareBackbeatTrack({ name: 'Kick' }), false)
  assert.equal(isSnareBackbeatTrack({ name: 'Hats' }), false)
  console.log('  isSnareBackbeatTrack: snare/rim/clap yes; kick/hats no')
}

{
  // New hihats tracks init Mix volume 0.5
  const kit =
    KITS.find((k) => k.tracks.some((t) => t.role === 'hihats')) ?? KITS[0]!
  resetKit(kit.id)
  const hats = useSessionStore.getState().tracks.filter((t) => t.role === 'hihats')
  assert.ok(hats.length > 0, 'kit has hihats')
  for (const h of hats) {
    assert.equal(h.volume, 0.5, `hihats "${h.name}" volume init 0.5, got ${h.volume}`)
  }
  const others = useSessionStore.getState().tracks.filter((t) => t.role !== 'hihats')
  for (const t of others) {
    assert.equal(t.volume, 1, `non-hat "${t.name}" volume init 1, got ${t.volume}`)
  }
  console.log('  hihats Mix volume inits at 0.5; others at 1')
}

console.log('ALL INTENSITY SESSION CHECKS PASSED')
