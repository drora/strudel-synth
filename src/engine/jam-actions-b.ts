/**
 * Shared Jam mix/FX/session snapshot actions (part B) — used by UI + WebMCP.
 */
import { useSessionStore } from '../store/session-store'
import { useJamStore, type AbSlot } from '../store/jam-store'
import {
  KITS,
  getKit,
  SOUND_CHOICES,
  applySoundChoiceToCode,
  matchSoundChoice,
  type SoundChoice,
} from './kits'
import { filterKits } from './kit-browser'
import {
  parseEffectValue,
  setEffectInCode,
  removeEffectFromCode,
  isPatternedEffect,
  PINNABLE_EFFECTS,
} from './code-effects'
import { liveUpdateEngine } from './live-update'
import { getSchedulerCycle } from './strudel'
import type { TrackRole } from './types'
import { queueLive, queueLiveImmediate } from './jam-actions-a'

export function punchAb(slot: AbSlot) {
  useJamStore.getState().punchVariant(slot)
  return { ok: true as const, slot, peek: useJamStore.getState().lastPeek }
}

export function toggleAb() {
  useJamStore.getState().toggleAb()
  return { ok: true as const, peek: useJamStore.getState().lastPeek }
}

export function setLockKit(lock: boolean) {
  useJamStore.getState().setLockKit(lock)
  useJamStore.getState().setLastPeek(lock ? 'Lock kit · on' : 'Lock kit · off')
  return { ok: true as const, lockKit: lock }
}

export function setVolume(trackId: string, volume: number) {
  const session = useSessionStore.getState()
  const track = session.tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false as const, error: 'Track not found' }
  const v = Math.max(0, Math.min(1.5, volume))
  session.setVolume(trackId, v)
  const jam = useJamStore.getState()
  jam.touchTrack(trackId)
  jam.setLastPeek(`${track.name} · vol ${v}`)
  liveUpdateEngine.markDirty()
  queueLiveImmediate('mute-solo')
  return { ok: true as const, trackId, volume: v }
}

export function setActiveTrack(trackId: string) {
  const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false as const, error: 'Track not found' }
  useSessionStore.getState().setActiveTrack(trackId)
  return { ok: true as const, trackId, name: track.name }
}

export function listSoundChoices(trackId?: string): {
  role: TrackRole
  choices: SoundChoice[]
  activeId: string | null
} | { ok: false; error: string } {
  const session = useSessionStore.getState()
  const track = trackId
    ? session.tracks.find((t) => t.id === trackId)
    : session.tracks.find((t) => t.id === session.activeTrackId) ?? session.tracks[0]
  if (!track) return { ok: false, error: 'No track' }
  const choices = SOUND_CHOICES[track.role] ?? SOUND_CHOICES.custom
  const active = choices.find((c) => matchSoundChoice(track.code, c))
  return { role: track.role, choices, activeId: active?.id ?? null }
}

export function applySoundChoice(
  trackId: string,
  choiceId: string,
): { ok: true; label: string } | { ok: false; error: string } {
  const session = useSessionStore.getState()
  const track = session.tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false, error: 'Track not found' }
  const choices = SOUND_CHOICES[track.role] ?? SOUND_CHOICES.custom
  const choice = choices.find((c) => c.id === choiceId)
  if (!choice) return { ok: false, error: `Unknown sound choice: ${choiceId}` }
  const jam = useJamStore.getState()
  jam.pushUndo({
    trackId: track.id,
    code: track.code,
    label: `Sound · ${choice.label}`,
  })
  const next = applySoundChoiceToCode(track.code, choice)
  session.setCode(track.id, next)
  jam.touchTrack(track.id)
  jam.setLastPeek(`Sound · ${choice.label}`)
  queueLive('kit')
  return { ok: true, label: choice.label }
}

