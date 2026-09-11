// @ts-nocheck — split module; unused imports OK
import { ok, fail, okText, kitBanksList, type WebMcpRegister } from './webmcp-helpers'
import { useSessionStore } from '../store/session-store'
import { evaluateCode, stop, composeTracks, initEngine } from './strudel'
import { resumeAudioContext } from './audio-context'
import { STRUDEL_REFERENCE } from './strudel-reference'
import { drumsBankShortName } from './kit-browser'
import { isMicRecording } from './mic-sample'
import { searchStrudelDocs } from './strudel-docs-index'
import {
  stashAb,
  punchAb,
  toggleAb,
  setFx,
  openCodeSheet,
  closeCodeSheet,
  applyMutate,
  spiceTracks,
  PINNABLE_EFFECTS,
} from './jam-actions'
import { MUTATIONS } from './mutate'
import type { AbSlot } from '../store/jam-store'

export function registerWebMcpToolsB1(register: WebMcpRegister) {
  register({
    name: 'set_fx',
    description:
      'Set or clear a code effect on a track (lpf/hpf/room/roomsize/delay/delaytime/delayfeedback/gain/shape/…). Pass value null or clear:true to remove.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string' },
        effect: {
          type: 'string',
          description: `Effect key. Known: ${[...PINNABLE_EFFECTS].slice(0, 24).join(', ')}…`,
        },
        value: { type: 'number', description: 'Scalar value; omit/null with clear to remove' },
        clear: { type: 'boolean', description: 'Remove the effect' },
      },
      required: ['trackId', 'effect'],
    },
    execute: ({
      trackId,
      effect,
      value,
      clear,
    }: {
      trackId: string
      effect: string
      value?: number | null
      clear?: boolean
    }) => {
      const v = clear || value === null || value === undefined ? null : value
      if (!clear && value === undefined) {
        return fail('set_fx', { trackId, effect }, 'Provide value or clear:true')
      }
      const r = setFx(trackId, effect, v)
      if (!r.ok) return fail('set_fx', { trackId, effect, value }, r.error)
      return ok('set_fx', { trackId, effect, value: v }, r)
    },
  })
  register({
    name: 'open_code_sheet',
    description: 'Open the Jam Code sheet for a track (setCodeTrackId).',
    inputSchema: {
      type: 'object',
      properties: { trackId: { type: 'string' } },
      required: ['trackId'],
    },
    execute: ({ trackId }: { trackId: string }) => {
      const r = openCodeSheet(trackId)
      if (!r.ok) return fail('open_code_sheet', { trackId }, r.error)
      return ok('open_code_sheet', { trackId }, r)
    },
  })
  register({
    name: 'close_code_sheet',
    description: 'Close the Jam Code sheet.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => ok('close_code_sheet', {}, closeCodeSheet()),
  })
  register({
    name: 'stash_ab',
    description: 'Stash current arrangement into A or B slot.',
    inputSchema: {
      type: 'object',
      properties: { slot: { type: 'string', enum: ['a', 'b'] } },
      required: ['slot'],
    },
    execute: ({ slot }: { slot: AbSlot }) => ok('stash_ab', { slot }, stashAb(slot)),
  })
  register({
    name: 'punch_ab',
    description: 'Punch A or B arrangement (stashes first if empty).',
    inputSchema: {
      type: 'object',
      properties: { slot: { type: 'string', enum: ['a', 'b'] } },
      required: ['slot'],
    },
    execute: ({ slot }: { slot: AbSlot }) => ok('punch_ab', { slot }, punchAb(slot)),
  })
  register({
    name: 'toggle_ab',
    description: 'Toggle between A/B (stash missing slots, then punch the other).',
    inputSchema: { type: 'object', properties: {} },
    execute: () => ok('toggle_ab', {}, toggleAb()),
  })
  register({
    name: 'list_mutations',
    description:
      'Catalog of Jam Mutate transforms (id, label, hint, scope song|track). Song-scope ops apply to all unlocked lanes; track-scope uses last-touched or apply_mutate trackId.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const mutations = MUTATIONS.map((m) => ({
        id: m.id,
        label: m.label,
        hint: m.hint,
        scope: m.scope,
      }))
      return ok('list_mutations', {}, { count: mutations.length, mutations }, `${mutations.length} mutations`)
    },
  })
  register({
    name: 'apply_mutate',
    description:
      'Apply a Mutate transform (same as Mutate sheet). Song-scope = all unlocked (skips locked); track-scope = optional trackId else last-touched/active. Undo snapshots (batch for song).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Mutation id from list_mutations' },
        trackId: { type: 'string', description: 'Optional track for track-scope mutations' },
      },
      required: ['id'],
    },
    execute: ({ id, trackId }: { id: string; trackId?: string }) => {
      const r = applyMutate(id, trackId ? { trackId } : undefined)
      if (!r.ok) return fail('apply_mutate', { id, trackId }, r.error)
      return ok('apply_mutate', { id, trackId }, r, `Mutate · ${r.label}`)
    },
  })
  register({
    name: 'spice',
    description:
      'Same as Jam footer Spice — one FX/timbre nudge (lpf/room/shape/delay/gain). Same tune, not Shuffle. Optional trackId prefers that lane.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string', description: 'Prefer this track; default active' },
      },
    },
    execute: ({ trackId }: { trackId?: string } = {}) => {
      const r = spiceTracks(trackId)
      if (!r.ok) return fail('spice', { trackId }, r.error)
      return ok('spice', { trackId }, r, `Spice · ${r.label}`)
    },
  })
  register({
    name: 'spice_tracks',
    description:
      'Alias of spice — Jam footer Spice FX/timbre nudge on prefer trackId / active / any.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string', description: 'Prefer this track; default active' },
      },
    },
    execute: ({ trackId }: { trackId?: string } = {}) => {
      const r = spiceTracks(trackId)
      if (!r.ok) return fail('spice_tracks', { trackId }, r.error)
      return ok('spice_tracks', { trackId }, r, `Spice · ${r.label}`)
    },
  })

}
