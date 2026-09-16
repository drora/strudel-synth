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
  captureL1BaseSnap,
  clampIntensity,
  intensityL2TouchesTrack,
  intensityL4TouchesTrack,
  intensitySpawnRole,
  isKeysTrack,
  nextIntensity,
  snapCodeMap,
  stripTrackFromSnap,
  upsertSnapCode,
  INTENSITY_LEVELS_ABOVE,
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

function attachSpawnedPad(pad: Track) {
  const jam = useJamStore.getState()
  const cur = jam.spawnedPadId
  if (cur && cur !== pad.id) useSessionStore.getState().removeTrack(cur)
  if (!useSessionStore.getState().tracks.some((tr) => tr.id === pad.id)) {
    useSessionStore.getState().addTrack({ ...pad, id: pad.id })
  } else {
    useSessionStore.getState().setCode(pad.id, pad.code)
  }
  jam.setSpawnedPadId(pad.id)
}

function densifyL2(code: string, role: TrackRole) {
  return applyIntensityFromBase(code, role, 2, {
    root: useJamStore.getState().songRoot,
    scale: useJamStore.getState().songScale,
    keys: false,
  })
}

function densifyL4(code: string, role: TrackRole, keys: boolean) {
  const jam = useJamStore.getState()
  return applyIntensityL4Layer(code, role, {
    root: jam.songRoot,
    scale: jam.songScale,
    keys,
  })
}

/** Invalidate track T in every snap strictly above `fromLevel`. Never writes downward. */
function invalidateTrackAbove(trackId: string, fromLevel: IntensityLevel) {
  const jam = useJamStore.getState()
  for (const lvl of INTENSITY_LEVELS_ABOVE[fromLevel]) {
    const snap = jam.intensitySnaps[lvl]
    if (!snap) continue
    const next = stripTrackFromSnap(snap, trackId)
    if (
      next.codes.length === snap.codes.length &&
      next.spawnedPad === snap.spawnedPad
    ) {
      continue
    }
    jam.saveIntensitySnap(lvl, next)
  }
}

function ensureL1Base(spawnId: string | null) {
  const jam = useJamStore.getState()
  if (jam.intensitySnaps[1]) return
  const tracks = useSessionStore.getState().tracks
  jam.saveIntensitySnap(1, captureL1BaseSnap(tracks, spawnId))
}

function saveSnapCodes(
  level: IntensityLevel,
  codes: { id: string; code: string }[],
  spawnedPad: Track | null,
) {
  useJamStore.getState().saveIntensitySnap(level, { codes, spawnedPad })
}

function updateOwnedCode(level: IntensityLevel, id: string, code: string) {
  const jam = useJamStore.getState()
  const snap = jam.intensitySnaps[level] ?? { codes: [], spawnedPad: null }
  saveSnapCodes(level, upsertSnapCode(snap.codes, id, code), snap.spawnedPad)
}

/**
 * Commit live edits at `from` into the owning partial overlay only, then
 * invalidate that track in every snap above the owner. Never write downward.
 */
