/**
 * Intensity partial-overlay contract:
 * L1 kit base · L2 hats only · L3 spawn + hat mute · L4 densify (+ bass spawn if missing);
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



{
  // L4 spawns bass when kit has none; leave 4 drops L4-owned bass.
  const kit =
    KITS.find((k) => !k.tracks.some((t) => t.role === 'bass')) ?? null
  assert.ok(kit, 'need a kit without bass')
  resetKit(kit!.id)
  assert.equal(
    useSessionStore.getState().tracks.some((t) => t.role === 'bass'),
    false,
    'kit starts without bass',
  )
  assert.equal(applyMutate('intensity-up').ok, true) // 2
  assert.equal(applyMutate('intensity-up').ok, true) // 3
  assert.equal(
    useSessionStore.getState().tracks.some((t) => t.role === 'bass'),
    false,
    'L3 still no bass',
  )
  assert.equal(applyMutate('intensity-up').ok, true) // 4
  const bassId = useJamStore.getState().spawnedBassId
  assert.ok(bassId, 'L4 spawns bass id')
  const bass = useSessionStore.getState().tracks.find((t) => t.id === bassId)
  assert.ok(bass && bass.role === 'bass', 'L4 bass track present')
  assert.notEqual(bassId, useJamStore.getState().spawnedPadId, 'bass id ≠ pad spawn id')
  const s4 = useJamStore.getState().intensitySnaps[4]
  assert.ok(s4?.spawnedBass?.id === bassId, 'L4 snap owns spawnedBass')

  assert.equal(applyMutate('intensity-down').ok, true) // 3
  assert.equal(useJamStore.getState().spawnedBassId, null, '4→3 clears spawnedBassId')
  assert.equal(
    useSessionStore.getState().tracks.some((t) => t.id === bassId),
    false,
    '4→3 removes L4-spawned bass',
  )
  assert.ok(
    useJamStore.getState().intensitySnaps[4]?.spawnedBass?.id === bassId,
    'L4 snap keeps bass memory',
  )

  assert.equal(applyMutate('intensity-up').ok, true) // 4 again
  assert.equal(useJamStore.getState().spawnedBassId, bassId, '3→4 restores same bass id')
  assert.ok(useSessionStore.getState().tracks.some((t) => t.id === bassId), 'bass back at L4')
  console.log('  [6] no bass → L4 spawns; leave 4 drops; re-enter restores')
}

{
  // L3 hat mute memory — muted flag only; Mix volume untouched by default.
  const kit =
    KITS.find((k) => k.tracks.some((t) => t.role === 'hihats')) ?? KITS[0]!
  resetKit(kit.id)
  const hats = useSessionStore.getState().tracks.filter((t) => t.role === 'hihats')
  assert.ok(hats.length > 0, 'kit has hihats')
  const hatId = hats[0]!.id
  // Ensure audible at L1/L2
  useSessionStore.getState().setMuted(hatId, false)
  useSessionStore.getState().setVolume(hatId, 0.5)
  const priorMuted = false
  const priorVol = 0.5

  assert.equal(applyMutate('intensity-up').ok, true) // 2
  let hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.equal(hat.muted, false, 'L2 hats still unmuted')
  assert.equal(hat.volume, priorVol, 'L2 hats keep volume')

  assert.equal(applyMutate('intensity-up').ok, true) // 3
  hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.equal(hat.muted, true, '2→3 default-mutes hats')
  assert.equal(hat.volume, priorVol, '2→3 leaves Mix volume unchanged')
  const s3 = useJamStore.getState().intensitySnaps[3]
  assert.ok(
    s3?.hatMutes?.some((h) => h.id === hatId && h.muted === true && h.volume === priorVol),
    'L3 default hatMutes muted with prior volume (not 0)',
  )
  assert.ok(
    s3?.hatMutesPrior?.some((h) => h.id === hatId && h.muted === priorMuted && h.volume === priorVol),
    'L3 stores prior hat mute/volume',
  )

  // Live on L3: unmute alone → audible; volume stays prior (no invent).
  useSessionStore.getState().toggleMute(hatId)
  hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.equal(hat.muted, false, 'L3 unmute clears mute')
  assert.equal(hat.volume, priorVol, 'L3 unmute keeps Mix volume (no invent)')

  // Mix volume edit on L3 is independent of mute; remembered on snap leave.
  useSessionStore.getState().setVolume(hatId, 0.8)
  hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.equal(hat.muted, false, 'L3 Mix volume edit leaves mute alone')
  assert.equal(hat.volume, 0.8, 'L3 Mix raise sets volume')

  assert.equal(applyMutate('intensity-up').ok, true) // 4
  hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  // L4 densify bed restores prior (not L3 muted)
  assert.equal(hat.muted, priorMuted, '3→4 restores prior hats for densify bed')
  assert.equal(hat.volume, priorVol, '3→4 prior hat volume')
  // L3 memory intact
  const s3b = useJamStore.getState().intensitySnaps[3]
  assert.ok(
    s3b?.hatMutes?.some((h) => h.id === hatId && h.muted === false && h.volume === 0.8),
    'L3 hat memory kept after 3→4 (user unmute + Mix edit)',
  )

  assert.equal(applyMutate('intensity-down').ok, true) // 3
  hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.equal(hat.muted, false, '4→3 restores L3 unmute edit')
  assert.equal(hat.volume, 0.8, '4→3 restores L3 hat volume edit')

  assert.equal(applyMutate('intensity-down').ok, true) // 2
  hat = useSessionStore.getState().tracks.find((t) => t.id === hatId)!
  assert.equal(hat.muted, priorMuted, '3→2 restores pre-L3 hats')
  assert.equal(hat.volume, priorVol, '3→2 restores pre-L3 hat volume')
  console.log('  [7] L3 hat mute flag-only + memory: default keeps vol → unmute → Mix → 3↔4 → 3→2 prior')
}


{
  // L4 densify-owned edits (drums kick + bass walk) persist across 4→3→4.
  // Not kick-only: every intensityL4TouchesTrack lane must survive leave/return.
  const kit =
    KITS.find(
      (k) =>
        k.tracks.some((t) => /kick/i.test(t.name) && t.role === 'drums') &&
        k.tracks.some((t) => t.role === 'bass'),
    ) ?? KITS[0]!
  resetKit(kit.id)
  const kick = useSessionStore.getState().tracks.find((t) => /kick/i.test(t.name) && t.role === 'drums')
  const bass = useSessionStore.getState().tracks.find((t) => t.role === 'bass')
  assert.ok(kick && bass, 'kit needs Kick + bass')
  const kickId = kick!.id
  const bassId = bass!.id
  // Sparse patterns so L4 densify actually owns these lanes.
  useSessionStore.getState().setCode(kickId, 's("bd ~ ~ ~")')
  useSessionStore.getState().setCode(bassId, 'note("c2 ~ ~ ~").sound("gm_synth_bass_1")')
  const l1Kick = 's("bd ~ ~ ~")'
  const l1Bass = useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code

  for (let i = 0; i < 3; i++) assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)

  const kickAt4 = useSessionStore.getState().tracks.find((t) => t.id === kickId)!
  const bassAt4 = useSessionStore.getState().tracks.find((t) => t.id === bassId)!
  assert.notEqual(kickAt4.code, l1Kick, 'L4 densifies kick')
  assert.notEqual(bassAt4.code, l1Bass, 'L4 densifies bass walk')

  const kickEdited = `${kickAt4.code}/*l4-drums*/`
  const bassEdited = `${bassAt4.code}/*l4-bass*/`
  useSessionStore.getState().setCode(kickId, kickEdited)
  useSessionStore.getState().setCode(bassId, bassEdited)

  assert.equal(applyMutate('intensity-down').ok, true) // →3
  const s4 = useJamStore.getState().intensitySnaps[4]
  assert.equal(
    s4?.codes.find((c) => c.id === kickId)?.code,
    kickEdited,
    'leave-4 must store drums densify edit on snap[4]',
  )
  assert.equal(
    s4?.codes.find((c) => c.id === bassId)?.code,
    bassEdited,
    'leave-4 must store bass densify edit on snap[4]',
  )
  // Densify-only L4 edit must not wipe L1 kit base.
  assert.equal(
    useJamStore.getState().intensitySnaps[1]?.codes.find((c) => c.id === kickId)?.code,
    l1Kick,
    'L4 densify edit must not overwrite L1 kick',
  )
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === kickId)!.code,
    l1Kick,
    '4→3 drops densify; live kick is L1 base',
  )

  assert.equal(applyMutate('intensity-up').ok, true) // →4
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === kickId)!.code,
    kickEdited,
    '4→3→4 keeps L4 drums densify edit',
  )
  assert.equal(
    useSessionStore.getState().tracks.find((t) => t.id === bassId)!.code,
    bassEdited,
    '4→3→4 keeps L4 bass densify edit',
  )
  console.log('  [8] L4 densify edits (drums + bass) survive 4→3→4; L1 base untouched')
}

{
  // General helper: edit any L4-owned live track, leave, return → code matches.
  function assertOwnedEditSurvivesRoundTrip(
    level: 2 | 4,
    pick: () => { id: string; code: string } | undefined,
    mark: string,
  ) {
    const tr = pick()
    assert.ok(tr, `track for ${mark}`)
    const edited = `${tr!.code}${mark}`
    useSessionStore.getState().setCode(tr!.id, edited)
    const down = level === 4 ? 1 : 1
    const up = down
    for (let i = 0; i < down; i++) assert.equal(applyMutate('intensity-down').ok, true)
    for (let i = 0; i < up; i++) assert.equal(applyMutate('intensity-up').ok, true)
    assert.equal(
      useSessionStore.getState().tracks.find((t) => t.id === tr!.id)!.code,
      edited,
      `${mark} must survive leave/return at L${level}`,
    )
  }

  const kit =
    KITS.find(
      (k) =>
        k.tracks.some((t) => t.role === 'hihats') &&
        k.tracks.some((t) => /kick/i.test(t.name) && t.role === 'drums'),
    ) ?? KITS[0]!
  resetKit(kit.id)
  useSessionStore.getState().setCode(
    useSessionStore.getState().tracks.find((t) => /kick/i.test(t.name))!.id,
    's("bd ~ ~ ~")',
  )
  assert.equal(applyMutate('intensity-up').ok, true) // 2
  assertOwnedEditSurvivesRoundTrip(
    2,
    () => {
      const h =
        useSessionStore.getState().tracks.find((t) => t.role === 'hihats') ??
        useSessionStore.getState().tracks.find((t) => t.role === 'drums')
      return h ? { id: h.id, code: h.code } : undefined
    },
    '/*l2-round*/',
  )
  assert.equal(applyMutate('intensity-up').ok, true) // 3
  assert.equal(applyMutate('intensity-up').ok, true) // 4
  assertOwnedEditSurvivesRoundTrip(
    4,
    () => {
      const k = useSessionStore.getState().tracks.find((t) => /kick/i.test(t.name) && t.role === 'drums')
      return k ? { id: k.id, code: k.code } : undefined
    },
    '/*l4-round*/',
  )
  console.log('  [9] owned-edit round-trip helper: L2 hats + L4 kick densify')
}


console.log('ALL INTENSITY SESSION CHECKS PASSED')
