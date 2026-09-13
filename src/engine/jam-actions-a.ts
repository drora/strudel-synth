/**
 * Shared Jam kit/AB actions (part A) — used by UI + WebMCP.
 */
import { useSessionStore } from '../store/session-store'
import { useJamStore, type AbSlot } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'
import { KITS, getKit, kitToTemplate, applySoundChoiceToCode, matchSoundChoice } from './kits'
import { pickRandomKit } from './kit-browser'
import { reshuffleTrack } from './reshuffle'
import { resolveShuffleProfile } from './kits-types'
import type { ScaleKind } from './kits-types'
import { rollSeed, retargetSeed, hydrateSeed, randomSongRoot, randomSongScale, type SongSeed } from './song-seed'
import { ROLE_PRESETS } from './presets'
import type { TrackRole } from './types'
import {
  clampTrackOctave,
  isMelodicRole,
  remapNotesToHarmony,
  shiftNotesByOctaves,
} from './note-harmony'
import { liveUpdateEngine, type Quantization } from './live-update'
import { applyIntensityFromBase, applyIntensityL4Layer, applyMutateToTracks, getMutation, type MutateId } from './mutate'
import { planShuffleTargets } from './shuffle-lock'
import { pickRandomSoundChoice, pickRandomImprovVoice, soundChoicesForKit } from './kit-sound-choices'
import type { Track } from './types'
import {
  captureIntensitySnap,
  clampIntensity,
  intensityLevelsShareSpawn,
  intensitySpawnRole,
  isKeysTrack,
  nextIntensity,
  type IntensityLevel,
} from './intensity'

export type JamQueueReason = 'kit' | 'jam' | 'reshuffle' | 'mute-solo'

/** Module guard — survives React Strict Mode remount; reset on full load or bfcache pageshow. */
let freshStartDone = false

/** Clear the once-per-load guard (tests + bfcache / pageshow restore). */
export function resetFreshStartGuard() {
  freshStartDone = false
}

/** @deprecated Prefer resetFreshStartGuard */
export const resetFreshStartGuardForTests = resetFreshStartGuard

export function queueLive(
  reason: JamQueueReason = 'jam',
  quantization?: Quantization,
) {
  if (!useSessionStore.getState().isPlaying) return
  const q =
    quantization ??
    useUIStore.getState().getEffectiveQuantization(
      useSessionStore.getState().activeTrackId,
    )
  liveUpdateEngine.queueUpdate(q, reason)
}

export function queueLiveImmediate(reason: JamQueueReason = 'mute-solo') {
  queueLive(reason, 'immediate')
}


function songAwareShuffle(kitShuffle: import('./kits-types').KitShuffleProfile | null | undefined) {
  const jam = useJamStore.getState()
  if (kitShuffle) {
    return { ...kitShuffle, root: jam.songRoot, scale: jam.songScale }
  }
  return {
    groove: 'four_on_floor' as const,
    density: 'mid' as const,
    root: jam.songRoot,
    scale: jam.songScale,
  }
}


/** Fire-and-forget: end Take + download if capturing (New kit / Shuffle). */
function endTakeIfCapturing(): void {
  void import('./mix-capture')
    .then((m) => {
      if (m.isMixCapturing()) void m.stopMixCapture()
    })
    .catch(() => {})
}

