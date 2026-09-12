/**
 * Shared Jam kit/AB actions (part A) — used by UI + WebMCP.
 */
import { useSessionStore } from '../store/session-store'
import { useJamStore, type AbSlot } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'
import { KITS, getKit, kitToTemplate } from './kits'
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
import { applyMutateToTracks, getMutation, type MutateId } from './mutate'
import { planShuffleTargets } from './shuffle-lock'

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

export function applyKit(
  id: string,
  opts?: { fromPicker?: boolean; randomizeRoot?: boolean },
): { ok: true; kitId: string; name: string; bpm: number; preservedBpm: boolean } | { ok: false; error: string } {
  const kit = getKit(id)
  if (!kit) return { ok: false, error: `Unknown kit: ${id}` }
  const resolved = resolveShuffleProfile(kit)
  const jam = useJamStore.getState()
  // First kit of choice (randomizeRoot): new home + scale from full pools.
  // After that (picker / New kit / hasPickedKit): keep current root AND scale.
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
  const jam = useJamStore.getState()
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
      applyKit(preferred.id, { randomizeRoot: !jam.hasPickedKit })
      kitName = preferred.name
    }
    // applyKit already generated — do not reshuffle again.
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

/** Apply a named Mutate transform. Song scope = all unlocked; else trackId / last-touched. */
export function applyMutate(
  mutateId: MutateId | string,
  opts?: { trackId?: string },
): { ok: true; id: MutateId; label: string; changed: number } | { ok: false; error: string } {
  const def = getMutation(mutateId)
  if (!def) return { ok: false, error: `Unknown mutate: ${mutateId}` }
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
