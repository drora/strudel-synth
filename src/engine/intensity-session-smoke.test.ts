/**
 * Intensity spawn one-way (3→4 carry, not 4→3), L2 hat edits riding to L3/L4,
 * L4-on-L3 densify, + L1 code edits flowing into cached L2+.
 * Run: npx --yes tsx src/engine/intensity-session-smoke.test.ts
 * Or:  npm run test:intensity-session
 */
import assert from 'node:assert/strict'
import { intensityLevelsShareSpawn } from './intensity'

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
  assert.equal(intensityLevelsShareSpawn(3, 2), false)
  assert.equal(intensityLevelsShareSpawn(1, 4), false)
  console.log('  intensityLevelsShareSpawn: 3↔4 share; others do not')
}

installLocalStorage()

const { useSessionStore } = await import('../store/session-store.ts')
const { useJamStore } = await import('../store/jam-store.ts')
const { applyKit, applyMutate } = await import('./jam-actions.ts')
const { KITS } = await import('./kits.ts')
const { applyIntensityL4Layer } = await import('./mutate.ts')

{
  // Spawn edits carry 3→4 only; L4-only pad stays on 4; 4→3 restores L3 version.
  const kit = KITS.find((k) => !k.tracks.some((t) => t.role === 'pad')) ?? KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit')

  const jam = useJamStore.getState()
  jam.resetIntensitySession()
  jam.setIntensityLevel(1)

  // Climb 1 → 2 → 3
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 2)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)

  const spawnId = useJamStore.getState().spawnedPadId
  assert.ok(spawnId, 'L3 spawns a lane')
  const spawnAt3 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(spawnAt3, 'spawned track present at L3')
  const codeAt3 = spawnAt3!.code
  assert.ok(codeAt3.length > 0)

  // 1) Edit spawn at L3 → 3→4: same id + L3-edited code
  const editedAt3 = `${codeAt3}/*l3-edit*/`
  useSessionStore.getState().setCode(spawnId!, editedAt3)

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, 'L4 keeps same spawn id')
  const at4 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(at4, 'spawn still present at L4')
  assert.equal(at4!.code, editedAt3, '3→4 carries L3-edited spawn code')

  // Edit at L4 (L4-only)
  const editedAt4 = `${editedAt3}/*l4-edit*/`
  useSessionStore.getState().setCode(spawnId!, editedAt4)

  // 2) 4 → 3: same id + L3 edit (NOT L4 edit)
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, '4→3 keeps same spawn id')
  const back3 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(back3, 'spawn still present back at L3')
  assert.equal(back3!.code, editedAt3, '4→3 restores L3 spawn, not L4 edit')
  assert.ok(!back3!.code.includes('/*l4-edit*/'), 'L4 edit must not leak onto L3')

  // 3) 3→4 again (no L3 pad change): L4 spawn is the L4 edit (4-only persist)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, 're-enter L4 same spawn id')
  const at4again = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(at4again, 'spawn present on second L4 visit')
  assert.equal(at4again!.code, editedAt4, 'L4-only pad edit persists when L3 pad unchanged')

  // Back to 3, then edit L3 again
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  const editedAt3b = `${editedAt3}/*l3-edit-2*/`
  useSessionStore.getState().setCode(spawnId!, editedAt3b)

  // 4) Edit spawn at L3 again → 3→4: L4 becomes the new L3 edit (carry up)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  const at4carry = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(at4carry, 'spawn present after L3 re-edit carry')
  assert.equal(at4carry!.code, editedAt3b, 'new L3 pad edit overwrites L4 spawn')
  assert.ok(!at4carry!.code.includes('/*l4-edit*/'), 'stale L4 edit cleared by L3 carry-up')

  // Return to 3 for drop test (L3 version = editedAt3b after 4→3)
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  const at3preDrop = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.equal(at3preDrop!.code, editedAt3b, '4→3 after carry restores latest L3 edit')

  // 5) 3 → 2 drops spawn; 2 → 3 restores L3 spawn (not L4)
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 2)
  assert.equal(useJamStore.getState().spawnedPadId, null, 'L2 drops spawn')
  assert.ok(!useSessionStore.getState().tracks.some((t) => t.id === spawnId), 'spawn track removed at L2')

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, '2→3 restores shared spawn id')
  const restored = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(restored, 'spawn restored at L3')
  assert.equal(restored!.code, editedAt3b, '2→3 restores L3 spawn, not L4')
  assert.ok(!restored!.code.includes('/*l4-edit*/'), '2→3 must not restore L4-only edit')

  console.log('  spawn edits 3→4 only; L4-only pad stays on 4; 2→3 restores L3')
}