export function applyKit(
  id: string,
  opts?: { fromPicker?: boolean; randomizeRoot?: boolean },
): { ok: true; kitId: string; name: string; bpm: number; preservedBpm: boolean } | { ok: false; error: string } {
  endTakeIfCapturing()
  const kit = getKit(id)
  if (!kit) return { ok: false, error: `Unknown kit: ${id}` }
  const resolved = resolveShuffleProfile(kit)
  const jam = useJamStore.getState()
  // First generate this visit (freshStart empty → randomizeRoot): new home + scale.
  // After that (picker / New kit / hasPickedKit): keep current root AND scale.
  // hasPickedKit is persisted (picker stays closed) — do NOT use it to skip the visit roll.
  // Bare apply (no flags, never picked): kit profile root + scale.
  let root: string
  let scale: typeof resolved.scale
  if (opts?.randomizeRoot) {
    root = randomSongRoot(jam.songRoot)
    scale = randomSongScale(jam.songScale)
  } else if (opts?.fromPicker || jam.hasPickedKit) {
    root = jam.songRoot || resolved.root
    scale = jam.songScale || resolved.scale
  } else {
    root = resolved.root
    scale = resolved.scale
  }
  const seed = rollSeed({
    root,
    scale,
    vibe: kit.vibe,
    density: resolved.density,
    groove: resolved.groove,
    fxBias: resolved.fxBias,
  })
  const template = kitToTemplate(kit, seed)
  const session = useSessionStore.getState()
  const preserveBpm = session.isPlaying
  session.loadTemplate(template, { preserveBpm })
  jam.setKitId(kit.id)
  jam.setVibe(kit.vibe)
  jam.setSongRoot(root)
  jam.setSongScale(scale)
  jam.setSongSeed(seed)
  jam.setHasPickedKit(true)
  if (opts?.fromPicker) jam.setShowKitPicker(false)
  // ONE generate only — do not reshuffleUnlocked here.
  jam.resetIntensitySession()
  jam.setLastPeek(`kit · ${kit.name} · shuffled`)
  queueLive('kit')
  return {
    ok: true,
    kitId: kit.id,
    name: kit.name,
    bpm: useSessionStore.getState().bpm,
    preservedBpm: preserveBpm,
  }
}

export function undoJam(): { ok: true; label: string } | { ok: false; error: string } {
  const entry = useJamStore.getState().popUndo()
  if (!entry) return { ok: false, error: 'Nothing to undo' }
  const session = useSessionStore.getState()
  if (entry.batch && entry.batch.length > 0) {
    for (const snap of entry.batch) {
      session.setCode(snap.trackId, snap.code)
    }
  } else {
    session.setCode(entry.trackId, entry.code)
  }
  if (entry.addedTrackIds) {
    for (const id of entry.addedTrackIds) session.removeTrack(id)
  }
  if (entry.removedTracks) {
    for (const tr of entry.removedTracks) {
      if (!useSessionStore.getState().tracks.some((x) => x.id === tr.id)) {
        session.addTrack({ ...tr, id: tr.id })
      }
    }
  }
  const jam = useJamStore.getState()
  if (entry.addedTrackIds?.includes(jam.spawnedPadId ?? '')) jam.setSpawnedPadId(null)
  if (entry.removedTracks) {
    const pad = entry.removedTracks.find((tr) => tr.role === 'pad')
    if (pad) jam.setSpawnedPadId(pad.id)
  }
  if (entry.intensityLevel != null) {
    jam.setIntensityLevel(entry.intensityLevel)
  }
  jam.touchTrack(entry.trackId)
  jam.setLastPeek(`Undo · ${entry.label}`)
  queueLive('jam')
  return { ok: true, label: entry.label }
}

export function reshuffleUnlocked(): {
  ok: true
  shuffled: number
  lockKit: boolean
} {
  endTakeIfCapturing()
  const state = useSessionStore.getState()
  const pinEffects = useUIStore.getState().pinEffects
  const jam = useJamStore.getState()
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  const resolved = activeKit ? resolveShuffleProfile(activeKit) : null
  // Song Shuffle: NEW seed, same Root/Scale.
  const seed = rollSeed({
    root: jam.songRoot,
    scale: jam.songScale,
    vibe: activeKit?.vibe ?? jam.vibe,
    density: resolved?.density ?? activeKit?.shuffle.density ?? 'mid',
    groove: resolved?.groove ?? 'four_on_floor',
    fxBias: resolved?.fxBias ?? 'dry',
  })
  jam.setSongSeed(seed)
  const plan = planShuffleTargets(state.tracks)
  const targets = plan.ok ? plan.targets : []
  let shuffled = 0
  for (const t of targets) {
    let next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
      seed,
    })
    const oct = t.octave ?? 0
    if (oct && isMelodicRole(t.role)) next = shiftNotesByOctaves(next, oct)
    state.setCode(t.id, next)
    shuffled++
  }
  jam.reconcileLastTouchedAfterSongReshuffle()
  dropSpawnedPad()
  jam.resetIntensitySession()
  jam.setLastPeek(activeKit ? `Shuffle · ${activeKit.name}` : jam.lockKit ? 'Shuffle · same kit' : 'Shuffle · free')
  queueLive('reshuffle')
  return { ok: true, shuffled, lockKit: jam.lockKit }
}

