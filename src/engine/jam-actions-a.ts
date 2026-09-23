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
import { rollSeed, retargetSeed, hydrateSeed, randomSongRoot, randomSongScale, randomWalkLength, pickWalkOfLength, isLegalWalk, formatConcertChord, type SongSeed, type WalkLength, type WalkCenter } from './song-seed'
import { ROLE_PRESETS } from './presets'
import type { TrackRole } from './types'
import { defaultTrackVolume } from './types'
import {
  clampTrackOctave,
  isMelodicRole,
  remapNotesToHarmony,
  shiftNotesByOctaves,
} from './note-harmony'
import { liveUpdateEngine, type Quantization } from './live-update'
import { applyIntensityFromBase, applyIntensityL4Layer, applyMutateToTracks, getMutation, type MutateId, type SongTimeFeel } from './mutate'
import { planShuffleTargets } from './shuffle-lock'
import { pickRandomSoundChoice, pickRandomImprovVoice, soundChoicesForKit } from './kit-sound-choices'
import { isPadsKeepTrack, jamMicNameFromCode } from './improv-plate'
import { micSampleDuration } from './mic-sample'
import type { Track } from './types'
import {
  captureHatMutes,
  captureL1BaseSnap,
  clampIntensity,
  defaultL3HatMutes,
  intensityL2TouchesTrack,
  intensityL4TouchesTrack,
  intensitySpawnRole,
  isKeysTrack,
  nextIntensity,
  snapCodeMap,
  stripTrackFromSnap,
  upsertSnapCode,
  INTENSITY_LEVELS_ABOVE,
  type IntensityHatMute,
  type IntensityLevel,
  type IntensitySnap,
} from './intensity'

export type JamQueueReason = 'kit' | 'jam' | 'reshuffle' | 'mute-solo'

function micTakeSecForCode(code: string): number | undefined {
  const name = jamMicNameFromCode(code)
  return name ? micSampleDuration(name) : undefined
}

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
  // New kit / applyKit: do NOT pin previous N — rollSeed picks uniform {2,3,4}.
  // Structure change: densify resets like half/double + intensity.
  jam.resetWalkDensity()
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
  jam.resetSongTimeFeel()
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
      if (snap.muted !== undefined) session.setMuted(snap.trackId, snap.muted)
      if (snap.volume !== undefined) session.setVolume(snap.trackId, snap.volume)
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
  if (entry.addedTrackIds?.includes(jam.spawnedBassId ?? '')) jam.setSpawnedBassId(null)
  if (entry.removedTracks) {
    const pad = entry.removedTracks.find((tr) => tr.role === 'pad')
    if (pad) jam.setSpawnedPadId(pad.id)
    if (entry.intensityLevel === 4) {
      const bass = entry.removedTracks.find((tr) => tr.role === 'bass')
      if (bass) jam.setSpawnedBassId(bass.id)
    }
  }
  if (entry.intensityLevel != null) {
    jam.setIntensityLevel(entry.intensityLevel)
  }
  if (entry.songTimeFeel != null) {
    jam.setSongTimeFeel(entry.songTimeFeel)
  }
  if ('songTimeFeelBase' in entry) {
    jam.setSongTimeFeelBase(
      entry.songTimeFeelBase ? entry.songTimeFeelBase.map((c) => ({ ...c })) : null,
    )
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
  // Song Shuffle: NEW seed, same Root/Scale. Randomize N ∈ {2,3,4} avoiding current
  // (same as dice), except keep 1 if user explicitly held via stepper.
  const curLen = jam.songSeed?.walk.length
  const shuffleN: WalkLength | undefined =
    curLen === 1
      ? 1
      : curLen === 2 || curLen === 3 || curLen === 4
        ? randomWalkLength(curLen)
        : undefined
  const seed = rollSeed({
    root: jam.songRoot,
    scale: jam.songScale,
    vibe: activeKit?.vibe ?? jam.vibe,
    density: resolved?.density ?? activeKit?.shuffle.density ?? 'mid',
    groove: resolved?.groove ?? 'four_on_floor',
    fxBias: resolved?.fxBias ?? 'dry',
    walkLength: shuffleN,
  })
  jam.setSongSeed(seed)
  const plan = planShuffleTargets(state.tracks)
  const targets = plan.ok ? plan.targets : []
  jam.resetWalkDensity()
  let shuffled = 0
  for (const t of targets) {
    if (isPadsKeepTrack(t)) continue
    let next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
      seed,
      walkDensity: 1,
      bpm: state.bpm,
      takeSec: micTakeSecForCode(t.code),
    })
    const oct = t.octave ?? 0
    if (oct && isMelodicRole(t.role)) next = shiftNotesByOctaves(next, oct)
    state.setCode(t.id, next)
    shuffled++
  }
  jam.reconcileLastTouchedAfterSongReshuffle()
  dropSpawnedPad()
  dropSpawnedBass()
  jam.resetIntensitySession()
  jam.resetSongTimeFeel()
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
    walkDensity: jam.walkDensity ?? 1,
    bpm: state.bpm,
    takeSec: micTakeSecForCode(track.code),
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
      walkDensity: jam.walkDensity ?? 1,
    })
    const session = useSessionStore.getState()
    const choices = soundChoicesForKit(role, kit)
    const used = session.tracks
      .filter((t) => t.role === role)
      .map((t) => choices.find((c) => matchSoundChoice(t.code, c))?.id)
      .filter((id): id is string => !!id)
    const voice = pickRandomSoundChoice(role, kit, used)
    if (voice) code = applySoundChoiceToCode(code, voice, role)
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
    volume: defaultTrackVolume(preset.role),
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
  opts?: { remap?: boolean; walkLength?: WalkLength },
): { ok: true; root: string; scale: ScaleKind; remapped: number; walkLength: number } {
  const jam = useJamStore.getState()
  const prevRoot = jam.songRoot
  const prevScale = jam.songScale
  jam.setSongRoot(root)
  jam.setSongScale(scale)
  const existing = jam.songSeed
  const nextSeed = existing
    ? retargetSeed(existing, root, scale, { walkLength: opts?.walkLength })
    : rollSeed({ root, scale, vibe: jam.vibe, walkLength: opts?.walkLength })
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
  return { ok: true, root, scale, remapped, walkLength: nextSeed.walk.length }
}