{
  // L1 snare edit must be heard at L2 on the next climb (not stale snap[2]).
  const kit = KITS.find((k) => k.tracks.some((t) => t.role === 'drums')) ?? KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit for L1→L2 flow')

  const jam = useJamStore.getState()
  jam.resetIntensitySession()
  jam.setIntensityLevel(1)

  let drums = useSessionStore.getState().tracks.find((t) => t.role === 'drums')
  assert.ok(drums, 'drums track present')
  // Prefer a snare-ish line; otherwise force a clear sd pattern.
  if (!/\b(sd|cp)\b/.test(drums!.code)) {
    useSessionStore.getState().setCode(drums!.id, 's("sd ~ ~ ~")')
    drums = useSessionStore.getState().tracks.find((t) => t.id === drums!.id)!
  }
  const drumsId = drums!.id
  const oldSnare = /\b(sd|cp)\b/.exec(drums!.code)?.[1] ?? 'sd'
  assert.ok(/\b(sd|cp)\b/.test(drums!.code), 'L1 drums has sd or cp')

  // Build cached snaps 2/3/4 from the original snare, then return to L1.
  for (let i = 0; i < 3; i++) assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  for (let i = 0; i < 3; i++) assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 1)

  // Re-read L1 code after round-trip (snap restore), then sd/cp → rim
  drums = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(drums, 'drums present at L1 after round-trip')
  const edited = /\b(sd|cp)\b/.test(drums.code)
    ? drums.code.replace(/\b(sd|cp)\b/g, 'rim')
    : 's("rim ~ ~ ~")'
  useSessionStore.getState().setCode(drumsId, edited)
  assert.ok(/\brim\b/.test(useSessionStore.getState().tracks.find((t) => t.id === drumsId)!.code))
  assert.ok(!new RegExp(`\\b${oldSnare}\\b`).test(
    useSessionStore.getState().tracks.find((t) => t.id === drumsId)!.code,
  ))

  // Climb to L2 — must play rim, not stale sd/cp from snap[2]
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 2)
  const at2 = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(/\brim\b/.test(at2.code), `L2 drums should contain rim, got: ${at2.code}`)
  assert.ok(
    !new RegExp(`\\b${oldSnare}\\b`).test(at2.code),
    `L2 must not still play old ${oldSnare}, got: ${at2.code}`,
  )

  // L3/L4 still rim; spawn rules unchanged
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  const spawnId = useJamStore.getState().spawnedPadId
  assert.ok(spawnId, 'L3 still spawns')
  const at3 = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(/\brim\b/.test(at3.code), `L3 drums rim, got: ${at3.code}`)

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, 'L4 keeps spawn')
  const at4 = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
  assert.ok(/\brim\b/.test(at4.code), `L4 drums rim, got: ${at4.code}`)

  console.log('  L1 snare edit (sd/cp→rim) flows into cached L2+; spawn unchanged')
}



