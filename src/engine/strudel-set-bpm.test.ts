import assert from 'node:assert/strict'
import { composeTracks } from './compose-tracks'
import { setBpm } from './strudel'
import { useSessionStore } from '../store/session-store'
import type { Track } from './types'

function track(partial: Partial<Track> & Pick<Track, 'id' | 'code'>): Track {
  return {
    id: partial.id,
    code: partial.code,
    name: partial.name ?? partial.id,
    role: partial.role ?? 'custom',
    color: partial.color ?? '#fff',
    muted: partial.muted ?? false,
    soloed: partial.soloed ?? false,
    locked: partial.locked ?? false,
    volume: partial.volume ?? 1,
    error: partial.error ?? null,
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const tracks = [track({ id: 'drums', code: 's("bd hh")', volume: 0.9 })]
const calls: string[] = []

globalThis.__strudelEngine = {
  initialized: true,
  evaluateFn: async (code: string) => {
    calls.push(code)
  },
  scheduler: null,
  communityBanksLoaded: true,
}

useSessionStore.setState({ tracks, bpm: 120, isPlaying: false, activeTrackId: 'drums', templateId: null })
await setBpm(140)
await wait(160)
assert.equal(calls.length, 0, 'stopped BPM changes should not evaluate anything')

useSessionStore.setState({ bpm: 132, isPlaying: true })
await setBpm(132)
useSessionStore.setState({ bpm: 136 })
await setBpm(136)
assert.equal(calls.length, 0, 'playing BPM changes should debounce evaluation')

await wait(160)
assert.equal(calls.length, 1, 'debounced BPM changes should recompose once')
assert.equal(calls[0], composeTracks(tracks, 136))
assert.equal(useSessionStore.getState().isPlaying, true, 'hotfix must not toggle playback state')

useSessionStore.setState({ isPlaying: false })
console.log('strudel-set-bpm.test.ts: ok')
