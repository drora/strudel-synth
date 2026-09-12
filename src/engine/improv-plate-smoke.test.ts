/**
 * Smoke: improv plate layout, voice code, compose overlay.
 * Run: npm run test:improv-plate
 */
import assert from 'node:assert/strict'
import {
  layoutImprovPads,
  improvVoiceCode,
  improvVoiceHap,
  improvVoiceHapWithMix,
  applyImprovMixToCode,
  hitsToNoteCode,
  walkTriadPcs,
} from './improv-plate'
import { improvLookahead, markImprovVoiceWarm } from './improv-trigger'
import { composeTracks } from './compose-tracks'
import type { Track } from './types'
import type { WalkCenter } from './song-seed'
import { rootIndex } from './note-harmony'

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

console.log('=== Improv plate smoke ===')

// C minor, octave 4, walk i / bVI / bIII
{
  const walk: WalkCenter[] = [
    { degree: 0, quality: 'min' }, // i = Cm → C Eb G
    { degree: 8, quality: 'maj' }, // bVI = Ab → Ab C Eb
    { degree: 3, quality: 'maj' }, // bIII = Eb → Eb G Bb
  ]
  const pads = layoutImprovPads('c', 'minor', 4, walk)
  assert.equal(pads.length, 8, 'always 8 slots')
  assert.equal(pads[0]!.slot, 1)
  assert.equal(pads[0]!.note, 'c4', 'slot1 = song root')
  assert.equal(pads[7]!.note, 'c5', 'slot8 = +1 octave tonic')
  assert.ok(pads.every((p) => p.enabled), 'heptatonic: all 8 live')

  // Walk glow on C/Eb/G (and Ab from bVI, Bb from bIII)
  const glowNotes = pads.filter((p) => p.walkGlow).map((p) => p.note)
  const glowPcs = new Set(
    glowNotes.map((n) => rootIndex(n!.replace(/\d+$/, ''))),
  )
  const expected = walkTriadPcs('c', walk)
  for (const pc of [rootIndex('c'), rootIndex('eb'), rootIndex('g')]) {
    assert.ok(expected.has(pc), `walk triad has pc ${pc}`)
    assert.ok(glowPcs.has(pc), `pad glow includes pc ${pc}`)
  }
  // Ab (bVI root) should glow when present on plate
  const abPad = pads.find((p) => p.note?.startsWith('ab'))
  assert.ok(abPad?.walkGlow, 'Ab walk tone glows')
  console.log('C minor walk layout ok', pads.map((p) => `${p.slot}:${p.note}${p.walkGlow ? '*' : ''}`).join(' '))
}

// F mixolydian pentatonic (song pentatonic): 6 live + 2 disabled
{
  const pads = layoutImprovPads('f', 'pentatonic', 4, null)
  assert.equal(pads.length, 8)
  const live = pads.filter((p) => p.enabled)
  const dim = pads.filter((p) => !p.enabled)
  assert.equal(live.length, 6, '6 live')
  assert.equal(dim.length, 2, '2 disabled')
  assert.equal(pads[0]!.note, 'f4')
  assert.equal(pads[7]!.note, 'f5')
  assert.ok(!pads[5]!.enabled && !pads[6]!.enabled, 'slots 6–7 dim')
  console.log('pentatonic 6+2 ok')
}

// F mixolydian heptatonic: 8 live, slot1 f, slot8 f+oct
{
  const pads = layoutImprovPads('f', 'mixolydian', 4, null)
  assert.equal(pads.length, 8)
  assert.ok(pads.every((p) => p.enabled))
  assert.equal(pads[0]!.note, 'f4')
  assert.equal(pads[7]!.note, 'f5')
  console.log('F mixolydian 8 live ok')
}

// Voice code
{
  const synth = improvVoiceCode('c4', 'sawtooth')
  assert.match(synth, /note\("c4"\)\.sound\("sawtooth"\)/)
  const mic = improvVoiceCode('eb4', 'jam_mic_1')
  assert.ok(mic.includes('s("jam_mic_') && mic.includes('note('), mic)
  console.log('voice code ok')
}