export function reshuffleTrackById(
  trackId: string,
): { ok: true; trackId: string; name: string } | { ok: false; error: string } {
  const state = useSessionStore.getState()
  const plan = planShuffleTargets(state.tracks, trackId)
  if (!plan.ok) {
    if (plan.error.startsWith('Track locked:')) {
      const name = plan.error.slice('Track locked: '.length)
      useJamStore.getState().setLastPeek(`Locked · ${name}`)
    }
    return { ok: false, error: plan.error }
  }
  const track = plan.targets[0]!
  const pinEffects = useUIStore.getState().pinEffects
  const jam = useJamStore.getState()
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  const resolved = activeKit ? resolveShuffleProfile(activeKit) : null
  // Keep existing seed (do not roll a new walk). If null, roll once and store.
  let seed: SongSeed | null = jam.songSeed
  if (!seed) {
    seed = rollSeed({
      root: jam.songRoot,
      scale: jam.songScale,
      vibe: activeKit?.vibe ?? jam.vibe,
      density: resolved?.density ?? 'mid',
      groove: resolved?.groove ?? 'four_on_floor',
      fxBias: resolved?.fxBias ?? 'dry',
    })
    jam.setSongSeed(seed)
  }
  let next = reshuffleTrack(track.role, track.code, {
    pinEffects,
    lockKit: jam.lockKit || !!activeKit,
    bank: activeKit?.drumsBank,
    shuffle: songAwareShuffle(activeKit?.shuffle),
    seed,
  })
  const oct = track.octave ?? 0
  if (oct && isMelodicRole(track.role)) next = shiftNotesByOctaves(next, oct)
  state.setCode(track.id, next)
  jam.touchTrack(track.id)
  jam.setLastPeek(`Shuffle · ${track.name}`)
  queueLive('reshuffle')
  return { ok: true, trackId: track.id, name: track.name }
}

export function addJamTrack(
  role: TrackRole,
  opts?: { name?: string; code?: string },
): { ok: true; id: string; name: string; role: TrackRole } {
  const jam = useJamStore.getState()
  const kit = jam.kitId ? getKit(jam.kitId) : undefined
  const resolved = kit ? resolveShuffleProfile(kit) : null
  const density = resolved?.density ?? 'mid'
  const groove = resolved?.groove ?? 'four_on_floor'
  const fxBias = resolved?.fxBias ?? 'dry'
  // Keep existing walk; hydrate clock/mix if an old seed is missing them.
  let seed: SongSeed
  if (jam.songSeed) {
    seed = hydrateSeed(jam.songSeed, { density, groove, fxBias })
    if (seed !== jam.songSeed) jam.setSongSeed(seed)
  } else {
    seed = rollSeed({
      root: jam.songRoot,
      scale: jam.songScale,
      vibe: kit?.vibe ?? jam.vibe,
      density,
      groove,
      fxBias,
    })
    jam.setSongSeed(seed)
  }
  const preset = ROLE_PRESETS[role]
  let code = opts?.code
  if (!code) {
    code = reshuffleTrack(role, '', {
      lockKit: jam.lockKit || !!kit,
      bank: kit?.drumsBank,
      shuffle: songAwareShuffle(kit?.shuffle),
      seed,
    })
    const session = useSessionStore.getState()
    const choices = soundChoicesForKit(role, kit)
    const used = session.tracks
      .filter((t) => t.role === role)
      .map((t) => choices.find((c) => matchSoundChoice(t.code, c))?.id)
      .filter((id): id is string => !!id)
    const voice = pickRandomSoundChoice(role, kit, used)
    if (voice) code = applySoundChoiceToCode(code, voice)
  }
  if (!code) code = preset.defaultCode
  const name = opts?.name ?? preset.label
  const id = useSessionStore.getState().addTrack({
    name,
    role: preset.role,
    code,
    color: preset.color,
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  })
  jam.touchTrack(id)
  jam.setCodeTrackId(null)
  jam.setSoundTrackId(id)
  jam.setLastPeek(`+ Track · ${name}`)
  queueLive('jam')
  return { ok: true, id, name, role }
}

export function stashAb(slot: AbSlot) {
  useJamStore.getState().stashVariant(slot)
  return { ok: true as const, slot, peek: useJamStore.getState().lastPeek }
}

