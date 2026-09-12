// @ts-nocheck — split module; unused imports OK
import { ok, fail, type WebMcpRegister } from './webmcp-helpers'
import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { setBpm } from './strudel'
import { liveUpdateEngine } from './live-update'
import type { TrackRole } from './types'
import {
  applyKit,
  reshuffleUnlocked,
  setLockKit,
  setVolume,
  setActiveTrack,
  listSoundChoices,
  applySoundChoice,
  getJamStateSnapshot,
  getPhaseSnapshot,
  listKitsFiltered,
  getKitDetail,
  addJamTrack,
} from './jam-actions'

export function registerWebMcpToolsA2(register: WebMcpRegister) {
  register({
    name: 'update_track',
    description:
      "Replace a track's Strudel code. Queued on the next cycle boundary when playing. Prefer quantization 1 or 2. Call get_reference / search_strudel_docs before writing code.",
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string', description: 'Track ID' },
        code: { type: 'string', description: 'Complete Strudel code for the track' },
        quantization: { type: 'string', enum: ['1', '2', '4', 'immediate'], description: 'Cycle quantization. Default: 1' },
      },
      required: ['trackId', 'code'],
    },
    execute: ({ trackId, code, quantization = '1' }: { trackId: string; code: string; quantization?: string }) => {
      try {
        const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
        if (!track) return fail('update_track', { trackId }, 'Track not found')
        useSessionStore.getState().setCode(trackId, code)
        useJamStore.getState().touchTrack(trackId)
        if (useSessionStore.getState().isPlaying) {
          liveUpdateEngine.queueUpdate(quantization as any)
        }
        return ok('update_track', { trackId, quantization }, { trackId, status: 'queued', quantization }, 'Track updated')
      } catch (e: any) {
        return fail('update_track', { trackId }, e.message)
      }
    },
  })
  register({
    name: 'add_track',
    description: "Add a new track. If no code provided, generate from the current song seed. Explicit code is used as-is.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Track display name' },
        role: { type: 'string', enum: ['drums', 'hihats', 'bass', 'lead', 'pad', 'arp', 'fx', 'vox', 'custom'], description: 'Track role' },
        code: { type: 'string', description: 'Optional Strudel code' },
      },
      required: ['name', 'role'],
    },
    execute: ({ name, role, code }: { name: string; role: TrackRole; code?: string }) => {
      const r = addJamTrack(role, code ? { name, code } : { name })
      return ok('add_track', { name, role }, { id: r.id, name: r.name, role: r.role, status: 'added' }, `Track "${r.name}" added`)
    },
  })
  register({
    name: 'remove_track',
    description: 'Remove a track by ID. Never remove without asking the user. Keeps ≥1 track.',
    inputSchema: {
      type: 'object',
      properties: { trackId: { type: 'string' } },
      required: ['trackId'],
    },
    execute: ({ trackId }: { trackId: string }) => {
      const before = useSessionStore.getState().tracks.length
      if (before <= 1) {
        return fail('remove_track', { trackId }, 'Need at least one track')
      }
      useSessionStore.getState().removeTrack(trackId)
      const after = useSessionStore.getState().tracks.length
      const removed = after < before
      if (removed && useSessionStore.getState().isPlaying) {
        liveUpdateEngine.queueUpdate('immediate', 'jam')
      }
      if (!removed) return fail('remove_track', { trackId }, 'Track not found')
      return ok('remove_track', { trackId }, { trackId, status: 'removed' })
    },
  })
  register({
    name: 'mute_track',
    description: 'Toggle mute on a track.',
    inputSchema: { type: 'object', properties: { trackId: { type: 'string' } }, required: ['trackId'] },
    execute: ({ trackId }: { trackId: string }) => {
      const before = useSessionStore.getState().tracks.find((t) => t.id === trackId)
      if (!before) return fail('mute_track', { trackId }, 'Track not found')
      useSessionStore.getState().toggleMute(trackId)
      const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
      if (useSessionStore.getState().isPlaying) {
        liveUpdateEngine.markDirty()
        liveUpdateEngine.queueUpdate('immediate', 'mute-solo')
      }
      return ok('mute_track', { trackId }, { trackId, muted: track?.muted })
    },
  })
  register({
    name: 'solo_track',
    description: 'Toggle solo on a track.',
    inputSchema: { type: 'object', properties: { trackId: { type: 'string' } }, required: ['trackId'] },
    execute: ({ trackId }: { trackId: string }) => {
      useSessionStore.getState().toggleSolo(trackId)
      const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
      if (useSessionStore.getState().isPlaying) {
        liveUpdateEngine.markDirty()
        liveUpdateEngine.queueUpdate('immediate', 'mute-solo')
      }
      return ok('solo_track', { trackId }, { trackId, soloed: track?.soloed })
    },
  })
  register({
    name: 'set_volume',
    description: 'Set track volume (0–1.5). Mix change — applied immediately when playing.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string' },
        volume: { type: 'number', minimum: 0, maximum: 1.5 },
      },
      required: ['trackId', 'volume'],
    },
    execute: ({ trackId, volume }: { trackId: string; volume: number }) => {
      const r = setVolume(trackId, volume)
      if (!r.ok) return fail('set_volume', { trackId, volume }, r.error)
      return ok('set_volume', { trackId, volume }, r)
    },
  })
  register({
    name: 'set_active_track',
    description: 'Focus a track (activeTrackId) for editor/quantization defaults.',
    inputSchema: {
      type: 'object',
      properties: { trackId: { type: 'string' } },
      required: ['trackId'],
    },
    execute: ({ trackId }: { trackId: string }) => {
      const r = setActiveTrack(trackId)
      if (!r.ok) return fail('set_active_track', { trackId }, r.error)
      return ok('set_active_track', { trackId }, r)
    },
  })
  register({
    name: 'list_sound_choices',
    description: 'List SOUND_CHOICES for a track role (or active track). Shows which choice is currently matched.',
    inputSchema: {
      type: 'object',
      properties: { trackId: { type: 'string' } },
    },
    annotations: { readOnlyHint: true },
    execute: ({ trackId }: { trackId?: string }) => {
      const r = listSoundChoices(trackId)
      if ('ok' in r && r.ok === false) return fail('list_sound_choices', { trackId }, r.error)
      return ok('list_sound_choices', { trackId }, r, 'Sound choices')
    },
  })
  register({
    name: 'apply_sound_choice',
    description: 'Apply a SOUND_CHOICES id to a track (bank/sound/n via applySoundChoiceToCode).',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string' },
        choiceId: { type: 'string' },
      },
      required: ['trackId', 'choiceId'],
    },
    execute: ({ trackId, choiceId }: { trackId: string; choiceId: string }) => {
      const r = applySoundChoice(trackId, choiceId)
      if (!r.ok) return fail('apply_sound_choice', { trackId, choiceId }, r.error)
      return ok('apply_sound_choice', { trackId, choiceId }, r)
    },
  })
}