{
  // L2 hat edits must ride into L3/L4; L3 kit edits ride into L4; 4→3 drops densify.
  const kit =
    KITS.find(
      (k) =>
        k.tracks.some((t) => t.role === 'hihats' || (t.role === 'drums' && /\b(hh|oh|ch)\b/.test(t.code ?? ''))) &&
        k.tracks.some((t) => t.role === 'drums'),
    ) ?? KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit for L2-hat ride')

  const jam = useJamStore.getState()
  jam.resetIntensitySession()
  jam.setIntensityLevel(1)

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 2)

  // Prefer a dedicated hihats track; else drums (hat tokens live there).
  let hat =
    useSessionStore.getState().tracks.find((t) => t.role === 'hihats') ??
    useSessionStore.getState().tracks.find((t) => t.role === 'drums')
  assert.ok(hat, 'hat-bearing track present at L2')
  const hatId = hat!.id
  const marked = `${hat!.code}/*l2-hats*/`
  useSessionStore.getState().setCode(hatId, marked)

  // Pick a non-spawn kit track to edit at L3 (prefer bass, else first non-hat drums/other).
  const pickL3EditTarget = () => {
    const tracks = useSessionStore.getState().tracks
    const spawnId = useJamStore.getState().spawnedPadId
    return (
      tracks.find((t) => t.role === 'bass' && t.id !== spawnId) ??
      tracks.find((t) => t.role === 'drums' && t.id !== hatId && t.id !== spawnId) ??
      tracks.find((t) => t.id !== hatId && t.id !== spawnId)
    )
  }

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  const spawnId = useJamStore.getState().spawnedPadId
  assert.ok(spawnId, 'L3 spawns')
  const hatAt3 = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.ok(hatAt3.code.includes('/*l2-hats*/'), `L3 keeps L2 hat edit, got: ${hatAt3.code}`)

  const l3Target = pickL3EditTarget()
  assert.ok(l3Target, 'non-spawn kit track for L3 edit')
  const l3Id = l3Target!.id
  const l3Marked = `${l3Target!.code}/*l3-kit*/`
  useSessionStore.getState().setCode(l3Id, l3Marked)

  // Capture pre-L4 codes for densify check on drums (if available).
  const drumsPre4 = useSessionStore.getState().tracks.find((t) => t.role === 'drums' && t.id !== spawnId)
  const drumsId = drumsPre4?.id
  const drumsCodeAt3 = drumsPre4?.code

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, 'L4 keeps spawn')
  const hatAt4 = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.ok(hatAt4.code.includes('/*l2-hats*/'), `L4 keeps L2 hat edit, got: ${hatAt4.code}`)
  const l3At4 = useSessionStore.getState().tracks.find((t) => t.id === l3Id)!
  assert.ok(
    l3At4.code.includes('/*l3-kit*/') || l3At4.code.startsWith(l3Marked.split('/*l3-kit*/')[0]!),
    `L4 preserves L3 kit edit marker through densify, got: ${l3At4.code}`,
  )
  // Marker is a comment suffix — densify maps bodies and should leave trailing comment.
  assert.ok(l3At4.code.includes('/*l3-kit*/'), `L4 still has /*l3-kit*/, got: ${l3At4.code}`)

  if (drumsId && drumsCodeAt3) {
    const drumsAt4 = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
    const drumsRole = drumsAt4.role
    const expected = applyIntensityL4Layer(drumsCodeAt3, drumsRole)
    assert.equal(drumsAt4.code, expected, `L4 drums = L4-layer(L3), got: ${drumsAt4.code}`)
  }

  // 4 → 3: hat edit remains; L3 kit edit restored; spawn kept; L4 densify dropped.
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, '4→3 keeps spawn')
  const hatBack3 = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.ok(hatBack3.code.includes('/*l2-hats*/'), `4→3 keeps L2 hat edit, got: ${hatBack3.code}`)
  const l3Back = useSessionStore.getState().tracks.find((t) => t.id === l3Id)!
  assert.equal(l3Back.code, l3Marked, `4→3 restores L3 kit code (drops densify), got: ${l3Back.code}`)
  if (drumsId && drumsCodeAt3) {
    const drumsBack = useSessionStore.getState().tracks.find((t) => t.id === drumsId)!
    assert.equal(drumsBack.code, drumsCodeAt3, `4→3 drums back to L3, got: ${drumsBack.code}`)
  }

  console.log('  L2 hat edits ride to L3/L4; L3 kit edits ride to L4; 4→3 drops densify, keeps spawn+hats')
}

console.log('ALL INTENSITY SESSION CHECKS PASSED')
