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
import {
  clampTrackOctave,
  isMelodicRole,
  remapNotesToHarmony,
  shiftNotesByOctaves,
} from './note-harmony'
import { liveUpdateEngine, type Quantization } from './live-update'
import { applyMutateToTracks, getMutation, type MutateId } from './mutate'

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
  opts?: { fromPicker?: boolean },
): { ok: true; kitId: string; name: string; bpm: number; preservedBpm: boolean } | { ok: false; error: string } {
  const kit = getKit(id)
  if (!kit) return { ok: false, error: `Unknown kit: ${id}` }
  const template = kitToTemplate(kit)
  const session = useSessionStore.getState()
  const preserveBpm = session.isPlaying
  session.loadTemplate(template, { preserveBpm })
  const jam = useJamStore.getState()
  jam.setKitId(kit.id)
  jam.setVibe(kit.vibe)
  const resolved = resolveShuffleProfile(kit)
  jam.setSongRoot(resolved.root)
  jam.setSongScale(resolved.scale)
  jam.setHasPickedKit(true)
  if (opts?.fromPicker) jam.setShowKitPicker(false)
  reshuffleUnlocked()
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
  let shuffled = 0
  for (const t of state.tracks) {
    if (t.locked) continue
    let next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: songAwareShuffle(activeKit?.shuffle),
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
  const track = state.tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false, error: `Track not found: ${trackId}` }
  if (track.locked) {
    useJamStore.getState().setLastPeek(`Locked · ${track.name}`)
    return { ok: false, error: `Track locked: ${track.name}` }
  }
  const pinEffects = useUIStore.getState().pinEffects
  const jam = useJamStore.getState()
  const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
  let next = reshuffleTrack(track.role, track.code, {
    pinEffects,
    lockKit: jam.lockKit || !!activeKit,
    bank: activeKit?.drumsBank,
    shuffle: songAwareShuffle(activeKit?.shuffle),
  })
  const oct = track.octave ?? 0
  if (oct && isMelodicRole(track.role)) next = shiftNotesByOctaves(next, oct)
  state.setCode(track.id, next)
  jam.touchTrack(track.id)
  jam.setLastPeek(`Shuffle · ${track.name}`)
  queueLive('reshuffle')
  return { ok: true, trackId: track.id, name: track.name }
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
  if (session.tracks.length === 0) {
    const persisted = jam.kitId ? getKit(jam.kitId) : undefined
    const preferred =
      persisted ??
      pickRandomKit(KITS, jam.kitId) ??
      KITS[0]
    if (preferred) {
      randomKit = !persisted
      applyKit(preferred.id)
      kitName = preferred.name
    }
  }

  const { shuffled } = reshuffleUnlocked()

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

/** Apply a named Mutate transform. Song scope = all unlocked; else last-touched track. */
export function applyMutate(
  mutateId: MutateId | string,
): { ok: true; id: MutateId; label: string; changed: number } | { ok: false; error: string } {
  const def = getMutation(mutateId)
  if (!def) return { ok: false, error: `Unknown mutate: ${mutateId}` }
  const session = useSessionStore.getState()
  const jam = useJamStore.getState()
  const prefer = jam.lastTouchedTrackId ?? session.activeTrackId
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
