/**
 * Shared Jam kit/deal/AB actions (part A) — used by UI + WebMCP.
 */
import { useSessionStore } from '../store/session-store'
import { useJamStore, type AbSlot } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'
import { KITS, getKit, kitToTemplate } from './kits'
import { pickRandomKit } from './kit-browser'
import { suggestMutations, applyMutationToTracks, type MutationCard } from './mutators'
import { suggestMissions, applyMissionToTracks, type MissionCard } from './missions'
import { reshuffleTrack } from './reshuffle'
import { liveUpdateEngine, type Quantization } from './live-update'

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

export function redealDeals() {
  const tracks = useSessionStore.getState().tracks
  const jam = useJamStore.getState()
  jam.setMutationDeal(suggestMutations(tracks, 3))
  jam.setMissionDeal(suggestMissions(tracks, 2))
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
  jam.setHasPickedKit(true)
  if (opts?.fromPicker) jam.setShowKitPicker(false)
  jam.setLastPeek(`kit · ${kit.name}`)
  const nextTracks = useSessionStore.getState().tracks
  jam.setMutationDeal(suggestMutations(nextTracks, 3))
  jam.setMissionDeal(suggestMissions(nextTracks, 2))
  queueLive('kit')
  return {
    ok: true,
    kitId: kit.id,
    name: kit.name,
    bpm: useSessionStore.getState().bpm,
    preservedBpm: preserveBpm,
  }
}

export function applyMutation(
  cardOrId: MutationCard | string,
): { ok: true; trackId: string; label: string } | { ok: false; error: string } {
  const jam = useJamStore.getState()
  const card =
    typeof cardOrId === 'string'
      ? jam.mutationDeal.find((c) => c.id === cardOrId)
      : cardOrId
  if (!card) return { ok: false, error: `Mutation not found: ${String(cardOrId)}` }

  const state = useSessionStore.getState()
  const result = applyMutationToTracks(state.tracks, card)
  if (!result) {
    redealDeals()
    return { ok: false, error: 'Mutation not applicable — deals redealt' }
  }
  const prev = state.tracks.find((t) => t.id === result.trackId)
  if (prev) {
    jam.pushUndo({ trackId: prev.id, code: prev.code, label: card.label })
  }
  state.setCode(result.trackId, result.code)
  jam.setLastPeek(card.label)
  liveUpdateEngine.markDirty()
  queueLive('jam')
  redealDeals()
  return { ok: true, trackId: result.trackId, label: card.label }
}

export function applyMission(
  cardOrId: MissionCard | string,
): { ok: true; trackId: string; label: string } | { ok: false; error: string; already?: boolean } {
  const jam = useJamStore.getState()
  const mission =
    typeof cardOrId === 'string'
      ? jam.missionDeal.find((c) => c.id === cardOrId)
      : cardOrId
  if (!mission) return { ok: false, error: `Mission not found: ${String(cardOrId)}` }

  const state = useSessionStore.getState()
  const result = applyMissionToTracks(state.tracks, mission)
  if (!result) {
    jam.setLastPeek(`Mission · ${mission.label} (already there)`)
    jam.setMissionDeal(suggestMissions(state.tracks, 2))
    return { ok: false, error: 'Mission already satisfied', already: true }
  }
  const prev = state.tracks.find((t) => t.id === result.trackId)
  if (prev) {
    jam.pushUndo({
      trackId: prev.id,
      code: prev.code,
      label: `Mission · ${mission.label}`,
    })
  }
  state.setCode(result.trackId, result.code)
  jam.setLastPeek(`Mission · ${mission.label}`)
  liveUpdateEngine.markDirty()
  queueLive('jam')
  jam.setMissionDeal(suggestMissions(useSessionStore.getState().tracks, 2))
  jam.setMutationDeal(suggestMutations(useSessionStore.getState().tracks, 3))
  return { ok: true, trackId: result.trackId, label: mission.label }
}

export function undoJam(): { ok: true; label: string } | { ok: false; error: string } {
  const entry = useJamStore.getState().popUndo()
  if (!entry) return { ok: false, error: 'Nothing to undo' }
  useSessionStore.getState().setCode(entry.trackId, entry.code)
  useJamStore.getState().setLastPeek(`Undo · ${entry.label}`)
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
    const next = reshuffleTrack(t.role, t.code, {
      pinEffects,
      lockKit: jam.lockKit,
      bank: jam.lockKit ? activeKit?.drumsBank : undefined,
    })
    state.setCode(t.id, next)
    shuffled++
  }
  jam.setLastPeek(jam.lockKit ? 'Shuffle · same kit' : 'Shuffle · free')
  queueLive('reshuffle')
  redealDeals()
  return { ok: true, shuffled, lockKit: jam.lockKit }
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

/**
 * Once per page load (or after bfcache pageshow resets the guard):
 * if no tracks, prefer persisted jam.kitId then pickRandomKit / KITS[0],
 * then always reshuffleUnlocked so reload yields new riffs on the same kit.
 * Still opens the kit picker when the user has never picked a kit.
 */
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
    // Prefer last kit so reload = same kit, new riffs. Else pickRandomKit (exclude current id).
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
  } else if (jam.mutationDeal.length === 0 || jam.missionDeal.length === 0) {
    redealDeals()
  }

  // Always reshuffle after kit apply (or when tracks already present).
  const { shuffled } = reshuffleUnlocked()

  const peek = kitName ? `${kitName} · reshuffled` : 'fresh · reshuffled'
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
