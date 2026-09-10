// @ts-nocheck — split module; unused imports OK
import { ok, fail, type WebMcpRegister } from './webmcp-helpers'
import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { setBpm } from './strudel'
import { liveUpdateEngine } from './live-update'
import { ROLE_PRESETS } from './presets'
import { ROLE_COLORS, type TrackRole } from './types'
import {
  applyKit,
  reshuffleUnlocked,
  reshuffleTrackById,
  setLockKit,
  setVolume,
  setActiveTrack,
  listSoundChoices,
  applySoundChoice,
  getJamStateSnapshot,
  getPhaseSnapshot,
  listKitsFiltered,
  getKitDetail,
} from './jam-actions'

export function registerWebMcpToolsA1(register: WebMcpRegister) {
  register({
    name: 'get_session',
    description:
      'Get the full current Strudel Studio session + Jam state: tracks (name, role, code, muted, soloed, volume, locked), BPM, playback, kitId, A/B active, and cheap phase. Always call this first.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const state = useSessionStore.getState()
      const jam = useJamStore.getState()
      const phase = getPhaseSnapshot()
      const result = {
        bpm: state.bpm,
        isPlaying: state.isPlaying,
        activeTrackId: state.activeTrackId,
        kitId: jam.kitId,
        vibe: jam.vibe,
        lockKit: jam.lockKit,
        ab: {
          a: jam.variantA != null,
          b: jam.variantB != null,
          activeVariant: jam.activeVariant,
        },
        phase: {
          cycle: phase.cycle,
          phase: phase.phase,
          cycleInt: phase.cycleInt,
        },
        tracks: state.tracks.map((t) => ({
          id: t.id,
          name: t.name,
          role: t.role,
          code: t.code,
          muted: t.muted,
          soloed: t.soloed,
          volume: t.volume,
          locked: t.locked,
        })),
      }
      return ok('get_session', {}, result, 'Session state returned')
    },
  })
  register({
    name: 'get_jam_state',
    description:
      'Jam-only snapshot: kitId, vibe, lockKit, A/B slots, activeVariant, lastPeek, deals summary, soundTrackId/codeTrackId.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ok('get_jam_state', {}, getJamStateSnapshot(), 'Jam state'),
  })
  register({
    name: 'get_phase',
    description:
      'Scheduler cycle + normalized phase [0,1). Uses liveUpdateEngine / getSchedulerCycle when available.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ok('get_phase', {}, getPhaseSnapshot(), 'Phase'),
  })
  register({
    name: 'set_bpm',
    description:
      'Set the global tempo in BPM. Updates the session store and, while playing, recomposes the full pattern at the new tempo.',
    inputSchema: {
      type: 'object',
      properties: { bpm: { type: 'number', minimum: 20, maximum: 300, description: 'Beats per minute' } },
      required: ['bpm'],
    },
    execute: ({ bpm }: { bpm: number }) => {
      useSessionStore.getState().setBpm(bpm)
      setBpm(bpm)
      return ok('set_bpm', { bpm }, { bpm, cps: bpm / 60 / 4 }, `BPM set to ${bpm}`)
    },
  })
  register({
    name: 'list_kits',
    description:
      'List Jam kits (id, name, bpm, drumsBank, vibe, description, shuffle{groove,density,root,scale}). Optional search / soft tags (tempo:slow|mid|fast, bank:909, vibe:techno) / vibe / tempo filters.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        vibe: { type: 'string', enum: ['techno', 'lofi', 'ambient', 'house'] },
        tempo: { type: 'string', enum: ['slow', 'mid', 'fast'] },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (args: { search?: string; tags?: string[]; vibe?: string; tempo?: 'slow' | 'mid' | 'fast' }) => {
      const kits = listKitsFiltered(args)
      return ok('list_kits', args as Record<string, unknown>, { count: kits.length, kits }, `${kits.length} kits`)
    },
  })
  register({
    name: 'get_kit',
    description: 'Full kit by id: layout tracks + metadata + shuffle profile (groove/density/root/scale/melodicSounds/fxBias/pinN). Prefer this over inventing mini-notation.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    execute: ({ id }: { id: string }) => {
      const kit = getKitDetail(id)
      if (!kit) return fail('get_kit', { id }, `Unknown kit: ${id}`)
      return ok('get_kit', { id }, kit, kit.name)
    },
  })
  register({
    name: 'apply_kit',
    description:
      'Apply a kit (same as Jam picker): regenerates tracks from the kit shuffle profile, then reshuffles. Peek `kit · Name · shuffled`. While playing, preserves current BPM; when stopped, adopts kit BPM. Redeals mutations/missions.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        fromPicker: { type: 'boolean', description: 'Close kit picker if open' },
      },
      required: ['id'],
    },
    execute: ({ id, fromPicker }: { id: string; fromPicker?: boolean }) => {
      const r = applyKit(id, { fromPicker })
      if (!r.ok) return fail('apply_kit', { id }, r.error)
      return ok('apply_kit', { id }, r, `Applied ${r.name}`)
    },
  })
  register({
    name: 'set_lock_kit',
    description: 'When true, reshuffle keeps the kit drum bank; when false, free bank shuffle.',
    inputSchema: {
      type: 'object',
      properties: { lock: { type: 'boolean' } },
      required: ['lock'],
    },
    execute: ({ lock }: { lock: boolean }) => ok('set_lock_kit', { lock }, setLockKit(lock)),
  })
  register({
    name: 'shuffle_sounds',
    description:
      'Reshuffle unlocked tracks from the active kit shuffle profile + drumsBank when kitId is set (else free pools). Optional trackId reshuffles a single unlocked lane; omit for all unlocked. Respects pinEffects; locked tracks are skipped (single-track returns error if locked/missing).',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: {
          type: 'string',
          description: 'Optional track id — reshuffle only this lane (keep sheet open / one-track mode)',
        },
      },
    },
    execute: ({ trackId }: { trackId?: string } = {}) => {
      if (trackId) {
        const r = reshuffleTrackById(trackId)
        if (!r.ok) return fail('shuffle_sounds', { trackId }, r.error)
        return ok('shuffle_sounds', { trackId }, r, `Shuffled ${r.name}`)
      }
      const r = reshuffleUnlocked()
      return ok('shuffle_sounds', {}, r, `Shuffled ${r.shuffled}`)
    },
  })
}