export type FreshStartResult = {
  ok: true
  skipped?: boolean
  randomKit?: boolean
  kitId: string | null
  kitName: string | null
  shuffled: number
  openedPicker: boolean
}

export function freshStartJam(): FreshStartResult {
  if (freshStartDone) {
    const jam = useJamStore.getState()
    return {
      ok: true,
      skipped: true,
      kitId: jam.kitId,
      kitName: jam.kitId ? (getKit(jam.kitId)?.name ?? null) : null,
      shuffled: 0,
      openedPicker: false,
    }
  }
  freshStartDone = true

  const jam = useJamStore.getState()
  const shouldOpenPicker = !jam.hasPickedKit
  let randomKit = false
  let kitName: string | null = jam.kitId ? (getKit(jam.kitId)?.name ?? null) : null

  const session = useSessionStore.getState()
  let shuffled = 0
  if (session.tracks.length === 0) {
    const persisted = jam.kitId ? getKit(jam.kitId) : undefined
    const preferred =
      persisted ??
      pickRandomKit(KITS, jam.kitId) ??
      KITS[0]
    if (preferred) {
      randomKit = !persisted
      applyKit(preferred.id, { randomizeRoot: true })
      kitName = preferred.name
    }
    // applyKit already generated — do not reshuffle again.
    // Same as root/scale: one random Pads voice this visit, then user setting sticks.
    const afterKit = useJamStore.getState()
    const voiceKit = afterKit.kitId ? getKit(afterKit.kitId) : preferred
    const voice = pickRandomImprovVoice(voiceKit, afterKit.improvVoice)
    if (voice) afterKit.setImprovVoice(voice)
  } else {
    // Tracks exist → song Shuffle only (new seed, keep kit).
    shuffled = reshuffleUnlocked().shuffled
  }

  const peek = kitName ? `${kitName} · shuffled` : 'fresh · shuffled'
  useJamStore.getState().setLastPeek(peek)

  if (shouldOpenPicker) {
    useJamStore.getState().setShowKitPicker(true)
  }

  const after = useJamStore.getState()
  return {
    ok: true,
    randomKit,
    kitId: after.kitId,
    kitName: after.kitId ? (getKit(after.kitId)?.name ?? kitName) : kitName,
    shuffled,
    openedPicker: shouldOpenPicker,
  }
}

export function setSongHarmony(
  root: string,
  scale: ScaleKind,
  opts?: { remap?: boolean },
): { ok: true; root: string; scale: ScaleKind; remapped: number } {
  const jam = useJamStore.getState()
  const prevRoot = jam.songRoot
  const prevScale = jam.songScale
  jam.setSongRoot(root)
  jam.setSongScale(scale)
  const existing = jam.songSeed
  const nextSeed = existing
    ? retargetSeed(existing, root, scale)
    : rollSeed({ root, scale, vibe: jam.vibe })
  jam.setSongSeed(nextSeed)
  let remapped = 0
  if (opts?.remap !== false && (prevRoot !== root || prevScale !== scale)) {
    const session = useSessionStore.getState()
    for (const t of session.tracks) {
      if (!isMelodicRole(t.role)) continue
      if (t.locked) continue
      if (!t.code.includes('note(')) continue
      const next = remapNotesToHarmony(t.code, prevRoot, prevScale, root, scale)
      if (next !== t.code) {
        jam.pushUndo({ trackId: t.id, code: t.code, label: `Scale · ${t.name}` })
        session.setCode(t.id, next)
        remapped++
      }
    }
    if (remapped > 0) queueLive('jam')
  }
  jam.setLastPeek(
    remapped > 0
      ? `Key · ${root} ${scale} · remapped ${remapped}`
      : `Key · ${root} ${scale}`,
  )
  return { ok: true, root, scale, remapped }
}

/** Dice: new root + scale (avoid current), remap unlocked melodic lanes. */
export function rollSongHarmony(): { ok: true; root: string; scale: ScaleKind; remapped: number } {
  const jam = useJamStore.getState()
  return setSongHarmony(randomSongRoot(jam.songRoot), randomSongScale(jam.songScale), {
    remap: true,
  })
}

