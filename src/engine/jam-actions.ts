/**
 * Shared Jam actions used by useJamShell (and WebMCP later).
 * Keeps fresh-start kit/riff variety out of the React tree.
 */

import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { useUIStore } from '../store/ui-store'
import { KITS, getKit, kitToTemplate } from './kits'
import { pickRandomKit } from './kit-browser'
import { suggestMutations } from './mutators'
import { suggestMissions } from './missions'
import { reshuffleTrack } from './reshuffle'
import { liveUpdateEngine, type Quantization } from './live-update'

export type JamQueueReason = 'kit' | 'jam' | 'reshuffle' | 'mute-solo'

/** Module guard — survives React Strict Mode remount; resets on full page load. */
let freshStartDone = false

export function resetFreshStartGuardForTests() {
  freshStartDone = false
}

function queueLive(
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

function redealDeals() {
  const tracks = useSessionStore.getState().tracks
  const jam = useJamStore.getState()
  jam.setMutationDeal(suggestMutations(tracks, 3))
  jam.setMissionDeal(suggestMissions(tracks, 2))
}

/**
 * Apply a kit recipe (same semantics as JamShell applyKit).
 * Does NOT auto-reshuffle — picker / New Kit leave the recipe as chosen.
 */
export function applyKit(
  id: string,
  opts?: { fromPicker?: boolean },
): { ok: true; kitId: string; name: string } | { ok: false; error: string } {
  const kit = getKit(id)
  if (!kit) return { ok: false, error: `Unknown kit: ${id}` }
  const template = kitToTemplate(kit)
  const session = useSessionStore.getState()
  session.loadTemplate(template, { preserveBpm: session.isPlaying })
  const jam = useJamStore.getState()
  jam.setKitId(kit.id)
  jam.setVibe(kit.vibe)
  jam.setHasPickedKit(true)
  if (opts?.fromPicker) jam.setShowKitPicker(false)
  jam.setLastPeek(`kit · ${kit.name}`)
  redealDeals()
  queueLive('kit')
  return { ok: true, kitId: kit.id, name: kit.name }
}

/** Reshuffle unlocked tracks; lockKit keeps the drum bank when locked. */
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
 * Once per page load: if no tracks, pick a random kit (else persisted / KITS[0]),
 * then always reshuffleUnlocked so cold load / refresh yields varied riffs.
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
    const preferred =
      pickRandomKit(KITS) ??
      (jam.kitId ? getKit(jam.kitId) : undefined) ??
      KITS[0]
    if (preferred) {
      randomKit = true
      applyKit(preferred.id)
      kitName = preferred.name
    }
  } else if (jam.mutationDeal.length === 0 || jam.missionDeal.length === 0) {
    redealDeals()
  }

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
