/**
 * Tiny unit test for arity-stable mute/solo compose.
 * Run: npx --yes tsx src/engine/compose-tracks.test.ts
 */
import assert from 'node:assert/strict'
import { composeTracks } from './compose-tracks'
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
    octave: partial.octave ?? 0,
    error: partial.error ?? null,
  }
}

const bpm = 120

function gainCount(out: string): number {
  return (out.match(/\.gain\(/g) ?? []).length
}

// --- N===0 ---
{
  const out = composeTracks([], bpm)
  assert.match(out, /silence/)
}

// --- N===1: mute → gain(0), unmute restores volume ---
{
  const a = track({ id: 'a', code: 's("bd")', volume: 0.7 })
  const live = composeTracks([a], bpm)
  assert.doesNotMatch(live, /stack\(/)
  assert.match(live, /\(s\("bd"\)\)\.gain\(0\.7\)/)
  assert.equal(gainCount(live), 1)

  const muted = composeTracks([{ ...a, muted: true }], bpm)
  assert.doesNotMatch(muted, /silence/, 'single muted track keeps lane with gain(0)')
  assert.match(muted, /\(s\("bd"\)\)\.gain\(0\)/)
  assert.equal(gainCount(muted), 1)

  const unmuted = composeTracks([{ ...a, muted: false, volume: 0.7 }], bpm)
  assert.match(unmuted, /\(s\("bd"\)\)\.gain\(0\.7\)/)
}

// --- N===2: mute first → still stack of 2 with gain(0) ---
{
  const a = track({ id: 'a', code: 's("bd")', volume: 0.8 })
  const b = track({ id: 'b', code: 's("hh")', volume: 1 })
  const both = composeTracks([a, b], bpm)
  assert.match(both, /stack\(/)
  assert.equal(gainCount(both), 2)

  const muteFirst = composeTracks([{ ...a, muted: true }, b], bpm)
  assert.match(muteFirst, /stack\(/, 'mute must not drop to single-pattern arity')
  assert.equal(gainCount(muteFirst), 2)
  assert.match(muteFirst, /\(s\("bd"\)\)\.gain\(0\)/)
  assert.match(muteFirst, /\(s\("hh"\)\)\.gain\(1\)/)

  const muteBoth = composeTracks(
    [
      { ...a, muted: true },
      { ...b, muted: true },
    ],
    bpm,
  )
  assert.match(muteBoth, /stack\(/, 'all-muted still keeps arity (gain 0 lanes)')
  assert.equal(gainCount(muteBoth), 2)
  assert.match(muteBoth, /\.gain\(0\)/)

  const unmute = composeTracks([a, { ...b, muted: true }], bpm)
  assert.match(unmute, /stack\(/)
  assert.match(unmute, /\(s\("bd"\)\)\.gain\(0\.8\)/)
  assert.match(unmute, /\(s\("hh"\)\)\.gain\(0\)/)
}

// --- N===3+: mute one → still stack of 3 ---
{
  const tracks = [
    track({ id: 'a', code: 's("bd")', volume: 1 }),
    track({ id: 'b', code: 's("hh")', volume: 0.5 }),
    track({ id: 'c', code: 's("sd")', volume: 0.9 }),
  ]
  const all = composeTracks(tracks, bpm)
  assert.match(all, /stack\(/)
  assert.equal(gainCount(all), 3)

  const muteMid = composeTracks(
    tracks.map((t) => (t.id === 'b' ? { ...t, muted: true } : t)),
    bpm,
  )
  assert.match(muteMid, /stack\(/)
  assert.equal(gainCount(muteMid), 3)
  assert.match(muteMid, /\(s\("hh"\)\)\.gain\(0\)/)
  assert.match(muteMid, /\(s\("bd"\)\)\.gain\(1\)/)
  assert.match(muteMid, /\(s\("sd"\)\)\.gain\(0\.9\)/)
}

// --- Solo one of many → others gain(0); unmute/unsolo restores ---
{
  const tracks = [
    track({ id: 'a', code: 's("bd")', volume: 1, soloed: true }),
    track({ id: 'b', code: 's("hh")', volume: 0.5 }),
    track({ id: 'c', code: 's("sd")', volume: 0.9 }),
  ]
  const soloed = composeTracks(tracks, bpm)
  assert.match(soloed, /stack\(/)
  assert.equal(gainCount(soloed), 3)
  assert.match(soloed, /\(s\("bd"\)\)\.gain\(1\)/)
  assert.match(soloed, /\(s\("hh"\)\)\.gain\(0\)/)
  assert.match(soloed, /\(s\("sd"\)\)\.gain\(0\)/)

  const restored = composeTracks(tracks.map((t) => ({ ...t, soloed: false })), bpm)
  assert.match(restored, /\(s\("bd"\)\)\.gain\(1\)/)
  assert.match(restored, /\(s\("hh"\)\)\.gain\(0\.5\)/)
  assert.match(restored, /\(s\("sd"\)\)\.gain\(0\.9\)/)
}

// --- Solo + mute on soloed track → gain(0) but arity kept ---
{
  const tracks = [
    track({ id: 'a', code: 's("bd")', volume: 1, soloed: true, muted: true }),
    track({ id: 'b', code: 's("hh")', volume: 0.5 }),
  ]
  const out = composeTracks(tracks, bpm)
  assert.match(out, /stack\(/)
  assert.equal(gainCount(out), 2)
  assert.match(out, /\(s\("bd"\)\)\.gain\(0\)/)
  assert.match(out, /\(s\("hh"\)\)\.gain\(0\)/)
}

console.log('compose-tracks.test.ts: ok')