function commitIntensityEdits(from: IntensityLevel) {
  const session = useSessionStore.getState()
  const spawn = liveSpawnedPad()
  const spawnId = spawn?.id ?? null
  ensureL1Base(spawnId)

  const jam = useJamStore.getState()
  const s1 = jam.intensitySnaps[1]!
  const l1Map = snapCodeMap(s1)
  const s2 = jam.intensitySnaps[2]
  const l2Map = snapCodeMap(s2)

  // Expected kit codes at `from` from current overlays (pre-edit baseline).
  const expected = new Map<string, string>()
  for (const c of s1.codes) {
    let code = c.code
    if (from >= 2) {
      const tr = session.tracks.find((t) => t.id === c.id)
      if (tr) {
        const touches = intensityL2TouchesTrack(tr.role, c.code, densifyL2)
        if (touches) {
          code = l2Map.has(c.id) ? l2Map.get(c.id)! : densifyL2(c.code, tr.role)
        }
      }
    }
    if (from >= 4) {
      const tr = session.tracks.find((t) => t.id === c.id)
      if (tr && tr.role !== 'hihats') {
        const keys = isKeysTrack(tr)
        const base = code
        if (intensityL4TouchesTrack(tr.role, keys, base, (cd, r) => densifyL4(cd, r, keys))) {
          const s4 = snapCodeMap(jam.intensitySnaps[4])
          code = s4.has(c.id) ? s4.get(c.id)! : densifyL4(base, tr.role, keys)
        }
      }
    }
    expected.set(c.id, code)
  }

  for (const tr of session.tracks) {
    if (spawnId && tr.id === spawnId) continue
    const exp = expected.get(tr.id)
    if (exp !== undefined && exp === tr.code) continue

    // Live differs from composed expectation → edit while at `from`.
    const l1Code = l1Map.get(tr.id) ?? tr.code
    const l2Owned = intensityL2TouchesTrack(tr.role, l1Code, densifyL2)
    const keys = isKeysTrack(tr)
    const l2Code = l2Map.has(tr.id)
      ? l2Map.get(tr.id)!
      : l2Owned
        ? densifyL2(l1Code, tr.role)
        : l1Code
    const l4Owned = intensityL4TouchesTrack(tr.role, keys, l2Code, (cd, r) =>
      densifyL4(cd, r, keys),
    )

    if (from === 1) {
      // L1 owns all kit tracks.
      updateOwnedCode(1, tr.id, tr.code)
      invalidateTrackAbove(tr.id, 1)
      continue
    }

    if (from === 2) {
      if (l2Owned) {
        updateOwnedCode(2, tr.id, tr.code)
        invalidateTrackAbove(tr.id, 2)
      } else {
        // Snare/kick/bass etc. edited at L2 → L1 owns; invalidate above L1.
        updateOwnedCode(1, tr.id, tr.code)
        invalidateTrackAbove(tr.id, 1)
      }
      continue
    }

    if (from === 3) {
      // L3 owns only spawn (handled below). Kit edits route to L1 or L2.
      if (l2Owned) {
        // Hat edit while at L3 → still L2-owned.
        updateOwnedCode(2, tr.id, tr.code)
        invalidateTrackAbove(tr.id, 2)
      } else {
        updateOwnedCode(1, tr.id, tr.code)
        invalidateTrackAbove(tr.id, 1)
      }
      continue
    }

    // from === 4
    if (tr.role === 'hihats' || (l2Owned && !l4Owned)) {
      updateOwnedCode(2, tr.id, tr.code)
      invalidateTrackAbove(tr.id, 2)
      continue
    }
    if (l4Owned) {
      // Densify-tier edit: store on L4. If base (non-densify) intent changed vs L1,
      // also fold kick/snare/bass token edits into L1 by using undensified live when
      // live equals densify(L1+L2) except tokens — keep simple: L4 overlay only;
      // base token swaps at L4 still update L1 when densify(L1) tokens diverge.
      updateOwnedCode(4, tr.id, tr.code)
      // Do not invalidate below. Upper: none.
      // If this is a base-family edit (rim vs sd) reflected in live, update L1 from
      // the pre-densify composed code's sibling: use L1 slot when user changed
      // identity of snare/kick relative to densify(current L1+L2).
      const composedLower = l2Owned
        ? l2Map.has(tr.id)
          ? l2Map.get(tr.id)!
          : densifyL2(l1Code, tr.role)
        : l1Code
      const recipe4 = densifyL4(composedLower, tr.role, keys)
      if (tr.code !== recipe4) {
        // In-level L4 edit persists on snap[4]; also push a best-effort L1 update
        // when the edit is clearly a kit-base change done at L4 (rare). Prefer L1
        // owner for snare/kick/bass identity: store undensified live if no densify
        // markers — skip; L4 overlay is enough for re-entry.
      }
      continue
    }
    // Non-owned at L4 (e.g. pure pad kit): L1
    updateOwnedCode(1, tr.id, tr.code)
    invalidateTrackAbove(tr.id, 1)
  }

  // Spawn ownership
  if (from === 3) {
    const prev = jam.intensitySnaps[3]?.spawnedPad
    jam.saveIntensitySnap(3, {
      codes: [],
      spawnedPad: spawn ? { ...spawn } : null,
    })
    if (spawn && (!prev || prev.code !== spawn.code || prev.id !== spawn.id)) {
      invalidateTrackAbove(spawn.id, 3)
    }
  } else if (from === 4) {
    // L4-only pad slot — never write downward to L3.
    const s4 = jam.intensitySnaps[4] ?? { codes: [], spawnedPad: null }
    jam.saveIntensitySnap(4, {
      codes: s4.codes,
      spawnedPad: spawn ? { ...spawn } : null,
    })
  } else if (from <= 2) {
    // Leaving L1/L2: kit already handled; ensure L1 snapshot is current for kit.
    if (from === 1) {
      jam.saveIntensitySnap(1, captureL1BaseSnap(session.tracks, spawnId))
    }
  }
}

