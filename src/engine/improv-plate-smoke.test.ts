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
  lastImprovPhrase,
  phraseGapSec,
  bridgeImprovPhrase,
  hitsToNoteCode,
  quantizeBeats,
  tokenBeats,
  walkTriadPcs,
  smearFromHold,
  noteTransposeRate,
  isPadsKeepTrack,
  groupedFxControls,
  summarizeFxGroup,
  formatFxSummaryPart,
  IMPROV_FX_CONTROLS,
  setImprovVoiceInCode,
  refitMicKeepCode,
  bakedWalkLengthFromCode,
  shiftNoteBySemis,
  nudgeMicNotesInCode,
  sampleGainBoost,
  soundFromCode,
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
  assert.deepEqual(improvVoiceHap('c4', 'hmm'), { s: 'hmm', note: 'c4', n: 0 })
  console.log('voice hap ok')
}

{
  const kept = hitsToNoteCode(
    [{ note: 'c4', cycle: 1, dur: 0.4, at: 1000 }],
    'hmm',
    120,
  )
  assert.match(kept, /\.sound\("hmm"\)/)
  assert.match(kept, /\.attack\(0\.08\)/)
  console.log('soft vox keep attack ok')
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
  assert.match(code, /note\("c4@0.5 eb4@0.5 g4@0.5 ~@2.5"\)\.sound\("triangle"\)/)
  assert.doesNotMatch(code, /velocity/)
}

{
  const held = hitsToNoteCode(
    [
      { note: 'c4', cycle: 1, dur: 0.2, velocity: 0.4 },
      { note: 'g4', cycle: 1.2, dur: 2.0, velocity: 1 },
    ],
    'sine',
    120,
  )
  assert.match(held, /note\("c4@0.5 g4@4"\)/)
  assert.match(held, /\.velocity\("0.4 1"\)/)
  assert.match(held, /\.clip\(1\)/)
  assert.match(held, /\.slow\(1\.125\)/)
  const even = hitsToNoteCode(
    [
      { note: 'c4', cycle: 1, dur: 0.3, velocity: 0.85 },
      { note: 'eb4', cycle: 1.1, dur: 0.3, velocity: 0.85 },
    ],
    'sine',
  )
  assert.match(even, /note\("c4@0.5 eb4@0.5 ~@3"\)/)
  assert.match(even, /\.velocity\("0.85 0.85 1"\)/)
  assert.match(even, /clip/)
  console.log('keep hold+velocity ok')
}

{
  assert.equal(quantizeBeats(0.08, 120), 0.25)
  assert.equal(quantizeBeats(0.15, 120), 0.25)
  assert.equal(quantizeBeats(0.25, 120), 0.5)
  assert.equal(quantizeBeats(0.5, 120), 1)
  assert.equal(quantizeBeats(1.0, 120), 2)
  assert.equal(quantizeBeats(2.0, 120), 4)
  assert.equal(tokenBeats('c4'), 1)
  assert.equal(tokenBeats('c4@0.25'), 0.25)
  assert.equal(tokenBeats('c4@0.5'), 0.5)
  assert.equal(tokenBeats('c4@4'), 4)
  const tap = hitsToNoteCode(
    [{ note: 'c4', cycle: 0, dur: 0.1, velocity: 1, at: 20_000 }],
    'sine',
    120,
  )
  assert.match(tap, /note\("c4@0.25 ~@3.75"\)/, tap)
  assert.doesNotMatch(tap, /slow/)
  const eighths = hitsToNoteCode(
    [
      { note: 'c4', cycle: 0, dur: 0.25, velocity: 1, at: 20_000 },
      { note: 'eb4', cycle: 0, dur: 0.25, velocity: 1, at: 20_250 },
    ],
    'sine',
    120,
  )
  assert.match(eighths, /note\("c4@0.5 eb4@0.5 ~@3"\)/, eighths)
  assert.doesNotMatch(eighths, /slow/)
  console.log('keep staccato 0.25/0.5 ok')
}