export function setTrackOctave(
  trackId: string,
  octave: number,
): { ok: true; trackId: string; octave: number } | { ok: false; error: string } {
  const session = useSessionStore.getState()
  const track = session.tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false, error: `Track not found: ${trackId}` }
  if (!isMelodicRole(track.role)) {
    return { ok: false, error: `Octave not applicable to ${track.role}` }
  }
  const nextOct = clampTrackOctave(octave)
  const prev = track.octave ?? 0
  const delta = nextOct - prev
  if (delta === 0) {
    session.setOctave(trackId, nextOct)
    return { ok: true, trackId, octave: nextOct }
  }
  const jam = useJamStore.getState()
  jam.pushUndo({
    trackId: track.id,
    code: track.code,
    label: `Octave · ${track.name} · ${nextOct >= 0 ? '+' : ''}${nextOct}`,
  })
  const nextCode = shiftNotesByOctaves(track.code, delta)
  session.setCode(track.id, nextCode)
  session.setOctave(trackId, nextOct)
  jam.touchTrack(track.id)
  jam.setLastPeek(
    `Octave · ${track.name} · ${nextOct >= 0 ? '+' : ''}${nextOct}`,
  )
  queueLive('jam')
  return { ok: true, trackId, octave: nextOct }
}


function currentIntensity(): IntensityLevel {
  return clampIntensity(useJamStore.getState().intensityLevel ?? 1)
}

function dropSpawnedPad() {
  const jam = useJamStore.getState()
  if (!jam.spawnedPadId) return
  useSessionStore.getState().removeTrack(jam.spawnedPadId)
  jam.setSpawnedPadId(null)
}

function generateRoleCode(role: 'pad' | 'arp' | 'lead' | 'fx'): { code: string; name: string; color: string } {
  const jam = useJamStore.getState()
  const kit = jam.kitId ? getKit(jam.kitId) : undefined
  const resolved = kit ? resolveShuffleProfile(kit) : null
  const density = resolved?.density ?? 'mid'
  const groove = resolved?.groove ?? 'four_on_floor'
  const fxBias = resolved?.fxBias ?? 'dry'
  let seed = jam.songSeed
  if (!seed) {
    seed = rollSeed({
      root: jam.songRoot,
      scale: jam.songScale,
      vibe: kit?.vibe ?? jam.vibe,
      density,
      groove,
      fxBias,
    })
    jam.setSongSeed(seed)
  }
  const preset = ROLE_PRESETS[role]
  let code = reshuffleTrack(role, '', {
    lockKit: jam.lockKit || !!kit,
    bank: kit?.drumsBank,
    shuffle: songAwareShuffle(kit?.shuffle),
    seed,
  })
  const session = useSessionStore.getState()
  const choices = soundChoicesForKit(role, kit)
  const used = session.tracks
    .filter((tr) => tr.role === role)
    .map((tr) => choices.find((c) => matchSoundChoice(tr.code, c))?.id)
    .filter((id): id is string => !!id)
  const voice = pickRandomSoundChoice(role, kit, used)
  if (voice) code = applySoundChoiceToCode(code, voice)
  if (!code) code = preset.defaultCode
  return { code, name: preset.label, color: preset.color }
}

function spawnIntensityLane(level: IntensityLevel): Track {
  const jam = useJamStore.getState()
  const tracks = useSessionStore.getState().tracks
  const hasPad = tracks.some((tr) => tr.role === 'pad')
  const hasArp = tracks.some((tr) => tr.role === 'arp')
  const hasKeys = tracks.some((tr) => isKeysTrack(tr))
  const role = intensitySpawnRole({ hasPad, hasArp, hasKeys })
  const built = generateRoleCode(role)
  const name = role === 'lead' ? 'Keys' : built.name
  const recipeLevel: IntensityLevel = level >= 4 ? 3 : level
  const id = useSessionStore.getState().addTrack({
    name,
    role,
    code: applyIntensityFromBase(built.code, role, recipeLevel, { root: jam.songRoot, scale: jam.songScale, keys: role === 'lead' }),
    color: built.color,
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  })
  jam.setSpawnedPadId(id)
  jam.touchTrack(id)
  return useSessionStore.getState().tracks.find((tr) => tr.id === id)!
}

function liveSpawnedPad(): Track | null {
  const jam = useJamStore.getState()
  if (!jam.spawnedPadId) return null
  return useSessionStore.getState().tracks.find((tr) => tr.id === jam.spawnedPadId) ?? null
}