/** Dice: new root + scale + walk length ∈ {2,3,4} (never 1); reshuffle unlocked melodic to match. */
export function rollSongHarmony(): {
  ok: true
  root: string
  scale: ScaleKind
  remapped: number
  walkLength: number
} {
  const jam = useJamStore.getState()
  const curLen = jam.songSeed?.walk.length
  const avoid: WalkLength | undefined =
    curLen === 1 || curLen === 2 || curLen === 3 || curLen === 4 ? curLen : undefined
  const root = randomSongRoot(jam.songRoot)
  const scale = randomSongScale(jam.songScale)
  const walkLength = randomWalkLength(avoid)

  endTakeIfCapturing()
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  const resolved = activeKit ? resolveShuffleProfile(activeKit) : null
  const existing = jam.songSeed
  const nextSeed = existing
    ? retargetSeed(existing, root, scale, { walkLength })
    : rollSeed({
        root,
        scale,
        vibe: activeKit?.vibe ?? jam.vibe,
        density: resolved?.density ?? 'mid',
        groove: resolved?.groove ?? 'four_on_floor',
        fxBias: resolved?.fxBias ?? 'dry',
        walkLength,
      })

  jam.setSongRoot(root)
  jam.setSongScale(scale)
  jam.setSongSeed(nextSeed)

  jam.resetWalkDensity()
  const pinEffects = useUIStore.getState().pinEffects
  const state = useSessionStore.getState()
  let remapped = 0
  for (const t of state.tracks) {
    if (!isMelodicRole(t.role)) continue
    if (t.locked) continue
    if (isPadsKeepTrack(t)) continue
    let next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
      seed: nextSeed,
      walkDensity: 1,
      bpm: state.bpm,
      takeSec: micTakeSecForCode(t.code),
    })
    const oct = t.octave ?? 0
    if (oct) next = shiftNotesByOctaves(next, oct)
    if (next !== t.code) remapped++
    state.setCode(t.id, next)
  }
  dropSpawnedPad()
  dropSpawnedBass()
  jam.resetIntensitySession()
  jam.resetSongTimeFeel()
  jam.setLastPeek(`Key · ${root} ${scale} · walk ${nextSeed.walk.length}`)
  queueLive('reshuffle')
  return { ok: true, root, scale, remapped, walkLength: nextSeed.walk.length }
}