{
  const t0 = 10_000
  const code = hitsToNoteCode(
    [
      { note: 'c3', cycle: 0, dur: 0.2, velocity: 1, at: 0 },
      { note: 'c4', cycle: 0, dur: 0.25, velocity: 0.8, at: t0 },
      { note: 'eb4', cycle: 0, dur: 0.25, velocity: 0.8, at: t0 + 750 },
      { note: 'g4', cycle: 0, dur: 0.25, velocity: 0.8, at: t0 + 2000 },
    ],
    'sine',
    120,
  )
  assert.match(code, /note\("c4@0.5 ~ eb4@0.5 ~@2 g4@0.5"\)/, code)
  assert.doesNotMatch(code, /c3/)
  assert.match(code, /\.velocity\("0.8 1 0.8 1 0.8"\)/)
  assert.match(code, /\.slow\(1\.125\)/)
  const lone = hitsToNoteCode(
    [{ note: 'c4', cycle: 0, dur: 2.0, velocity: 1, at: t0 }],
    'sine',
    120,
  )
  assert.match(lone, /note\("c4@4"\)/)
  assert.match(lone, /clip/)
  assert.doesNotMatch(lone, /slow/)
  const sentence = hitsToNoteCode(
    [
      { note: 'c4', cycle: 0, dur: 1.0, velocity: 1, at: t0 },
      { note: 'eb4', cycle: 0, dur: 1.0, velocity: 1, at: t0 + 1000 },
      { note: 'g4', cycle: 0, dur: 1.0, velocity: 1, at: t0 + 2000 },
      { note: 'c5', cycle: 0, dur: 1.0, velocity: 1, at: t0 + 3000 },
    ],
    'triangle',
    120,
  )
  assert.match(sentence, /note\("c4@2 eb4@2 g4@2 c5@2"\)/)
  assert.match(sentence, /\.slow\(2\)/)
  console.log('keep phrase+rests ok')
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

// VCSL marimba is soft-only — pad/Keep/compose share the boost
{
  assert.equal(sampleGainBoost('marimba'), 8)
  assert.equal(sampleGainBoost('sine'), 1)
  assert.equal(sampleGainBoost('kalimba'), 1)
  assert.equal(soundFromCode('note("c4").sound("marimba")'), 'marimba')
  assert.equal(soundFromCode('s("sax")'), 'sax')
  assert.equal(soundFromCode('s("pad ~ ~ pad")'), 'pad')
  const kept = composeTracks(
    [track({ id: 'm', code: 'note("c4").sound("marimba")', volume: 1 })],
    120,
  )
  assert.match(kept, /\.gain\(8\)/)
  const sine = composeTracks(
    [track({ id: 's', code: 'note("c4").sound("sine")', volume: 1 })],
    120,
  )
  assert.match(sine, /\.gain\(1\)/)
  assert.equal(sampleGainBoost('glockenspiel'), 8)
  assert.equal(sampleGainBoost('wineglass_slow'), 12)
  assert.equal(sampleGainBoost('speechless'), 5)
  assert.equal(sampleGainBoost('wt_digital_basique'), 5)
  assert.ok(sampleGainBoost('sax') < 1)
  assert.equal(sampleGainBoost('organ_4inch'), 6)
  console.log('quiet sample gain boost ok')
}

{
  const dry = improvVoiceHapWithMix('c4', 'sawtooth', { volume: 0.9 })
  assert.equal(dry.gain, undefined, 'Vol is the fader, not hap.gain')
  assert.equal(dry.lpf, undefined)
  assert.equal(dry.room, undefined)
  const wet = improvVoiceHapWithMix('c4', 'sawtooth', {
    volume: 0.5,
    gain: 0.7,
    lpf: 800,
    room: 0.6,
    roomsize: 2,
    delay: 0,
    hpf: 20,
  })
  assert.equal(wet.gain, 0.7)
  assert.equal(wet.lpf, 800)
  assert.equal(wet.room, 0.6)
  assert.equal(wet.roomsize, 2)
  assert.equal(wet.delay, undefined)
  assert.equal(wet.hpf, undefined)
  const kept = applyImprovMixToCode('note("c4 eb4").sound("sine")', {
    volume: 0.5,
    gain: 0.7,
    lpf: 800,
    room: 0.6,
    roomsize: 2,
    delay: 0.35,
    delaytime: 0.5,
    attack: 0.1,
    decay: 0.2,
    sustain: 0.75,
    release: 0.4,
  })
  assert.match(kept, /\.lpf\(800\)/)
  assert.match(kept, /\.room\(0.6\)/)
  assert.match(kept, /\.roomsize\(2\)/)
  assert.match(kept, /\.delay\(0.35\)/)
  assert.match(kept, /\.delaytime\(0.5\)/)
  assert.match(kept, /\.attack\(0.1\)/)
  assert.match(kept, /\.decay\(0.2\)/)
  assert.match(kept, /\.sustain\(0.75\)/)
  assert.match(kept, /\.release\(0.4\)/)
  assert.match(kept, /\.gain\(0.7\)/)
  const keptVolOnly = applyImprovMixToCode('note("c4").sound("sine")', { volume: 0.5 })
  assert.doesNotMatch(keptVolOnly, /\.gain\(/)
  const groups = groupedFxControls(IMPROV_FX_CONTROLS)
  assert.equal(IMPROV_FX_CONTROLS[0]?.key, 'gain', 'Gain first')
  assert.equal(groups[0]?.group, null, 'Gain ungrouped (always open)')
  assert.ok(IMPROV_FX_CONTROLS[0]?.steps.includes(2), 'Gain chips to 2')
  const filt = groups.find((g) => g.group === 'filter')
  assert.deepEqual(filt?.items.map((c) => c.key), ['lpf', 'hpf'])
  const rev = groups.find((g) => g.group === 'reverb')
  const del = groups.find((g) => g.group === 'delay')
  assert.deepEqual(rev?.items.map((c) => c.key), ['room', 'roomsize'])
  assert.deepEqual(del?.items.map((c) => c.key), ['delay', 'delaytime'])
  const env = groups.find((g) => g.group === 'envelope')
  assert.deepEqual(env?.items.map((c) => c.key), ['attack', 'decay', 'sustain', 'release'])
  const flatKeys = groups.flatMap((g) => g.items.map((c) => c.key))
  assert.deepEqual(
    flatKeys,
    IMPROV_FX_CONTROLS.map((c) => c.key),
    'groupedFxControls lossless',
  )
  assert.equal(formatFxSummaryPart('lpf', 'LPF', 2000), 'LPF 2k')
  assert.equal(formatFxSummaryPart('room', 'Reverb', 0.3), '0.3')
  const offSum = summarizeFxGroup('Filter', filt!.items, () => undefined)
  assert.equal(offSum.text, 'Filter · off')
  assert.equal(offSum.active, false)
  const vals: Record<string, number> = { lpf: 2000, room: 0.3 }
  const filtOn = summarizeFxGroup('Filter', filt!.items, (k) => vals[k])
  assert.equal(filtOn.text, 'Filter · LPF 2k')
  assert.equal(filtOn.active, true)
  const revOn = summarizeFxGroup('Reverb', rev!.items, (k) => vals[k])
  assert.equal(revOn.text, 'Reverb · 0.3')
  // Pads off defaults: LPF 12000 / HPF 20 inactive
  const padsOff = summarizeFxGroup('Filter', filt!.items, (k) =>
    k === 'lpf' ? 12000 : k === 'hpf' ? 20 : undefined,
  )
  assert.equal(padsOff.text, 'Filter · off')
  console.log('pad mix ok')
}

{
  // Explicit small gapSec still exercises split (default gap is walk-sized, not 1.6s)
  const early = { note: 'c4', cycle: 0, dur: 0.2, at: 0 }
  const late = { note: 'e5', cycle: 0, dur: 0.2, at: 2200 }
  const split = lastImprovPhrase([early, late], 1.6)
  assert.equal(split.length, 1)
  assert.equal(split[0]!.note, 'e5')
  const bridged = [{ ...early }]
  bridgeImprovPhrase(bridged, 2000)
  const kept = lastImprovPhrase(
    [...bridged, { note: 'e5', cycle: 0, dur: 0.2, at: 2100 }],
    1.6,
  )
  assert.equal(kept.map((h) => h.note).join(' '), 'c4 e5', 'octave does not split Keep')
  console.log('octave bridge ok')
}

{
  // Gap = one full walk in seconds (+0.25 cushion), floored at 2s; BPM-aware
  assert.equal(phraseGapSec(120, 1), 2.25, 'N=1 @120 → 2+0.25')
  assert.equal(phraseGapSec(120, 4), 8.25, 'N=4 @120 → 8+0.25')
  assert.equal(phraseGapSec(90, 4), 4 * 4 * (60 / 90) + 0.25, 'N=4 @90 longer than @120')
  assert.ok(phraseGapSec(90, 4) > phraseGapSec(120, 4), 'lower tempo → longer gap')
  assert.equal(phraseGapSec(90, 1), 1 * 4 * (60 / 90) + 0.25, 'N=1 @90')
  assert.ok(phraseGapSec(90, 1) > phraseGapSec(120, 1), 'N=1 also BPM-aware')
  assert.equal(phraseGapSec(240, 1), 2, 'fast/short floors at 2s')
  // ~3s pause must NOT split when gapSec is walk-4 sized (~8.25s @120)
  const a = { note: 'c4', cycle: 0, dur: 0.25, at: 10_000 }
  const b = { note: 'g4', cycle: 0, dur: 0.25, at: 10_000 + 250 + 3000 }
  const joined = lastImprovPhrase([a, b], phraseGapSec(120, 4))
  assert.equal(joined.map((h) => h.note).join(' '), 'c4 g4', '3s pause stays one sentence at walk-4')
  const splitFast = lastImprovPhrase([a, b], 1.6)
  assert.equal(splitFast.length, 1, 'same 3s pause still splits with tiny gapSec')
  console.log('phraseGapSec walk/BPM ok')
}

{
  assert.equal(improvLookahead('sine'), 0.02, 'synths are warm')
  assert.equal(improvLookahead('sawtooth'), 0.02)
  assert.equal(improvLookahead('piano'), 0.12, 'cold sample')
  markImprovVoiceWarm('piano')
  assert.equal(improvLookahead('piano'), 0.02, 'heard sample is warm')
  console.log('pad lookahead ok')
}

{
  assert.equal(noteTransposeRate('c2'), 1)
  assert.equal(noteTransposeRate('c3'), 2)
  assert.equal(noteTransposeRate('c4'), 4)
  const dry = smearFromHold(0.3, 0.4)
  assert.equal(dry, null, 'tap shorter than take stays dry')
  const raw = smearFromHold(2, 0.4)
  assert.ok(raw)
  assert.equal(raw!.speed, 0.2)
  assert.equal(raw!.stretch, 4)
  const c3 = smearFromHold(2, 0.4, 'c3')
  assert.ok(c3)
  assert.equal(c3!.speed, 0.1)
  assert.equal(c3!.stretch, 9)
  const kept = hitsToNoteCode(
    [{ note: 'c3', cycle: 0, dur: 2.0, velocity: 1, at: 20_000 }],
    'jam_mic_1',
    120,
    0.4,
  )
  assert.match(kept, /note\("c3@4"\)/)
  assert.match(kept, /\.s\("jam_mic_1"\)/)
  assert.match(kept, /\.speed\(0\.1\)/)
  assert.match(kept, /\.stretch\(9\)/)
  const tap = hitsToNoteCode(
    [{ note: 'c3', cycle: 0, dur: 0.2, velocity: 1, at: 20_000 }],
    'jam_mic_1',
    120,
    0.4,
  )
  assert.doesNotMatch(tap, /speed/)
  assert.doesNotMatch(tap, /stretch/)
  const synth = hitsToNoteCode(
    [{ note: 'c3', cycle: 0, dur: 2.0, velocity: 1, at: 20_000 }],
    'sine',
    120,
    0.4,
  )
  assert.doesNotMatch(synth, /speed/)
  console.log('rec smear keep ok')
}

{
  assert.equal(isPadsKeepTrack({ name: 'Pads', code: 'note("c4").sound("sine")' }), true)
  assert.equal(isPadsKeepTrack({ name: 'Mic 1', code: 's("jam_mic_2")' }), true)
  assert.equal(isPadsKeepTrack({ name: 'Lead', code: 'note("c4").sound("sine")' }), false)
  const rec = setImprovVoiceInCode('note("c4@2").sound("sine")', 'jam_mic_1')
  assert.match(rec, /note\("c4@2"\)/)
  assert.match(rec, /\.s\("jam_mic_1"\)/)
  assert.doesNotMatch(rec, /\.sound\(/)
  const kit = setImprovVoiceInCode('note("c4@2").s("jam_mic_1")', 'sawtooth')
  assert.match(kit, /\.sound\("sawtooth"\)/)
  assert.doesNotMatch(kit, /jam_mic/)
  console.log('pads keep voice swap ok')
}


{
  // noteAt must carry octave past B (A minor: b4 → c5, not c4)
  const pads = layoutImprovPads('a', 'minor', 4, null)
  const notes = pads.filter((p) => p.enabled).map((p) => p.note!)
  assert.deepEqual(notes, ['a4', 'b4', 'c5', 'd5', 'e5', 'f5', 'g5', 'a5'], 'A minor pads ascend')
  console.log('A minor pads ascend ok')
}


{
  // walk-aware hold cap: N=4 allows 16 beats / .slow(4); N=1 caps at 4
  assert.equal(quantizeBeats(8, 120, 1), 4, 'N=1 caps at 4 beats')
  assert.equal(quantizeBeats(8, 120, 2), 8, 'N=2 caps at 8')
  assert.equal(quantizeBeats(8, 120, 3), 12, 'N=3 allows 12')
  assert.equal(quantizeBeats(8, 120, 4), 16, 'N=4 allows 16')
  const longN4 = hitsToNoteCode(
    [{ note: 'c3', cycle: 0, dur: 8, velocity: 1, at: 20_000 }],
    'sine',
    120,
    undefined,
    4,
  )
  assert.match(longN4, /note\("c3@16"\)/, longN4)
  assert.match(longN4, /\.slow\(4\)/, longN4)
  const longN1 = hitsToNoteCode(
    [{ note: 'c3', cycle: 0, dur: 8, velocity: 1, at: 20_000 }],
    'sine',
    120,
    undefined,
    1,
  )
  assert.match(longN1, /note\("c3@4"\)/, longN1)
  assert.doesNotMatch(longN1, /slow/, longN1)
  const micLong = hitsToNoteCode(
    [{ note: 'c3', cycle: 0, dur: 8, velocity: 1, at: 20_000 }],
    'jam_mic_1',
    120,
    0.4,
    4,
  )
  assert.match(micLong, /note\("c3@16"\)/, micLong)
  assert.match(micLong, /\.slow\(4\)/, micLong)
  assert.match(micLong, /\.speed\(/, micLong)
  console.log('walk-aware keep hold ok')
}

{
  assert.equal(shiftNoteBySemis('c3', 2), 'd3')
  assert.equal(shiftNoteBySemis('c3', -1), 'b2')
  assert.equal(bakedWalkLengthFromCode('note("c3@16").s("jam_mic_1").slow(4)'), 4)
  assert.equal(bakedWalkLengthFromCode('note("c3@4").s("jam_mic_1")'), 1)
  assert.equal(bakedWalkLengthFromCode('s("jam_mic_1")'), null)

  const kept = 'note("c3@16").s("jam_mic_1").speed(0.1).stretch(9).clip(1).slow(4).room(0.4)'
  // Same walk N → pitch only; smear / @ / slow frozen
  const same = refitMicKeepCode(kept, {
    walkLength: 4,
    bpm: 120,
    takeSec: 0.5,
    pitchSemis: 2,
  })
  assert.match(same, /note\("d3@16"\)/, same)
  assert.match(same, /\.speed\(0\.1\)/, same)
  assert.match(same, /\.stretch\(9\)/, same)
  assert.match(same, /\.slow\(4\)/, same)
  assert.match(same, /\.room\(0\.4\)/, same)
  assert.doesNotMatch(same, /@12|@8[^0-9]/, same)

  // Walk changed 4→2 → full refit + pitch
  const changed = refitMicKeepCode(kept, {
    walkLength: 2,
    bpm: 120,
    takeSec: 0.5,
    pitchSemis: -1,
  })
  assert.match(changed, /jam_mic_1/, changed)
  assert.match(changed, /note\("b2@8"\)/, changed)
  assert.match(changed, /\.slow\(2\)/, changed)
  assert.match(changed, /\.speed\(/, changed)
  assert.doesNotMatch(changed, /\.slow\(4\)/, changed)

  // Plain mic → always refit to current N
  const plain = refitMicKeepCode('s("jam_mic_2")', {
    walkLength: 3,
    bpm: 120,
    takeSec: 0.4,
    pitchSemis: 1,
  })
  assert.match(plain, /jam_mic_2/, plain)
  assert.match(plain, /@12/, plain)
  assert.match(plain, /\.slow\(3\)/, plain)
  console.log('refitMicKeepCode same-N pitch / changed-N refit ok')
}


{
  // Short sentence on walk 2/3 must rest-pad to N×4 and .slow(N) — not .slow(~1.75) mid-walk tile
  const t0 = 20_000
  const shortSentence = [
    { note: 'c4', cycle: 0, dur: 0.25, velocity: 1, at: t0 },
    { note: 'eb4', cycle: 0, dur: 0.25, velocity: 1, at: t0 + 1250 },
    { note: 'g4', cycle: 0, dur: 0.25, velocity: 1, at: t0 + 2000 },
    { note: 'c5', cycle: 0, dur: 0.25, velocity: 1, at: t0 + 3250 },
  ]
  const noteBeats = (code: string) => {
    const inner = code.match(/note\("([^"]+)"\)/)![1]!
    return inner.split(/\s+/).reduce((n, tok) => n + tokenBeats(tok), 0)
  }
  // 7 beats raw → pad to 8 / .slow(2) (not ~1.75)
  const w2 = hitsToNoteCode(shortSentence, 'sine', 120, undefined, 2)
  assert.equal(noteBeats(w2), 8, w2)
  assert.match(w2, /\.slow\(2\)/, w2)
  assert.doesNotMatch(w2, /\.slow\(1\.75\)/, w2)
  assert.match(w2, /c4@0\.5 ~@2 eb4@0\.5 ~ g4@0\.5 ~@2 c5@0\.5 ~/, w2)

  const w3 = hitsToNoteCode(shortSentence, 'sine', 120, undefined, 3)
  assert.equal(noteBeats(w3), 12, w3)
  assert.match(w3, /\.slow\(3\)/, w3)

  const w4 = hitsToNoteCode(shortSentence, 'sine', 120, undefined, 4)
  assert.equal(noteBeats(w4), 16, w4)
  assert.match(w4, /\.slow\(4\)/, w4)

  // Long single hold already spans walk — unchanged full-walk bake
  for (const n of [2, 3, 4] as const) {
    const held = hitsToNoteCode(
      [{ note: 'c3', cycle: 0, dur: 8, velocity: 1, at: t0 }],
      'sine',
      120,
      undefined,
      n,
    )
    assert.match(held, new RegExp(`note\\("c3@${n * 4}"\\)`), held)
    assert.match(held, new RegExp(`\\.slow\\(${n}\\)`), held)
  }
  console.log('keep rest-pad to walk N ok')
}

console.log('improv-plate-smoke.test.ts: ok')