function restoreIntensitySnap(snap: import('./intensity').IntensitySnap) {
  const session = useSessionStore.getState()
  const jam = useJamStore.getState()
  for (const c of snap.codes) {
    if (session.tracks.some((tr) => tr.id === c.id)) session.setCode(c.id, c.code)
  }
  const cur = jam.spawnedPadId
  if (cur && (!snap.spawnedPad || snap.spawnedPad.id !== cur)) {
    session.removeTrack(cur)
  }
  if (snap.spawnedPad && !useSessionStore.getState().tracks.some((tr) => tr.id === snap.spawnedPad!.id)) {
    const p = snap.spawnedPad
    session.addTrack({ ...p, id: p.id })
  }
  jam.setSpawnedPadId(snap.spawnedPad?.id ?? null)
}

/**
 * When L1 kit-track codes change, re-derive those ids into cached L2/L3/L4 snaps
 * so the next climb restores the new sound (e.g. snare sd→rim) without wiping
 * unrelated in-level edits (L2 hat tweaks, L3 spawn).
 */
function patchHigherIntensitySnapsFromL1(
  prevL1: import('./intensity').IntensitySnap | undefined,
  newL1: import('./intensity').IntensitySnap,
  opts?: { forceAll?: boolean },
) {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  const forceAll = opts?.forceAll === true
  if (!forceAll && !prevL1) return
  const prevCodes = new Map((prevL1?.codes ?? []).map((c) => [c.id, c.code]))
  const changed: { id: string; code: string; role: TrackRole; keys: boolean }[] = []
  for (const c of newL1.codes) {
    if (!forceAll && prevCodes.get(c.id) === c.code) continue
    const tr = session.tracks.find((t) => t.id === c.id)
    if (!tr || tr.locked) continue
    // Never rewrite the intensity spawn lane via L1 flow-through.
    if (jam.spawnedPadId === c.id) continue
    changed.push({ id: c.id, code: c.code, role: tr.role, keys: isKeysTrack(tr) })
  }
  if (!changed.length) return
  for (const lvl of [2, 3, 4] as const) {
    const snap = jam.intensitySnaps[lvl]
    if (!snap) continue
    const spawnId = snap.spawnedPad?.id ?? null
    const codes = snap.codes.map((c) => ({ ...c }))
    for (const ch of changed) {
      if (spawnId && ch.id === spawnId) continue
      const next = applyIntensityFromBase(ch.code, ch.role, lvl, {
        root: jam.songRoot,
        scale: jam.songScale,
        keys: ch.keys,
      })
      const idx = codes.findIndex((c) => c.id === ch.id)
      if (idx >= 0) codes[idx] = { id: ch.id, code: next }
      else codes.push({ id: ch.id, code: next })
    }
    jam.saveIntensitySnap(lvl, { codes, spawnedPad: snap.spawnedPad })
  }
}

/** Attach / update the intensity spawn lane without reshuffling id. */
function attachSpawnedPad(pad: Track) {
  const session = useSessionStore.getState()
  const jam = useJamStore.getState()
  const cur = jam.spawnedPadId
  if (cur && cur !== pad.id) session.removeTrack(cur)
  if (!useSessionStore.getState().tracks.some((tr) => tr.id === pad.id)) {
    useSessionStore.getState().addTrack({ ...pad, id: pad.id })
  } else {
    useSessionStore.getState().setCode(pad.id, pad.code)
  }
  jam.setSpawnedPadId(pad.id)
}

/**
 * Realize kit + spawn for a target intensity level.
 * Spawn edits carry 3→4 only (overwrite L4 when L3 pad changed or L4 missing).
 * 4→3 restores snap[3] spawn — L4-only pad edits stay on snap[4].
 */