/**
 * Seed missing overlays after first enter: store recipe output for tracks M owns
 * so in-level edits later have a baseline. Does not overwrite existing overlays.
 */
function seedMissingOverlays(level: IntensityLevel) {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  const spawn = liveSpawnedPad()
  const spawnId = spawn?.id ?? null
  const s1 = jam.intensitySnaps[1]
  if (!s1) return
  const l1Map = snapCodeMap(s1)

  if (level === 2) {
    const existing = snapCodeMap(jam.intensitySnaps[2])
    let codes = [...(jam.intensitySnaps[2]?.codes ?? [])]
    for (const tr of session.tracks) {
      if (spawnId && tr.id === spawnId) continue
      const l1 = l1Map.get(tr.id) ?? tr.code
      if (!intensityL2TouchesTrack(tr.role, l1, densifyL2)) continue
      if (existing.has(tr.id)) continue
      codes = upsertSnapCode(codes, tr.id, tr.code)
    }
    saveSnapCodes(2, codes, null)
    return
  }

  if (level === 3) {
    if (!jam.intensitySnaps[3]?.spawnedPad && spawn) {
      jam.saveIntensitySnap(3, { codes: [], spawnedPad: { ...spawn } })
    }
    return
  }

  if (level === 4) {
    const s4 = jam.intensitySnaps[4] ?? { codes: [], spawnedPad: null }
    const existing = snapCodeMap(s4)
    let codes = [...s4.codes]
    for (const tr of session.tracks) {
      if (spawnId && tr.id === spawnId) continue
      if (tr.role === 'hihats') continue
      const keys = isKeysTrack(tr)
      const l1 = l1Map.get(tr.id) ?? tr.code
      const l2Map = snapCodeMap(jam.intensitySnaps[2])
      const lower = intensityL2TouchesTrack(tr.role, l1, densifyL2)
        ? l2Map.get(tr.id) ?? densifyL2(l1, tr.role)
        : l1
      if (!intensityL4TouchesTrack(tr.role, keys, lower, (cd, r) => densifyL4(cd, r, keys))) {
        continue
      }
      if (existing.has(tr.id)) continue
      codes = upsertSnapCode(codes, tr.id, tr.code)
    }
    // First visit / invalidated L4 spawn: start from L3 pad.
    const l3Pad = jam.intensitySnaps[3]?.spawnedPad ?? spawn
    const pad = s4.spawnedPad ?? (l3Pad ? { ...l3Pad } : null)
    jam.saveIntensitySnap(4, { codes, spawnedPad: pad })
  }
}

/**
 * Realize by compositing partial overlays — never restore a full-jam tape.
 * L1 base → L2 hat overlay if ≥2 → L3 spawn if ≥3 → L4 densify if 4.
 */