export function setWalkLength(
  n: WalkLength,
): { ok: true; walkLength: WalkLength; patternId: string } | { ok: false; error: string } {
  if (n !== 1 && n !== 2 && n !== 3 && n !== 4) {
    return { ok: false, error: `Walk length must be 1–4 (got ${n})` }
  }
  const jam = useJamStore.getState()
  if (jam.songSeed && jam.songSeed.walk.length === n) {
    jam.setLastPeek(`Walk · ${n}`)
    return { ok: true, walkLength: n, patternId: jam.songSeed.patternId }
  }
  endTakeIfCapturing()
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  const resolved = activeKit ? resolveShuffleProfile(activeKit) : null
  const density = resolved?.density ?? 'mid'
  const groove = resolved?.groove ?? 'four_on_floor'
  const fxBias = resolved?.fxBias ?? 'dry'
  const vibe = activeKit?.vibe ?? jam.vibe
  const pat = pickWalkOfLength(jam.songScale, n, vibe, density)
  const existing = jam.songSeed
  const seed: SongSeed = existing
    ? {
        ...existing,
        walk: pat.centers.map((c) => ({ ...c })),
        patternId: pat.id,
      }
    : rollSeed({
        root: jam.songRoot,
        scale: jam.songScale,
        vibe,
        density,
        groove,
        fxBias,
        walkLength: n,
      })
  jam.setSongSeed(seed)
  jam.resetWalkDensity()
  const pinEffects = useUIStore.getState().pinEffects
  const state = useSessionStore.getState()
  for (const t of state.tracks) {
    if (!isMelodicRole(t.role)) continue
    if (t.locked) continue
    if (isPadsKeepTrack(t)) continue
    let next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
      seed,
      walkDensity: 1,
      bpm: state.bpm,
      takeSec: micTakeSecForCode(t.code),
    })
    const oct = t.octave ?? 0
    if (oct && isMelodicRole(t.role)) next = shiftNotesByOctaves(next, oct)
    state.setCode(t.id, next)
  }
  dropSpawnedPad()
  dropSpawnedBass()
  jam.resetIntensitySession()
  jam.resetSongTimeFeel()
  jam.setLastPeek(`Walk · ${n}`)
  queueLive('reshuffle')
  return { ok: true, walkLength: n, patternId: seed.patternId }
}

export function setWalkCenter(
  index: number,
  center: WalkCenter,
):
  | { ok: true; walkLength: number; patternId: string; concertNames: string[]; noop?: true }
  | { ok: false; error: string } {
  const jam = useJamStore.getState()
  const existing = jam.songSeed
  if (!existing || !existing.walk.length) {
    return { ok: false, error: 'No song walk to edit' }
  }
  const n = existing.walk.length
  if (!Number.isInteger(index) || index < 0 || index >= n) {
    return { ok: false, error: `Walk index must be 0..${n - 1} (got ${index})` }
  }
  const nextCenter: WalkCenter = { degree: center.degree, quality: center.quality }
  const prev = existing.walk[index]!
  if (prev.degree === nextCenter.degree && prev.quality === nextCenter.quality) {
    jam.setLastPeek(`Walk · ${formatConcertChord(existing.root, prev)}`)
    return {
      ok: true,
      walkLength: n,
      patternId: existing.patternId,
      concertNames: existing.walk.map((c) => formatConcertChord(existing.root, c)),
      noop: true,
    }
  }
  const nextWalk = existing.walk.map((c, i) => (i === index ? nextCenter : { ...c }))
  if (!isLegalWalk(existing.scale, nextWalk)) {
    return {
      ok: false,
      error: `Illegal walk chord ${formatConcertChord(existing.root, nextCenter)} at slot ${index} for ${existing.scale}`,
    }
  }
  endTakeIfCapturing()
  const seed: SongSeed = {
    ...existing,
    walk: nextWalk,
    patternId: 'custom',
  }
  jam.setSongSeed(seed)
  jam.resetWalkDensity()
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  const pinEffects = useUIStore.getState().pinEffects
  const state = useSessionStore.getState()
  for (const t of state.tracks) {
    if (!isMelodicRole(t.role)) continue
    if (t.locked) continue
    if (isPadsKeepTrack(t)) continue
    let next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
      seed,
      walkDensity: 1,
      bpm: state.bpm,
      takeSec: micTakeSecForCode(t.code),
    })
    const oct = t.octave ?? 0
    if (oct && isMelodicRole(t.role)) next = shiftNotesByOctaves(next, oct)
    state.setCode(t.id, next)
  }
  dropSpawnedPad()
  dropSpawnedBass()
  jam.resetIntensitySession()
  jam.resetSongTimeFeel()
  const concertNames = nextWalk.map((c) => formatConcertChord(seed.root, c))
  jam.setLastPeek(`Walk · ${concertNames.join(' · ')}`)
  queueLive('reshuffle')
  return { ok: true, walkLength: n, patternId: seed.patternId, concertNames }
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

function dropSpawnedBass() {
  const jam = useJamStore.getState()
  if (!jam.spawnedBassId) return
  useSessionStore.getState().removeTrack(jam.spawnedBassId)
  jam.setSpawnedBassId(null)
}

