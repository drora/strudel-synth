// @ts-nocheck — split module; unused imports OK
import { ok, fail, okText, kitBanksList, type WebMcpRegister } from './webmcp-helpers'
import { useSessionStore } from '../store/session-store'
import { useJamStore } from '../store/jam-store'
import { evaluateCode, stop, composeTracks, initEngine } from './strudel'
import { resumeAudioContext } from './audio-context'
import { STRUDEL_REFERENCE } from './strudel-reference'
import { drumsBankShortName } from './kit-browser'
import { isMicRecording } from './mic-sample'
import { searchStrudelDocs } from './strudel-docs-index'
import {
  applyMutation,
  applyMission,
  undoJam,
  redealDeals,
  stashAb,
  punchAb,
  toggleAb,
  setFx,
  openCodeSheet,
  closeCodeSheet,
  PINNABLE_EFFECTS,
} from './jam-actions'
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
    name: 'list_deals',
    description: 'Current mutation + mission deal cards.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const jam = useJamStore.getState()
      return ok(
        'list_deals',
        {},
        {
          mutations: jam.mutationDeal,
          missions: jam.missionDeal,
          undoDepth: jam.undoStack.length,
        },
        'Deals',
      )
    },
  })
  register({
    name: 'apply_mutation',
    description: 'Apply a mutation deal card by id (from list_deals / get_jam_state).',
    inputSchema: {
      type: 'object',
      properties: { cardId: { type: 'string' } },
      required: ['cardId'],
    },
    execute: ({ cardId }: { cardId: string }) => {
      const r = applyMutation(cardId)
      if (!r.ok) return fail('apply_mutation', { cardId }, r.error)
      return ok('apply_mutation', { cardId }, r)
    },
  })
  register({
    name: 'apply_mission',
    description: 'Apply a mission deal card by id.',
    inputSchema: {
      type: 'object',
      properties: { cardId: { type: 'string' } },
      required: ['cardId'],
    },
    execute: ({ cardId }: { cardId: string }) => {
      const r = applyMission(cardId)
      if (!r.ok) return fail('apply_mission', { cardId }, r.error)
      return ok('apply_mission', { cardId }, r)
    },
  })
}
