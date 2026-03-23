import { useSessionStore } from '../store/session-store'
import { evaluateCode, stop, composeTracks, setBpm, initEngine } from './strudel'
// Note: setBpm is still used directly by the set_bpm tool
import { resumeAudioContext } from './audio-context'
import { liveUpdateEngine } from './live-update'
import { ROLE_PRESETS } from './presets'
import { STRUDEL_REFERENCE } from './strudel-reference'
import { ROLE_COLORS, type TrackRole } from './types'

// Agent activity log
type LogEntry = {
  timestamp: number
  tool: string
  params: Record<string, unknown>
  result: string
  status: 'success' | 'error'
}

const activityLog: LogEntry[] = []
const listeners: Set<() => void> = new Set()

function logActivity(entry: LogEntry) {
  activityLog.unshift(entry)
  if (activityLog.length > 100) activityLog.pop()
  listeners.forEach((fn) => fn())
}

export function getActivityLog(): LogEntry[] {
  return activityLog
}

export function onActivityLogChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function toolResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

export function registerWebMCPTools() {
  if (!('modelContext' in navigator)) {
    console.log('[WebMCP] navigator.modelContext not available — tools not registered')
    return
  }

  const mc = (navigator as any).modelContext

  // ─── SESSION TOOLS ───

  mc.registerTool({
    name: 'get_session',
    description:
      'Get the full current Strudel Studio session state: all tracks (name, role, code, muted, soloed), global BPM, and whether playback is active. Always call this first to understand what\'s currently playing.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const state = useSessionStore.getState()
      const result = JSON.stringify({
        bpm: state.bpm,
        isPlaying: state.isPlaying,
        activeTrackId: state.activeTrackId,
        tracks: state.tracks.map((t) => ({
          id: t.id,
          name: t.name,
          role: t.role,
          code: t.code,
          muted: t.muted,
          soloed: t.soloed,
          volume: t.volume,
        })),
      }, null, 2)
      logActivity({ timestamp: Date.now(), tool: 'get_session', params: {}, result: 'Session state returned', status: 'success' })
      return toolResult(result)
    },
  })

  mc.registerTool({
    name: 'set_bpm',
    description: 'Set the global tempo in BPM. Internally converts to setcps(bpm / 60 / 4).',
    inputSchema: {
      type: 'object',
      properties: { bpm: { type: 'number', minimum: 20, maximum: 300, description: 'Beats per minute' } },
      required: ['bpm'],
    },
    execute: ({ bpm }: { bpm: number }) => {
      useSessionStore.getState().setBpm(bpm)
      setBpm(bpm)
      logActivity({ timestamp: Date.now(), tool: 'set_bpm', params: { bpm }, result: `BPM set to ${bpm}`, status: 'success' })
      return toolResult(JSON.stringify({ bpm, cps: bpm / 60 / 4 }))
    },
  })

  // ─── TRACK TOOLS ───

  mc.registerTool({
    name: 'update_track',
    description:
      'Replace a track\'s Strudel code. The new code is queued and applied on the next cycle boundary for seamless transition. Call get_reference first to understand the Strudel API.',
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
        useSessionStore.getState().setCode(trackId, code)
        if (useSessionStore.getState().isPlaying) {
          liveUpdateEngine.queueUpdate(quantization as any)
        }
        logActivity({ timestamp: Date.now(), tool: 'update_track', params: { trackId, quantization }, result: 'Track updated', status: 'success' })
        return toolResult(JSON.stringify({ trackId, status: 'queued', quantization }))
      } catch (e: any) {
        logActivity({ timestamp: Date.now(), tool: 'update_track', params: { trackId }, result: e.message, status: 'error' })
        return toolResult(JSON.stringify({ trackId, status: 'error', error: e.message }))
      }
    },
  })

  mc.registerTool({
    name: 'add_track',
    description: 'Add a new track. If no code provided, the role\'s default preset is used.',
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
      const preset = ROLE_PRESETS[role]
      useSessionStore.getState().addTrack({
        name,
        role,
        code: code || preset.defaultCode,
        color: ROLE_COLORS[role],
        muted: false,
        soloed: false,
        locked: false,
        volume: 1,
        error: null,
      })
      logActivity({ timestamp: Date.now(), tool: 'add_track', params: { name, role }, result: `Track "${name}" added`, status: 'success' })
      return toolResult(JSON.stringify({ name, role, status: 'added' }))
    },
  })

  mc.registerTool({
    name: 'remove_track',
    description: 'Remove a track by ID.',
    inputSchema: {
      type: 'object',
      properties: { trackId: { type: 'string' } },
      required: ['trackId'],
    },
    execute: ({ trackId }: { trackId: string }) => {
      useSessionStore.getState().removeTrack(trackId)
      logActivity({ timestamp: Date.now(), tool: 'remove_track', params: { trackId }, result: 'Track removed', status: 'success' })
      return toolResult(JSON.stringify({ trackId, status: 'removed' }))
    },
  })

  mc.registerTool({
    name: 'mute_track',
    description: 'Toggle mute on a track.',
    inputSchema: { type: 'object', properties: { trackId: { type: 'string' } }, required: ['trackId'] },
    execute: ({ trackId }: { trackId: string }) => {
      useSessionStore.getState().toggleMute(trackId)
      const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
      logActivity({ timestamp: Date.now(), tool: 'mute_track', params: { trackId }, result: `Muted: ${track?.muted}`, status: 'success' })
      return toolResult(JSON.stringify({ trackId, muted: track?.muted }))
    },
  })

  mc.registerTool({
    name: 'solo_track',
    description: 'Toggle solo on a track.',
    inputSchema: { type: 'object', properties: { trackId: { type: 'string' } }, required: ['trackId'] },
    execute: ({ trackId }: { trackId: string }) => {
      useSessionStore.getState().toggleSolo(trackId)
      const track = useSessionStore.getState().tracks.find((t) => t.id === trackId)
      logActivity({ timestamp: Date.now(), tool: 'solo_track', params: { trackId }, result: `Soloed: ${track?.soloed}`, status: 'success' })
      return toolResult(JSON.stringify({ trackId, soloed: track?.soloed }))
    },
  })

  // ─── TRANSPORT TOOLS ───

  mc.registerTool({
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
        logActivity({ timestamp: Date.now(), tool: 'play', params: {}, result: 'Playback started', status: 'success' })
        return toolResult(JSON.stringify({ status: 'playing' }))
      } catch (e: any) {
        logActivity({ timestamp: Date.now(), tool: 'play', params: {}, result: e.message, status: 'error' })
        return toolResult(JSON.stringify({ status: 'error', error: e.message }))
      }
    },
  })

  mc.registerTool({
    name: 'stop',
    description: 'Stop all playback immediately.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await stop()
      useSessionStore.getState().setPlaying(false)
      logActivity({ timestamp: Date.now(), tool: 'stop', params: {}, result: 'Playback stopped', status: 'success' })
      return toolResult(JSON.stringify({ status: 'stopped' }))
    },
  })

  // ─── KNOWLEDGE TOOLS ───

  mc.registerTool({
    name: 'get_reference',
    description:
      'Get the complete Strudel API reference (~15KB markdown). Covers mini-notation, functions, effects, pattern modifiers, signals, scales, common recipes, and mistakes. Always call this before writing Strudel code.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      logActivity({ timestamp: Date.now(), tool: 'get_reference', params: {}, result: 'Reference returned', status: 'success' })
      return toolResult(STRUDEL_REFERENCE)
    },
  })

  mc.registerTool({
    name: 'get_samples',
    description: 'Get a list of available sample names.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const samples = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cb', 'lt', 'mt', 'ht', 'cr', 'ride', 'tom', 'perc', 'tabla', 'sax', 'flute', 'piano', 'bass', 'guitar', 'pluck', 'pad', 'string', 'brass', 'vox', 'mouth', 'click', 'noise', 'metal', 'gong', 'bell']
      const banks = ['RolandTR808', 'RolandTR909', 'RolandCR78', 'AkaiLinn']
      logActivity({ timestamp: Date.now(), tool: 'get_samples', params: {}, result: 'Sample list returned', status: 'success' })
      return toolResult(JSON.stringify({ samples, banks }))
    },
  })

  mc.registerTool({
    name: 'get_scales_and_chords',
    description: 'Get available scale and chord names for use with .scale() and .chord().',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const scales = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian', 'pentatonic', 'minor pentatonic', 'blues', 'chromatic', 'whole tone', 'diminished', 'harmonic minor', 'melodic minor']
      const chords = ['major', 'minor', 'dim', 'aug', '7', 'maj7', 'min7', 'sus2', 'sus4', '9', 'min9', 'add9']
      logActivity({ timestamp: Date.now(), tool: 'get_scales_and_chords', params: {}, result: 'Scales and chords returned', status: 'success' })
      return toolResult(JSON.stringify({ scales, chords }))
    },
  })

  mc.registerTool({
    name: 'evaluate_code',
    description: 'Execute arbitrary Strudel code directly. Use with caution.',
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
        logActivity({ timestamp: Date.now(), tool: 'evaluate_code', params: { code: code.substring(0, 50) }, result: 'Code evaluated', status: 'success' })
        return toolResult(JSON.stringify({ status: 'evaluated' }))
      } catch (e: any) {
        logActivity({ timestamp: Date.now(), tool: 'evaluate_code', params: { code: code.substring(0, 50) }, result: e.message, status: 'error' })
        return toolResult(JSON.stringify({ status: 'error', error: e.message }))
      }
    },
  })

  console.log('[WebMCP] Registered 14 tools with navigator.modelContext')
}