function generateRoleCode(role: 'pad' | 'arp' | 'lead' | 'fx' | 'bass'): { code: string; name: string; color: string } {
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
      walkDensity: jam.walkDensity ?? 1,
  })
  const session = useSessionStore.getState()
  const choices = soundChoicesForKit(role, kit)
  const used = session.tracks
    .filter((tr) => tr.role === role)
    .map((tr) => choices.find((c) => matchSoundChoice(tr.code, c))?.id)
    .filter((id): id is string => !!id)
  const voice = pickRandomSoundChoice(role, kit, used)
  if (voice) code = applySoundChoiceToCode(code, voice, role)
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

/** L4-owned bass when kit has none — densified walk @0.5 like normal L4 bass. */
function spawnIntensityBass(): Track {
  const jam = useJamStore.getState()
  const built = generateRoleCode('bass')
  const code = densifyL4(built.code, 'bass', false)
  const id = useSessionStore.getState().addTrack({
    name: built.name,
    role: 'bass',
    code,
    color: built.color,
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  })
  jam.setSpawnedBassId(id)
  jam.touchTrack(id)
  return useSessionStore.getState().tracks.find((tr) => tr.id === id)!
}

function liveSpawnedPad(): Track | null {
  const jam = useJamStore.getState()
  if (!jam.spawnedPadId) return null
  return useSessionStore.getState().tracks.find((tr) => tr.id === jam.spawnedPadId) ?? null
}

function liveSpawnedBass(): Track | null {
  const jam = useJamStore.getState()
  if (!jam.spawnedBassId) return null
  return useSessionStore.getState().tracks.find((tr) => tr.id === jam.spawnedBassId) ?? null
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

function attachSpawnedBass(bass: Track) {
  const jam = useJamStore.getState()
  const cur = jam.spawnedBassId
  if (cur && cur !== bass.id) useSessionStore.getState().removeTrack(cur)
  if (!useSessionStore.getState().tracks.some((tr) => tr.id === bass.id)) {
    useSessionStore.getState().addTrack({ ...bass, id: bass.id })
  } else {
    useSessionStore.getState().setCode(bass.id, bass.code)
  }
  jam.setSpawnedBassId(bass.id)
}

function applyHatMuteOverlay(mutes: IntensityHatMute[] | null | undefined) {
  if (!mutes?.length) return
  const session = useSessionStore.getState()
  for (const m of mutes) {
    if (!session.tracks.some((t) => t.id === m.id)) continue
    session.setMuted(m.id, m.muted)
    session.setVolume(m.id, m.volume)
  }
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

/** Preserve L3/L4 extra fields when rewriting codes/spawnedPad. */
function mergeSnap(level: IntensityLevel, patch: Partial<IntensitySnap>): IntensitySnap {
  const prev = useJamStore.getState().intensitySnaps[level]
  return {
    codes: patch.codes ?? prev?.codes ?? [],
    spawnedPad: patch.spawnedPad !== undefined ? patch.spawnedPad : (prev?.spawnedPad ?? null),
    hatMutes: patch.hatMutes !== undefined ? patch.hatMutes : prev?.hatMutes,
    hatMutesPrior: patch.hatMutesPrior !== undefined ? patch.hatMutesPrior : prev?.hatMutesPrior,
    spawnedBass: patch.spawnedBass !== undefined ? patch.spawnedBass : prev?.spawnedBass,
  }
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
      next.spawnedPad === snap.spawnedPad &&
      next.spawnedBass === snap.spawnedBass
    ) {
      continue
    }
    jam.saveIntensitySnap(lvl, next)
  }
}

function ensureL1Base(spawnId: string | null, bassId: string | null = null) {
  const jam = useJamStore.getState()
  if (jam.intensitySnaps[1]) return
  const tracks = useSessionStore.getState().tracks
  jam.saveIntensitySnap(1, captureL1BaseSnap(tracks, spawnId, bassId ?? jam.spawnedBassId))
}