function realizeIntensityLevel(
  target: IntensityLevel,
  opts?: { l3CarrySpawn?: Track | null; l3SpawnEdited?: boolean },
) {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  if (!jam.intensitySnaps[1]) {
    const snap1 = captureIntensitySnap(session.tracks, null)
    jam.saveIntensitySnap(1, snap1)
    // Defensive: L1 missing but L2+ cached — flow current L1 into those snaps.
    const higher = useJamStore.getState().intensitySnaps
    if (higher[2] || higher[3] || higher[4]) {
      patchHigherIntensitySnapsFromL1(undefined, snap1, { forceAll: true })
    }
  }

  const snaps = () => useJamStore.getState().intensitySnaps
  const harmonyFor = (tr: Track) => ({
    root: jam.songRoot,
    scale: jam.songScale,
    keys: isKeysTrack(tr),
  })

  /** Restore L2 pattern base (snap[2] with hat edits), else L1 + hat densify. */
  const restoreL2Base = () => {
    const s2 = snaps()[2]
    if (s2) {
      restoreIntensitySnap(s2)
      dropSpawnedPad()
      return
    }
    restoreIntensitySnap(snaps()[1]!)
    dropSpawnedPad()
    const fresh = useSessionStore.getState()
    for (const tr of fresh.tracks) {
      if (tr.locked) continue
      const next = applyIntensityFromBase(tr.code, tr.role, 2, harmonyFor(tr))
      if (next !== tr.code) fresh.setCode(tr.id, next)
    }
  }

  if (target <= 1) {
    restoreIntensitySnap(snaps()[1]!)
    dropSpawnedPad()
    return
  }

  if (target === 2) {
    restoreL2Base()
    return
  }

  if (target === 3) {
    // Restore snap[3] kit + spawnedPad (L3 version). Never apply live L4 kept.
    const s3 = snaps()[3]
    if (s3) {
      restoreIntensitySnap(s3)
      if (!s3.spawnedPad) spawnIntensityLane(3)
    } else {
      restoreL2Base()
      spawnIntensityLane(3)
    }
    return
  }

  // target === 4: L3 kit + L4 densify; spawn = L4 persist or L3 carry-up.
  const s3 = snaps()[3]
  const s4 = snaps()[4]
  const spawnSkipId =
    opts?.l3CarrySpawn?.id ?? s4?.spawnedPad?.id ?? s3?.spawnedPad?.id ?? null
  if (s3) {
    // Kit from L3 only — spawn attached below (do not lean on snap[3] pad for L4).
    restoreIntensitySnap({ codes: s3.codes, spawnedPad: null })
    dropSpawnedPad()
  } else {
    restoreL2Base()
  }
  {
    const fresh = useSessionStore.getState()
    for (const tr of fresh.tracks) {
      if (tr.locked) continue
      if (spawnSkipId && tr.id === spawnSkipId) continue
      const next = applyIntensityL4Layer(tr.code, tr.role, harmonyFor(tr))
      if (next !== tr.code) fresh.setCode(tr.id, next)
    }
  }

  const l3Spawn = opts?.l3CarrySpawn ?? (s3?.spawnedPad ? { ...s3.spawnedPad } : null)
  const l4Spawn = s4?.spawnedPad ? { ...s4.spawnedPad } : null
  const keepL4 =
    !!l4Spawn &&
    !!l3Spawn &&
    l4Spawn.id === l3Spawn.id &&
    opts?.l3SpawnEdited !== true
  if (keepL4 && l4Spawn) {
    attachSpawnedPad(l4Spawn)
  } else if (l3Spawn) {
    // 3→4 carry: L3 spawn (incl. L3 edits) is the starting point / overwrite.
    attachSpawnedPad(l3Spawn)
  } else {
    // Always spawn at recipe L3 — never densify a new spawn as L4.
    spawnIntensityLane(3)
  }
}

