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
  undoJam,
  stashAb,
  punchAb,
  toggleAb,
  setFx,
  openCodeSheet,
  closeCodeSheet,
  PINNABLE_EFFECTS,
} from './jam-actions'
import type { AbSlot } from '../store/jam-store'

export function registerWebMcpToolsB2(register: WebMcpRegister) {
  register({
    name: 'undo_jam',
    description: 'Undo last Jam sound/FX (or historical) change.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => {
      const r = undoJam()
      if (!r.ok) return fail('undo_jam', {}, r.error)
      return ok('undo_jam', {}, r)
    },
  })
  register({
    name: 'play',
    description: 'Start playback. Evaluates all tracks and begins audio.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      try {
        await resumeAudioContext()
        await initEngine()
        const state = useSessionStore.getState()
        const code = composeTracks(state.tracks, state.bpm)
        await evaluateCode(code)
        useSessionStore.getState().setPlaying(true)
        return ok('play', {}, { status: 'playing' }, 'Playback started')
      } catch (e: any) {
        return fail('play', {}, e.message)
      }
    },
  })
  register({
    name: 'stop',
    description: 'Stop all playback immediately. Never stop/hush without asking the user in a liveloop.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await stop()
      useSessionStore.getState().setPlaying(false)
      return ok('stop', {}, { status: 'stopped' }, 'Playback stopped')
    },
  })
  register({
    name: 'mic_status',
    description:
      'Mic Rec status. Recording REQUIRES a user gesture in the Jam UI (Rec button) — browsers block getUserMedia from agent tools. This tool never fakes start/stop; it only reports whether a recording is currently active via isMicRecording().',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const recording = isMicRecording()
      return ok(
        'mic_status',
        {},
        {
          recording,
          canStartFromTool: false,
          note:
            'Mic Rec must be user-initiated via the Jam Rec button (gesture + getUserMedia). Agents cannot silently start recording. Ask the user to tap Rec, then poll mic_status.',
        },
        recording ? 'recording' : 'idle',
      )
    },
  })
  register({
    name: 'get_reference',
    description:
      'Get the complete Strudel API reference (~15KB markdown). Covers mini-notation, functions, effects, pattern modifiers, signals, scales, common recipes, and mistakes. Always call this before writing Strudel code.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      return okText('get_reference', {}, STRUDEL_REFERENCE, 'Reference returned')
    },
  })
  register({
    name: 'search_strudel_docs',
    description:
      'Search a cached index of official Strudel docs (https://strudel.cc/) and return relevant snippets + URLs. Also use get_reference for the full in-app API.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 10 },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
    execute: ({ query, limit = 5 }: { query: string; limit?: number }) => {
      const hits = searchStrudelDocs(query, limit)
      return ok(
        'search_strudel_docs',
        { query, limit },
        {
          query,
          hits,
          tip: 'For full API recipes also call get_reference. Docs site: https://strudel.cc/',
        },
        `${hits.length} hits`,
      )
    },
  })
  register({
    name: 'get_samples',
    description: 'Available sample name abbreviations + drum banks (tidal list + banks used by Jam kits / BANK_SHORT).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const samples = [
        'bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cb', 'lt', 'mt', 'ht', 'cr', 'ride', 'tom', 'perc',
        'tabla', 'sax', 'flute', 'piano', 'bass', 'guitar', 'pluck', 'pad', 'string', 'brass',
        'vox', 'mouth', 'click', 'noise', 'metal', 'gong', 'bell',
      ]
      const tidalBanks = [
        'RolandTR808', 'RolandTR909', 'RolandTR707', 'RolandTR606', 'RolandTR505', 'RolandTR727',
        'RolandCompurhythm78', 'LinnDrum', 'LinnLM1', 'AkaiMPC60', 'EmuSP12', 'BossDR110', 'OberheimDMX',
      ]
      const kitBanks = kitBanksList().map((bank) => ({
        bank,
        short: drumsBankShortName(bank),
      }))
      return ok(
        'get_samples',
        {},
        { samples, tidalBanks, kitBanks },
        'Sample list returned',
      )
    },
  })
  register({
    name: 'get_scales_and_chords',
    description: 'Get available scale and chord names for use with .scale() and .chord().',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const scales = [
        'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian',
        'pentatonic', 'minor pentatonic', 'blues', 'chromatic', 'whole tone', 'diminished',
        'harmonic minor', 'melodic minor',
      ]
      const chords = ['major', 'minor', 'dim', 'aug', '7', 'maj7', 'min7', 'sus2', 'sus4', '9', 'min9', 'add9']
      return ok('get_scales_and_chords', {}, { scales, chords }, 'Scales and chords returned')
    },
  })
  register({
    name: 'evaluate_code',
    description: 'Execute arbitrary Strudel code directly. Use with caution — prefer update_track for liveloop.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Strudel JavaScript code to evaluate' } },
      required: ['code'],
    },
    execute: async ({ code }: { code: string }) => {
      try {
        await resumeAudioContext()
        await initEngine()
        await evaluateCode(code)
        return ok('evaluate_code', { code: code.substring(0, 50) }, { status: 'evaluated' }, 'Code evaluated')
      } catch (e: any) {
        return fail('evaluate_code', { code: code.substring(0, 50) }, e.message)
      }
    },
  })
}