function saveSnapCodes(
  level: IntensityLevel,
  codes: { id: string; code: string }[],
  spawnedPad: Track | null,
) {
  useJamStore.getState().saveIntensitySnap(level, mergeSnap(level, { codes, spawnedPad }))
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
  const bass = liveSpawnedBass()
  const bassId = bass?.id ?? null
  ensureL1Base(spawnId, bassId)

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
        const s4 = snapCodeMap(jam.intensitySnaps[4])
        // Prefer any L4 in-level overlay (densify OR snare/rim/clap L4-only edit).
        if (s4.has(c.id)) {
          code = s4.get(c.id)!
        } else {
          const keys = isKeysTrack(tr)
          const base = code
          if (intensityL4TouchesTrack(tr.role, keys, base, (cd, r) => densifyL4(cd, r, keys), tr)) {
            code = densifyL4(base, tr.role, keys)
          }
        }
      }
    }
    expected.set(c.id, code)
  }

  for (const tr of session.tracks) {
    if (spawnId && tr.id === spawnId) continue
    if (bassId && tr.id === bassId) continue
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
      tr,
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
      // L3 owns spawn + hat mute (handled below). Kit *code* edits route to L1 or L2.
      if (l2Owned) {
        // Hat code edit while at L3 → still L2-owned (densify codes).
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
    // At L4: densify-owned OR any other kit edit (snare/rim/clap, pad, …) stays on
    // snap[4] only — never write downward to L1. Realize ≤3 re-applies L1(+L2).
    updateOwnedCode(4, tr.id, tr.code)
    continue
  }

  // Spawn ownership
  if (from === 3) {
    const prev = jam.intensitySnaps[3]?.spawnedPad
    const hats = captureHatMutes(session.tracks)
    jam.saveIntensitySnap(
      3,
      mergeSnap(3, {
        codes: [],
        spawnedPad: spawn ? { ...spawn } : null,
        hatMutes: hats,
      }),
    )
    if (spawn && (!prev || prev.code !== spawn.code || prev.id !== spawn.id)) {
      invalidateTrackAbove(spawn.id, 3)
    }
  } else if (from === 4) {
    // L4-only pad + densify/snare overlays + bass — never write downward to L1/L3.
    // Re-read snaps after per-track updateOwnedCode; a stale `jam` would clobber
    // every L4 in-level overlay (kick densify, snare/rim edit, bass/keys walk).
    const jamNow = useJamStore.getState()
    const s4 = jamNow.intensitySnaps[4] ?? { codes: [], spawnedPad: null }
    let codes = [...s4.codes]
    const l1Now = snapCodeMap(jamNow.intensitySnaps[1])
    const l2Now = snapCodeMap(jamNow.intensitySnaps[2])
    for (const tr of session.tracks) {
      if (spawnId && tr.id === spawnId) continue
      if (bassId && tr.id === bassId) continue
      if (tr.role === 'hihats') continue
      const keys = isKeysTrack(tr)
      const l1Code = l1Now.get(tr.id) ?? tr.code
      const l2Owned = intensityL2TouchesTrack(tr.role, l1Code, densifyL2)
      const l2Code = l2Now.has(tr.id)
        ? l2Now.get(tr.id)!
        : l2Owned
          ? densifyL2(l1Code, tr.role)
          : l1Code
      const densifyOwned = intensityL4TouchesTrack(
        tr.role,
        keys,
        l2Code,
        (cd, r) => densifyL4(cd, r, keys),
        tr,
      )
      // Densify lanes + L4-only overlays (snare/rim/clap etc.): upsert live into snap[4].
      // Skip when live still equals composed lower and no prior L4 overlay — no paste.
      const hadOverlay = codes.some((c) => c.id === tr.id)
      if (!densifyOwned && tr.code === l2Code && !hadOverlay) continue
      codes = upsertSnapCode(codes, tr.id, tr.code)
    }
    if (bass) codes = upsertSnapCode(codes, bass.id, bass.code)
    jamNow.saveIntensitySnap(
      4,
      mergeSnap(4, {
        codes,
        spawnedPad: spawn ? { ...spawn } : null,
        spawnedBass: bass ? { ...bass } : null,
      }),
    )
  } else if (from <= 2) {
    // Leaving L1/L2: kit already handled; ensure L1 snapshot is current for kit.
    if (from === 1) {
      jam.saveIntensitySnap(1, captureL1BaseSnap(session.tracks, spawnId, bassId))
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
  const bass = liveSpawnedBass()
  const s1 = jam.intensitySnaps[1]
  if (!s1) return
  const l1Map = snapCodeMap(s1)

  if (level === 2) {
    const existing = snapCodeMap(jam.intensitySnaps[2])
    let codes = [...(jam.intensitySnaps[2]?.codes ?? [])]
    for (const tr of session.tracks) {
      if (spawnId && tr.id === spawnId) continue
      if (bass && tr.id === bass.id) continue
      const l1 = l1Map.get(tr.id) ?? tr.code
      if (!intensityL2TouchesTrack(tr.role, l1, densifyL2)) continue
      if (existing.has(tr.id)) continue
      codes = upsertSnapCode(codes, tr.id, tr.code)
    }
    saveSnapCodes(2, codes, null)
    return
  }

  if (level === 3) {
    const s3 = jam.intensitySnaps[3]
    if (!s3?.spawnedPad && spawn) {
      jam.saveIntensitySnap(
        3,
        mergeSnap(3, { codes: [], spawnedPad: { ...spawn } }),
      )
    }
    // Hat mute seed happens in realizeIntensityLevel on first enter.
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
      if (!intensityL4TouchesTrack(tr.role, keys, lower, (cd, r) => densifyL4(cd, r, keys), tr)) {
        continue
      }
      if (existing.has(tr.id)) continue
      codes = upsertSnapCode(codes, tr.id, tr.code)
    }
    // First visit / invalidated L4 spawn: start from L3 pad.
    const l3Pad = jam.intensitySnaps[3]?.spawnedPad ?? spawn
    const pad = s4.spawnedPad ?? (l3Pad ? { ...l3Pad } : null)
    if (bass) codes = upsertSnapCode(codes, bass.id, bass.code)
    jam.saveIntensitySnap(
      4,
      mergeSnap(4, {
        codes,
        spawnedPad: pad,
        spawnedBass: bass ? { ...bass } : s4.spawnedBass ?? null,
      }),
    )
  }
}

/**
 * Realize by compositing partial overlays — never restore a full-jam tape.
 * L1 base → L2 hat overlay if ≥2 → L3 spawn + hat mute if ≥3 → L4 densify (+ bass) if 4.
 */
function realizeIntensityLevel(target: IntensityLevel) {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  ensureL1Base(jam.spawnedPadId, jam.spawnedBassId)

  const s1 = jam.intensitySnaps[1]!
  const l1Map = snapCodeMap(s1)
  const s2 = jam.intensitySnaps[2]
  const l2Map = snapCodeMap(s2)
  const s3 = jam.intensitySnaps[3]
  const s4 = jam.intensitySnaps[4]
  const l4Map = snapCodeMap(s4)

  // Drop intensity-owned spawns first; kit rebuild from L1.
  dropSpawnedPad()
  dropSpawnedBass()

  // Apply L1 base to existing kit tracks.
  for (const c of s1.codes) {
    if (session.tracks.some((tr) => tr.id === c.id)) {
      useSessionStore.getState().setCode(c.id, c.code)
    }
  }

  if (target <= 1) {
    // Leaving arrangement levels: restore pre-L3 hats if we still have prior.
    if (s3?.hatMutesPrior) applyHatMuteOverlay(s3.hatMutesPrior)
    return
  }

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

  if (target === 2) {
    // Drop L3 hat overlay → prior L2/L1 mute/volume.
    if (s3?.hatMutesPrior) applyHatMuteOverlay(s3.hatMutesPrior)
    return
  }

  // L3 spawn + hat mute arrangement
  if (target === 3) {
    if (s3?.spawnedPad) attachSpawnedPad(s3.spawnedPad)
    else spawnIntensityLane(3)

    if (s3?.hatMutes) {
      applyHatMuteOverlay(s3.hatMutes)
    } else {
      // First 2→3: capture prior, apply default mute, store both on L3 snap.
      const live = useSessionStore.getState().tracks
      const prior = captureHatMutes(live)
      const defaults = defaultL3HatMutes(live)
      applyHatMuteOverlay(defaults)
      const pad = liveSpawnedPad()
      jam.saveIntensitySnap(
        3,
        mergeSnap(3, {
          codes: [],
          spawnedPad: pad ? { ...pad } : s3?.spawnedPad ?? null,
          hatMutes: defaults,
          hatMutesPrior: prior,
        }),
      )
    }
    return
  }

  // target === 4: densify overlays, then spawn (L4 slot or L3 carry), then L4 bass if missing.
  // Hats: restore prior (densify bed) without erasing L3 hatMutes memory.
  {
    const fresh = useSessionStore.getState()
    const spawnSkip = s4?.spawnedPad?.id ?? s3?.spawnedPad?.id ?? null
    for (const tr of fresh.tracks) {
      if (tr.locked) continue
      if (spawnSkip && tr.id === spawnSkip) continue
      if (tr.role === 'hihats') continue // L4 must not rewrite hats
      const overlay = l4Map.get(tr.id)
      // Prefer snap[4] overlay for densify AND L4-only snare/rim/clap edits.
      if (overlay != null) {
        if (overlay !== tr.code) fresh.setCode(tr.id, overlay)
        continue
      }
      const keys = isKeysTrack(tr)
      const l1 = l1Map.get(tr.id) ?? tr.code
      const lower = intensityL2TouchesTrack(tr.role, l1, densifyL2)
        ? l2Map.get(tr.id) ?? densifyL2(l1, tr.role)
        : l1
      // Current live may already be lower after L2 pass.
      const base = fresh.tracks.find((t) => t.id === tr.id)?.code ?? lower
      if (!intensityL4TouchesTrack(tr.role, keys, base, (cd, r) => densifyL4(cd, r, keys), tr)) {
        continue
      }
      const next = densifyL4(base, tr.role, keys)
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

  // L4 bass: restore L4-owned spawn, or create one if kit still has no bass.
  if (s4?.spawnedBass) {
    attachSpawnedBass(s4.spawnedBass)
  } else if (!useSessionStore.getState().tracks.some((tr) => tr.role === 'bass')) {
    spawnIntensityBass()
  }

  // Densify bed: unmute/restore hats from prior without touching L3 hatMutes snap.
  if (s3?.hatMutesPrior) {
    applyHatMuteOverlay(s3.hatMutesPrior)
  } else {
    const hats = useSessionStore.getState().tracks.filter((t) => t.role === 'hihats')
    for (const h of hats) {
      useSessionStore.getState().setMuted(h.id, false)
      useSessionStore.getState().setVolume(h.id, defaultTrackVolume('hihats'))
    }
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
  const beforeBass = liveSpawnedBass()
  // Full live tape for Undo only — snaps stay partial.
  const beforeCodes = session.tracks.map((tr) => ({
    id: tr.id,
    code: tr.code,
    muted: tr.muted,
    volume: tr.volume,
  }))

  commitIntensityEdits(from)
  realizeIntensityLevel(to)
  seedMissingOverlays(to)
  jam.setIntensityLevel(to)

  const after = useSessionStore.getState()
  const addedTrackIds = after.tracks.filter((tr) => !beforeIds.includes(tr.id)).map((tr) => tr.id)
  const removedTracks: Track[] = []
  if (beforePad && !after.tracks.some((tr) => tr.id === beforePad.id)) removedTracks.push(beforePad)
  if (beforeBass && !after.tracks.some((tr) => tr.id === beforeBass.id)) removedTracks.push(beforeBass)
  const primary = beforeCodes[0]
  jam.pushUndo({
    trackId: primary?.id ?? after.tracks[0]?.id ?? 'track-1',
    code: primary?.code ?? '',
    label: `Intensity ${to}/4`,
    batch: beforeCodes.map((c) => ({
      trackId: c.id,
      code: c.code,
      muted: c.muted,
      volume: c.volume,
    })),
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

/** Set walk chords-per-cycle (1 stretch · 2 densified) and reshuffle unlocked melodic. Idempotent. */
export function setWalkDensity(
  density: 1 | 2,
): { ok: true; walkDensity: 1 | 2; changed: number; noop: boolean } | { ok: false; error: string } {
  if (density !== 1 && density !== 2) {
    return { ok: false, error: `walkDensity must be 1 or 2 (got ${density})` }
  }
  const jam = useJamStore.getState()
  if ((jam.walkDensity ?? 1) === density) {
    jam.setLastPeek(density === 2 ? 'Densify walk · already' : 'Undensify walk · already')
    return { ok: true, walkDensity: density, changed: 0, noop: true }
  }
  endTakeIfCapturing()
  jam.setWalkDensity(density)
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  const pinEffects = useUIStore.getState().pinEffects
  const session = useSessionStore.getState()
  const snaps: { trackId: string; code: string }[] = []
  let changed = 0
  for (const tr of session.tracks) {
    if (!isMelodicRole(tr.role)) continue
    if (tr.locked) continue
    if (isPadsKeepTrack(tr)) continue
    snaps.push({ trackId: tr.id, code: tr.code })
    let next = reshuffleTrack(tr.role, tr.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
      seed: jam.songSeed,
      walkDensity: density,
      bpm: session.bpm,
      takeSec: micTakeSecForCode(tr.code),
    })
    const oct = tr.octave ?? 0
    if (oct && isMelodicRole(tr.role)) next = shiftNotesByOctaves(next, oct)
    session.setCode(tr.id, next)
    changed++
  }
  if (snaps.length) {
    const primary = snaps[0]!
    jam.pushUndo({
      trackId: primary.trackId,
      code: primary.code,
      label: density === 2 ? 'Mutate · Densify walk' : 'Mutate · Undensify walk',
      batch: snaps.length > 1 ? snaps : undefined,
    })
  }
  dropSpawnedPad()
  dropSpawnedBass()
  jam.resetIntensitySession()
  jam.resetSongTimeFeel()
  jam.setLastPeek(density === 2 ? 'Densify walk · 2/cycle' : 'Undensify walk · 1/cycle')
  queueLive('reshuffle')
  return { ok: true, walkDensity: density, changed, noop: false }
}


/** Song Half/Double-time once-only ternary: normal↔half | normal↔double; opposite restores normal. */
export function applySongTimeFeel(
  target: 'half' | 'double',
): { ok: true; id: MutateId; label: string; changed: number; noop: boolean; feel: SongTimeFeel } | { ok: false; error: string } {
  const def = getMutation(target === 'half' ? 'half-time' : 'double-time')
  if (!def) return { ok: false, error: `Unknown mutate: ${target}-time` }
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  const feel: SongTimeFeel = jam.songTimeFeel ?? 'normal'

  if (feel === target) {
    jam.setLastPeek(`Mutate · ${def.label} · already`)
    return { ok: true, id: def.id, label: def.label, changed: 0, noop: true, feel }
  }

  const prevFeel = feel
  const prevBase = jam.songTimeFeelBase
    ? jam.songTimeFeelBase.map((c) => ({ ...c }))
    : null

  // Opposite pole → restore normal (base snapshot preferred; else inverse transform)
  if ((feel === 'half' && target === 'double') || (feel === 'double' && target === 'half')) {
    const beforeCodes = session.tracks.map((t) => ({ trackId: t.id, code: t.code }))
    let changed = 0
    if (prevBase && prevBase.length) {
      for (const snap of prevBase) {
        const tr = session.tracks.find((t) => t.id === snap.trackId)
        if (!tr || tr.locked) continue
        if (tr.code !== snap.code) {
          session.setCode(snap.trackId, snap.code)
          changed++
        }
      }
    } else {
      // Inverse: double undoes half cleanly; half approx-undoes double when no base
      const inverseId: MutateId = feel === 'half' ? 'double-time' : 'half-time'
      const prefer = jam.lastTouchedTrackId ?? session.activeTrackId
      const result = applyMutateToTracks(session.tracks, inverseId, prefer)
      if (result) {
        for (const c of result.changes) {
          session.setCode(c.trackId, c.code)
          changed++
        }
      }
    }
    jam.setSongTimeFeel('normal')
    jam.setSongTimeFeelBase(null)
    const primary = beforeCodes[0]
    jam.pushUndo({
      trackId: primary?.trackId ?? session.tracks[0]?.id ?? 'track-1',
      code: primary?.code ?? '',
      label: `Mutate · ${def.label}`,
      batch: beforeCodes.length > 1 ? beforeCodes : undefined,
      songTimeFeel: prevFeel,
      songTimeFeelBase: prevBase,
    })
    jam.setLastPeek(`Mutate · ${def.label} · normal`)
    queueLive('jam')
    return { ok: true, id: def.id, label: def.label, changed, noop: false, feel: 'normal' }
  }

  // From normal → apply transform; snapshot pre-feel codes
  const prefer = jam.lastTouchedTrackId ?? session.activeTrackId
  const result = applyMutateToTracks(session.tracks, def.id, prefer)
  if (!result) {
    jam.setLastPeek(`Mutate · ${def.label} · (no change)`)
    return { ok: false, error: 'Nothing to mutate' }
  }
  const base = result.changes.map((c) => {
    const t = session.tracks.find((x) => x.id === c.trackId)!
    return { trackId: t.id, code: t.code }
  })
  const primary = base[0]!
  jam.pushUndo({
    trackId: primary.trackId,
    code: primary.code,
    label: `Mutate · ${result.label}`,
    batch: base.length > 1 ? base : undefined,
    songTimeFeel: prevFeel,
    songTimeFeelBase: null,
  })
  for (const c of result.changes) {
    session.setCode(c.trackId, c.code)
  }
  jam.setSongTimeFeel(target)
  jam.setSongTimeFeelBase(base)
  jam.setLastPeek(`Mutate · ${result.label} · song`)
  queueLive('jam')
  return { ok: true, id: result.id, label: result.label, changed: result.changes.length, noop: false, feel: target }
}

export function applyMutate(
  mutateId: MutateId | string,
  opts?: { trackId?: string },
): { ok: true; id: MutateId; label: string; changed: number } | { ok: false; error: string } {
  const def = getMutation(mutateId)
  if (!def) return { ok: false, error: `Unknown mutate: ${mutateId}` }
  if (def.id === 'intensity-up' || def.id === 'intensity-down') {
    return applyIntensityDir(def.id === 'intensity-up' ? 1 : -1)
  }
  if (def.id === 'half-time' || def.id === 'double-time') {
    const r = applySongTimeFeel(def.id === 'half-time' ? 'half' : 'double')
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, id: r.id, label: r.label, changed: r.changed }
  }
  if (def.id === 'densify-walk' || def.id === 'undensify-walk') {
    const r = setWalkDensity(def.id === 'densify-walk' ? 2 : 1)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, id: def.id, label: def.label, changed: r.changed }
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