function realizeIntensityLevel(target: IntensityLevel) {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  ensureL1Base(jam.spawnedPadId)

  const s1 = jam.intensitySnaps[1]!
  const l1Map = snapCodeMap(s1)
  const s2 = jam.intensitySnaps[2]
  const l2Map = snapCodeMap(s2)
  const s3 = jam.intensitySnaps[3]
  const s4 = jam.intensitySnaps[4]
  const l4Map = snapCodeMap(s4)

  // Drop spawn first; kit rebuild from L1.
  dropSpawnedPad()

  // Apply L1 base to existing kit tracks.
  for (const c of s1.codes) {
    if (session.tracks.some((tr) => tr.id === c.id)) {
      useSessionStore.getState().setCode(c.id, c.code)
    }
  }

  if (target <= 1) return

  // L2 hat overlays / recalculate
  {
    const fresh = useSessionStore.getState()
    for (const tr of fresh.tracks) {
      if (tr.locked) continue
      const l1 = l1Map.get(tr.id)
      if (l1 == null) continue
      if (!intensityL2TouchesTrack(tr.role, l1, densifyL2)) continue
      // L2 must not rewrite tracks it never owned — only hat-recipe tracks.
      const overlay = l2Map.get(tr.id)
      const next = overlay ?? densifyL2(l1, tr.role)
      if (next !== tr.code) fresh.setCode(tr.id, next)
    }
  }

  if (target === 2) return

  // L3 spawn
  if (target === 3) {
    if (s3?.spawnedPad) attachSpawnedPad(s3.spawnedPad)
    else spawnIntensityLane(3)
    return
  }

  // target === 4: densify overlays, then spawn (L4 slot or L3 carry)
  {
    const fresh = useSessionStore.getState()
    const spawnSkip = s4?.spawnedPad?.id ?? s3?.spawnedPad?.id ?? null
    for (const tr of fresh.tracks) {
      if (tr.locked) continue
      if (spawnSkip && tr.id === spawnSkip) continue
      if (tr.role === 'hihats') continue // L4 must not rewrite hats
      const keys = isKeysTrack(tr)
      const l1 = l1Map.get(tr.id) ?? tr.code
      const lower = intensityL2TouchesTrack(tr.role, l1, densifyL2)
        ? l2Map.get(tr.id) ?? densifyL2(l1, tr.role)
        : l1
      // Current live may already be lower after L2 pass.
      const base = fresh.tracks.find((t) => t.id === tr.id)?.code ?? lower
      if (!intensityL4TouchesTrack(tr.role, keys, base, (cd, r) => densifyL4(cd, r, keys))) {
        continue
      }
      const overlay = l4Map.get(tr.id)
      const next = overlay ?? densifyL4(base, tr.role, keys)
      if (next !== tr.code) fresh.setCode(tr.id, next)
    }
  }

  // Spawn: L4 overlay if present; else last L3 pad (carry / recalc after invalidate).
  if (s4?.spawnedPad) {
    attachSpawnedPad(s4.spawnedPad)
  } else if (s3?.spawnedPad) {
    attachSpawnedPad(s3.spawnedPad)
  } else {
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
  // Full live tape for Undo only — snaps stay partial.
  const beforeCodes = session.tracks.map((tr) => ({ id: tr.id, code: tr.code }))

  commitIntensityEdits(from)
  realizeIntensityLevel(to)
  seedMissingOverlays(to)
  jam.setIntensityLevel(to)

  const after = useSessionStore.getState()
  const addedTrackIds = after.tracks.filter((tr) => !beforeIds.includes(tr.id)).map((tr) => tr.id)
  const removedTracks =
    beforePad && !after.tracks.some((tr) => tr.id === beforePad.id) ? [beforePad] : []
  const primary = beforeCodes[0]
  jam.pushUndo({
    trackId: primary?.id ?? after.tracks[0]?.id ?? 'track-1',
    code: primary?.code ?? '',
    label: `Intensity ${to}/4`,
    batch: beforeCodes.map((c) => ({ trackId: c.id, code: c.code })),
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