{
  assert.deepEqual(improvVoiceHap('c4', 'sawtooth'), { s: 'sawtooth', note: 'c4' })
  assert.deepEqual(improvVoiceHap('eb4', 'jam_mic_1'), { s: 'jam_mic_1', note: 'eb4' })
  assert.deepEqual(improvVoiceHap('g4', 'piano:2'), { s: 'piano', note: 'g4', n: 2 })
  console.log('voice hap ok')
}

// hits → note pattern
{
  const code = hitsToNoteCode(
    [
      { note: 'c4', cycle: 1.1 },
      { note: 'eb4', cycle: 1.4 },
      { note: 'g4', cycle: 2.0 },
    ],
    'triangle',
  )
  assert.match(code, /note\("c4 eb4 g4"\)\.sound\("triangle"\)/)
  assert.doesNotMatch(code, /velocity/)
}

{
  const held = hitsToNoteCode(
    [
      { note: 'c4', cycle: 1, dur: 0.2, velocity: 0.4 },
      { note: 'g4', cycle: 1.2, dur: 0.8, velocity: 1 },
    ],
    'sine',
  )
  assert.match(held, /note\("c4 g4@4"\)/)
  assert.match(held, /\.velocity\("0.4 1"\)/)
  assert.match(held, /\.clip\(1\)/)
  const even = hitsToNoteCode(
    [
      { note: 'c4', cycle: 1, dur: 0.3, velocity: 0.85 },
      { note: 'eb4', cycle: 1.1, dur: 0.3, velocity: 0.85 },
    ],
    'sine',
  )
  assert.match(even, /note\("c4 eb4"\)/)
  assert.match(even, /\.velocity\(0.85\)/)
  assert.doesNotMatch(even, /clip/)
  console.log('keep hold+velocity ok')
}

// composeTracks overlay
{
  const a = track({ id: 'a', code: 's("bd")', volume: 1 })
  const bare = composeTracks([a], 120)
  assert.doesNotMatch(bare, /stack\(/)
  assert.equal((bare.match(/\.gain\(/g) ?? []).length, 1)

  const withOv = composeTracks([a], 120, 'silence')
  assert.match(withOv, /stack\(/)
  assert.equal((withOv.match(/\.gain\(/g) ?? []).length, 2, 'one extra gain')
  assert.match(withOv, /\(silence\)\.gain\(1\)/)

  const emptyBare = composeTracks([], 120)
  assert.match(emptyBare, /silence/)
  assert.equal((emptyBare.match(/\.gain\(/g) ?? []).length, 0)

  const emptyOv = composeTracks([], 120, 'silence')
  assert.equal((emptyOv.match(/\.gain\(/g) ?? []).length, 1)
  console.log('compose overlay ok')
}

{
  const dry = improvVoiceHapWithMix('c4', 'sawtooth', { volume: 0.9 })
  assert.equal(dry.gain, 0.9)
  assert.equal(dry.lpf, undefined)
  assert.equal(dry.room, undefined)
  const wet = improvVoiceHapWithMix('c4', 'sawtooth', {
    volume: 0.5,
    lpf: 800,
    room: 0.6,
    delay: 0,
    hpf: 20,
  })
  assert.equal(wet.gain, 0.5)
  assert.equal(wet.lpf, 800)
  assert.equal(wet.room, 0.6)
  assert.equal(wet.delay, undefined)
  assert.equal(wet.hpf, undefined)
  const kept = applyImprovMixToCode('note("c4 eb4").sound("sine")', {
    volume: 0.5,
    lpf: 800,
    room: 0.6,
  })
  assert.match(kept, /\.lpf\(800\)/)
  assert.match(kept, /\.room\(0.6\)/)
  assert.doesNotMatch(kept, /\.gain\(/)
  console.log('pad mix ok')
}

{
  assert.equal(improvLookahead('sine'), 0.02, 'synths are warm')
  assert.equal(improvLookahead('sawtooth'), 0.02)
  assert.equal(improvLookahead('piano'), 0.12, 'cold sample')
  markImprovVoiceWarm('piano')
  assert.equal(improvLookahead('piano'), 0.02, 'heard sample is warm')
  console.log('pad lookahead ok')
}

console.log('improv-plate-smoke.test.ts: ok')