export function setFx(
  trackId: string,
  effect: string,
  value: number | null,
): { ok: true; code: string; cleared?: boolean } | { ok: false; error: string } {
  const session = useSessionStore.getState()
  const track = session.tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false, error: 'Track not found' }
  const key = effect.trim()
  if (!PINNABLE_EFFECTS.has(key) && !['roomsize', 'size'].includes(key)) {
    return { ok: false, error: `Unknown or unsupported effect: ${key}` }
  }
  if (isPatternedEffect(track.code, key)) {
    return {
      ok: false,
      error: `FX · ${key} is patterned — edit in Code (open_code_sheet)`,
    }
  }
  const jam = useJamStore.getState()
  const clearing = value == null
  jam.pushUndo({
    trackId: track.id,
    code: track.code,
    label: clearing ? `FX · clear ${key}` : `FX · ${key}(${value})`,
  })
  const next = clearing
    ? removeEffectFromCode(track.code, key)
    : setEffectInCode(track.code, key, value)
  session.setCode(track.id, next)
  jam.touchTrack(track.id)
  jam.setLastPeek(
    clearing
      ? `FX · ${track.name} · ${key} off`
      : `FX · ${track.name} · ${key} ${value}`,
  )
  liveUpdateEngine.markDirty()
  queueLive('jam')
  return { ok: true, code: next, cleared: clearing }
}

export function openCodeSheet(trackId: string) {
  const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false as const, error: 'Track not found' }
  useSessionStore.getState().setActiveTrack(trackId)
  const jam = useJamStore.getState()
  jam.setSoundTrackId(null)
  jam.setCodeTrackId(trackId)
  return { ok: true as const, trackId, name: track.name }
}

export function closeCodeSheet() {
  useJamStore.getState().setCodeTrackId(null)
  return { ok: true as const }
}

export function getJamStateSnapshot() {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  const kit = jam.kitId ? getKit(jam.kitId) : undefined
  return {
    kitId: jam.kitId,
    kitName: kit?.name ?? null,
    vibe: jam.vibe,
    lockKit: jam.lockKit,
    hasPickedKit: jam.hasPickedKit,
    ab: {
      a: jam.variantA != null,
      b: jam.variantB != null,
      activeVariant: jam.activeVariant,
    },
    lastPeek: jam.lastPeek,
    undoDepth: jam.undoStack.length,
    soundTrackId: jam.soundTrackId,
    codeTrackId: jam.codeTrackId,
    bpm: session.bpm,
    isPlaying: session.isPlaying,
    trackCount: session.tracks.length,
  }
}

export function getPhaseSnapshot() {
  const cycle = liveUpdateEngine.getCurrentCycle()
  const schedulerCycle = getSchedulerCycle()
  const cycleInt = Math.floor(cycle)
  return {
    cycle,
    phase: cycle - cycleInt,
    cycleInt,
    schedulerCycle,
    isPlaying: useSessionStore.getState().isPlaying,
  }
}

export function listKitsFiltered(opts?: {
  search?: string
  tags?: string[]
  vibe?: string
  tempo?: 'slow' | 'mid' | 'fast'
}) {
  const tags = [...(opts?.tags ?? [])]
  if (opts?.vibe) tags.push(`vibe:${opts.vibe}`)
  if (opts?.tempo) tags.push(`tempo:${opts.tempo}`)
  const filtered = filterKits(KITS, { search: opts?.search, tags })
  return filtered.map((k) => ({
    id: k.id,
    name: k.name,
    bpm: k.bpm,
    drumsBank: k.drumsBank,
    vibe: k.vibe,
    description: k.description,
    shuffle: {
      groove: k.shuffle.groove,
      density: k.shuffle.density,
      root: k.shuffle.root,
      scale: k.shuffle.scale,
    },
  }))
}

export function getKitDetail(id: string) {
  const kit = getKit(id)
  if (!kit) return null
  return kit
}

export function readFxValue(trackId: string, effect: string): number | null {
  const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
  if (!track) return null
  return parseEffectValue(track.code, effect)
}

export { KITS, SOUND_CHOICES, PINNABLE_EFFECTS }