function applyIntensityDir(
  dir: 1 | -1,
): { ok: true; id: MutateId; label: string; changed: number } | { ok: false; error: string } {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  const from = currentIntensity()
  const to = nextIntensity(from, dir)
  if (to === from) {
    jam.setLastPeek(`Intensity ${from}/4`)
    return { ok: false, error: from === 4 ? 'Already max intensity' : 'Already min intensity' }
  }

  const beforeIds = session.tracks.map((tr) => tr.id)
  const beforePad = liveSpawnedPad()
  const prevL1 = from === 1 ? jam.intensitySnaps[1] : undefined
  const prevFromSnap = jam.intensitySnaps[from]
  const beforeSnap = captureIntensitySnap(session.tracks, beforePad)
  // Detect L3 pad edits before overwriting snap[3] (carry-up vs L4-only persist).
  const l3SpawnEdited =
    from === 3 &&
    !!beforePad &&
    (!prevFromSnap?.spawnedPad || prevFromSnap.spawnedPad.code !== beforePad.code)
  jam.saveIntensitySnap(from, beforeSnap)
  // L1 code edits (e.g. snare sd→rim) must flow into cached L2+ before restore.
  if (from === 1) {
    patchHigherIntensitySnapsFromL1(prevL1, beforeSnap)
  }

  // 3↔4: always realize so kit follows the level; spawn is one-way (3→4 only).
  if (intensityLevelsShareSpawn(from, to)) {
    if (to === 4 && from === 3) {
      realizeIntensityLevel(4, {
        l3CarrySpawn: beforePad ? { ...beforePad } : null,
        l3SpawnEdited,
      })
    } else {
      // 4→3: restore snap[3] spawn — do not apply live L4 kept.
      realizeIntensityLevel(to)
    }
  } else {
    const existing = useJamStore.getState().intensitySnaps[to]
    if (existing) restoreIntensitySnap(existing)
    else realizeIntensityLevel(to)
  }

  // Only write spawn into the snap for the level we are on (no 3↔4 sync loop).
  jam.saveIntensitySnap(
    to,
    captureIntensitySnap(useSessionStore.getState().tracks, liveSpawnedPad()),
  )
  jam.setIntensityLevel(to)

  const after = useSessionStore.getState()
  const addedTrackIds = after.tracks.filter((tr) => !beforeIds.includes(tr.id)).map((tr) => tr.id)
  const removedTracks = beforePad && !after.tracks.some((tr) => tr.id === beforePad.id) ? [beforePad] : []
  const primary = beforeSnap.codes[0]
  jam.pushUndo({
    trackId: primary?.id ?? after.tracks[0]?.id ?? 'track-1',
    code: primary?.code ?? '',
    label: `Intensity ${to}/4`,
    batch: beforeSnap.codes.map((c) => ({ trackId: c.id, code: c.code })),
    addedTrackIds: addedTrackIds.length ? addedTrackIds : undefined,
    removedTracks: removedTracks.length ? removedTracks : undefined,
    intensityLevel: from,
  })
  jam.setLastPeek(`Intensity ${to}/4`)
  queueLive('jam')
  return {
    ok: true,
    id: dir === 1 ? 'intensity-up' : 'intensity-down',
    label: `Intensity ${to}/4`,
    changed: after.tracks.length,
  }
}

/** Apply a named Mutate transform. Song scope = all unlocked; else trackId / last-touched. */
export function applyMutate(
  mutateId: MutateId | string,
  opts?: { trackId?: string },
): { ok: true; id: MutateId; label: string; changed: number } | { ok: false; error: string } {
  const def = getMutation(mutateId)
  if (!def) return { ok: false, error: `Unknown mutate: ${mutateId}` }
  if (def.id === 'intensity-up' || def.id === 'intensity-down') {
    return applyIntensityDir(def.id === 'intensity-up' ? 1 : -1)
  }
  const session = useSessionStore.getState()
  const jam = useJamStore.getState()
  const prefer = opts?.trackId ?? jam.lastTouchedTrackId ?? session.activeTrackId
  if (opts?.trackId && !session.tracks.some((t) => t.id === opts.trackId)) {
    return { ok: false, error: `Track not found: ${opts.trackId}` }
  }
  const result = applyMutateToTracks(session.tracks, def.id, prefer)
  if (!result) {
    jam.setLastPeek(`Mutate · ${def.label} · (no change)`)
    return { ok: false, error: 'Nothing to mutate' }
  }
  const snaps = result.changes.map((c) => {
    const t = session.tracks.find((x) => x.id === c.trackId)!
    return { trackId: t.id, code: t.code }
  })
  const primary = snaps[0]!
  jam.pushUndo({
    trackId: primary.trackId,
    code: primary.code,
    label: `Mutate · ${result.label}`,
    batch: snaps.length > 1 ? snaps : undefined,
  })
  for (const c of result.changes) {
    session.setCode(c.trackId, c.code)
  }
  if (result.scope === 'track') {
    jam.touchTrack(result.changes[0]!.trackId)
  }
  const scopeTag = result.scope === 'song' ? ' · song' : ''
  jam.setLastPeek(`Mutate · ${result.label}${scopeTag}`)
  queueLive('jam')
  return { ok: true, id: result.id, label: result.label, changed: result.changes.length }
}
