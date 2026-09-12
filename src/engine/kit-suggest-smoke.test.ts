/**
 * Tiny smoke: suggestFromKitProfile ranking (bank / note / sample / sound).
 * Run: npx --yes tsx src/engine/kit-suggest-smoke.test.ts
 * Or:  npm run test:kit-suggest
 */
import assert from 'node:assert/strict'
import { getKit, resolveShuffleProfile } from './kits'
import {
  suggestFromKitProfile,
  mergeKitSuggestions,
  dedupeNotesByPitch,
  notePitchKey,
} from './kit-suggest'
import type { KitSuggestion } from './kit-suggest'

function top(sugs: KitSuggestion[], n = 5): string[] {
  return [...sugs].sort((a, b) => b.boost - a.boost).slice(0, n).map((s) => s.label)
}

const punch = getKit('techno-punch909')
const dusty = getKit('lofi-dusty808')
assert.ok(punch && dusty, 'Punch 909 + Dusty 808 present')
const punchProf = resolveShuffleProfile(punch!)
const dustyProf = resolveShuffleProfile(dusty!)

console.log('=== Kit suggest ranking smoke ===')
console.log(`Punch: bank=${punch!.drumsBank} melodic=${punchProf.melodicSounds.join('/')}`)
console.log(`Dusty: bank=${dusty!.drumsBank} melodic=${dustyProf.melodicSounds.join('/')}`)

// bank -- top is kit drumsBank
for (const kit of [punch!, dusty!]) {
  const sugs = suggestFromKitProfile(kit, 'drums', 'bank')
  assert.equal(sugs[0]?.label, kit.drumsBank)
  assert.ok((sugs[0]?.boost ?? 0) >= 90)
  console.log(`  bank ${kit.id}: ${sugs[0]!.label}`)
}

// note -- top primary spellings are in-scale (c minor for both)
const SCALE = new Set([0, 2, 3, 5, 7, 8, 10])
const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']
for (const kit of [punch!, dusty!]) {
  const prof = resolveShuffleProfile(kit)
  const sugs = suggestFromKitProfile(kit, 'bass', 'note')
  const labels = top(sugs, 7).filter((l) => !/^(cs|db|ds|d#|fs|gb|gs|g#|as|a#)/i.test(l)).slice(0, 5)
  for (const lab of labels) {
    const m = lab.match(/^([a-g][#b]?)(\d+)$/i)
    assert.ok(m, `parseable note ${lab}`)
    const idx = NAMES.indexOf(m![1]!.toLowerCase())
    const root = NAMES.indexOf(prof.root.toLowerCase())
    assert.ok(SCALE.has((idx - root + 12) % 12), `${lab} in ${prof.root} ${prof.scale}`)
  }
  assert.ok(labels.some((l) => l.startsWith(prof.root)))
  console.log(`  note ${kit.id}: ${labels.join(', ')}`)
}

// sample (drums) -- kit-boosted hits (boost >= 70) tagged with drumsBank
for (const kit of [punch!, dusty!]) {
  const sugs = suggestFromKitProfile(kit, 'drums', 'sample')
  assert.ok((sugs[0]?.boost ?? 0) >= 50)
  const kitHits = sugs.filter((s) => s.boost >= 70)
  assert.ok(kitHits.some((s) => s.detail === kit.drumsBank || (s.info ?? '').includes('Kit drum')))
  console.log(`  sample ${kit.id}: ${top(sugs, 3).join(', ')}`)
}

// sound -- kit melodicSounds outrank globals
for (const kit of [punch!, dusty!]) {
  const prof = resolveShuffleProfile(kit)
  const sugs = suggestFromKitProfile(kit, 'bass', 'sound')
  const labels = top(sugs, prof.melodicSounds.length)
  assert.ok(labels.every((l) => prof.melodicSounds.includes(l)))
  for (const ms of prof.melodicSounds) {
    const found = sugs.find((s) => s.label === ms)
    assert.ok(found && found.boost >= 80, ms)
  }
  console.log(`  sound ${kit.id}: ${labels.join(', ')}`)
}

// merge -- kit boost wins on duplicate label
{
  const merged = mergeKitSuggestions(
    [{ label: 'sawtooth', boost: 5 }, { label: 'piano', boost: 40 }],
    suggestFromKitProfile(punch!, 'bass', 'sound'),
  )
  const saw = merged.find((m) => m.label === 'sawtooth')
  assert.ok((saw?.boost ?? 0) >= 80)
  assert.ok(punchProf.melodicSounds.includes(merged[0]!.label))
  console.log(`  merge top: ${merged.slice(0, 3).map((m) => m.label).join(', ')}`)
}

// Notes: unique pitch+octave after kit suggest + merge (+ dedupe)
{
  const CANON = new Set(['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'])
  for (const kit of [punch!, dusty!]) {
    const kitNotes = suggestFromKitProfile(kit, 'bass', 'note')
    const pitchNotes = kitNotes.filter((n) => notePitchKey(n.label))
    const kitKeys = pitchNotes.map((n) => notePitchKey(n.label)!)
    assert.equal(kitKeys.length, new Set(kitKeys).size, `${kit.id} kit notes unique pitch`)
    for (const n of pitchNotes) {
      const base = n.label.replace(/\d+$/, '').toLowerCase()
      assert.ok(CANON.has(base), `${kit.id} canonical ${n.label}`)
    }
    const base = [
      { label: 'c#3', boost: 2 },
      { label: 'cs3', boost: 2 },
      { label: 'db3', boost: 2 },
      { label: 'c3', boost: 2 },
    ]
    const merged = dedupeNotesByPitch(mergeKitSuggestions(base, kitNotes))
    const keys = merged.map((m) => notePitchKey(m.label)).filter(Boolean) as string[]
    assert.equal(keys.length, new Set(keys).size, `${kit.id} merged notes unique pitch`)
    const sharp = merged.find((m) => notePitchKey(m.label) === '1|3')
    assert.ok(sharp, `${kit.id} has pc1 oct3`)
    assert.equal(sharp!.label, 'c#3', `${kit.id} prefers canonical c#3 over cs/db`)
    const alias = dedupeNotesByPitch(mergeKitSuggestions(base, kitNotes), { prefix: 'cs' })
    assert.ok(alias.some((a) => a.label === 'cs3'), `${kit.id} prefix cs → cs3`)
    console.log(`  notes unique ${kit.id}: kit=${kitKeys.length} merged=${keys.length} c#3 ok`)
  }
}

// Scale notes: stable order across calls (not shuffled into chaos)
{
  const a = suggestFromKitProfile(punch!, 'bass', 'note')
    .filter((n) => notePitchKey(n.label))
    .map((n) => n.label)
  const b = suggestFromKitProfile(punch!, 'bass', 'note')
    .filter((n) => notePitchKey(n.label))
    .map((n) => n.label)
  assert.deepEqual(a, b, 'scale note labels stable across calls')
  console.log(`  scale notes stable: ${a.slice(0, 5).join(', ')}…`)
}

// Pattern / motif neighbors: can vary across two calls (shuffle-sampled)
{
  const labels = () =>
    suggestFromKitProfile(punch!, 'drums', 'pattern').map((x) => x.label).join('|')
  const melLabels = () =>
    suggestFromKitProfile(punch!, 'lead', 'pattern').map((x) => x.label).join('|')
  let drumVary = false
  let melVary = false
  const d0 = labels()
  const m0 = melLabels()
  for (let i = 0; i < 24; i++) {
    if (labels() !== d0) drumVary = true
    if (melLabels() !== m0) melVary = true
  }
  assert.ok(drumVary, 'drum groove fragments should resample across opens')
  assert.ok(melVary, 'melodic motifs should resample across opens')
  // note() context: single-pitch labels only (no multi-token motifs) + rich detail
  const noteOnly = suggestFromKitProfile(punch!, 'lead', 'note')
  assert.ok(noteOnly.length > 0)
  assert.ok(
    noteOnly.every((n) => notePitchKey(n.label)),
    'note context must be single pitches only',
  )
  assert.ok(
    noteOnly.every((n) => typeof n.detail === 'string' && n.detail.includes(punchProf.root)),
    'note completions should show scale detail (e.g. root + scale)',
  )
  console.log('  pattern/motif resample: drum+lead vary; note() pitches+detail')
}

// Used-note demotion: pitches already in note("…") rank below unused
{
  const kitNotes = suggestFromKitProfile(punch!, 'bass', 'note')
  const labels = kitNotes.map((n) => n.label)
  assert.ok(labels.includes('c3'), 'expected c3 in bass notes')
  const used = dedupeNotesByPitch(kitNotes, { usedInner: 'c3 c3 c3 ' })
  const unusedTop = used.filter((u) => notePitchKey(u.label))
  assert.ok(unusedTop.length > 1)
  assert.notEqual(unusedTop[0]!.label, 'c3', 'used c3 should not be top when unused exist')
  const c3 = unusedTop.find((u) => u.label === 'c3')
  assert.ok(c3, 'c3 still present (demoted, not removed)')
  assert.ok(
    (c3!.boost ?? 0) < (unusedTop[0]!.boost ?? 0),
    'used c3 boost below unused top',
  )
  // Only-match prefix: keep usable boost when every match is already used
  const only = dedupeNotesByPitch(kitNotes, { prefix: 'c3', usedInner: 'c3 c3 ' })
  assert.ok(only.some((o) => o.label === 'c3'))
  const onlyC3 = only.find((o) => o.label === 'c3')!
  assert.ok((onlyC3.boost ?? 0) >= 40, 'sole prefix match keeps kit boost')
  console.log('  used-note demotion: c3 demoted; sole prefix match kept')
}


// Song harmony override: note() suggestions follow songRoot/songScale, not kit shuffle only
{
  const MAJOR = new Set([0, 2, 4, 5, 7, 9, 11])
  const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']
  const song = { root: 'f#', scale: 'major' as const }
  const kitRoot = resolveShuffleProfile(punch!).root
  assert.notEqual(kitRoot.toLowerCase(), 'f#', 'fixture kit root differs from song f#')
  const sugs = suggestFromKitProfile(punch!, 'bass', 'note', song)
  assert.ok(sugs.length > 0)
  const labels = top(sugs, 7).filter((l) => !/^(cs|db|ds|d#|fs|gb|gs|g#|as|a#)/i.test(l)).slice(0, 5)
  for (const lab of labels) {
    const m = lab.match(/^([a-g][#b]?)(\d+)$/i)
    assert.ok(m, `parseable song-harmony note ${lab}`)
    const idx = NAMES.indexOf(m![1]!.toLowerCase())
    const root = NAMES.indexOf('f#')
    assert.ok(MAJOR.has((idx - root + 12) % 12), `${lab} in f# major (song)`)
  }
  assert.ok(labels.some((l) => l.startsWith('f#') || l.startsWith('gb')), 'song root among top notes')
  assert.ok(
    sugs.every((n) => (n.info ?? '').includes('Song scale') || (n.detail ?? '').includes('f#')),
    'note info/detail reflects song scale',
  )
  // usedInner demotion still works with song harmony
  const used = dedupeNotesByPitch(sugs, { usedInner: `${labels[0]} ${labels[0]} ` })
  const unusedTop = used.filter((u) => notePitchKey(u.label))
  assert.notEqual(unusedTop[0]!.label, labels[0], 'used song-scale note demoted')
  // bank suggestions unchanged by harmony (still kit drumsBank)
  const banks = suggestFromKitProfile(punch!, 'drums', 'bank', song)
  assert.equal(banks[0]?.label, punch!.drumsBank)
  console.log(`  song harmony note: ${labels.join(', ')} (kit was ${kitRoot})`)
}


// PR C: song harmony mixolydian F — note suggestions follow SCALE_DEGREES
{
  const MIXO = new Set([0, 2, 4, 5, 7, 9, 10])
  const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']
  const song = { root: 'f', scale: 'mixolydian' as const }
  const sugs = suggestFromKitProfile(punch!, 'lead', 'note', song)
  assert.ok(sugs.length > 0)
  const labels = top(sugs, 8).filter((l) => notePitchKey(l)).slice(0, 7)
  for (const lab of labels) {
    const m = lab.match(/^([a-g][#b]?)(\d+)$/i)
    assert.ok(m, `parseable mixo note ${lab}`)
    const idx = NAMES.indexOf(m![1]!.toLowerCase())
    const root = NAMES.indexOf('f')
    assert.ok(MIXO.has((idx - root + 12) % 12), `${lab} in F mixolydian`)
  }
  assert.ok(labels.some((l) => /^f\d/i.test(l)), 'F root among mixo notes')
  // Full in-scale set includes b7 (eb); maj7 (e natural) must not appear
  const allPcs = sugs.filter((s) => notePitchKey(s.label)).map((s) => s.label.replace(/\d+$/, '').toLowerCase())
  assert.ok(allPcs.includes('eb'), 'mixo b7 (eb) in F mixolydian suggestions')
  assert.ok(!allPcs.includes('e'), 'maj7 e not in F mixolydian')
  assert.ok(allPcs.includes('bb'), 'mixo 4th bb present')
  // scale aliases include mixo / harmonic_minor spellings
  const scaleSugs = suggestFromKitProfile(punch!, 'lead', 'scale', song)
  assert.ok(scaleSugs.some((s) => s.label === 'mixolydian' || s.label === 'mixo'))
  const harm = suggestFromKitProfile(punch!, 'lead', 'scale', { root: 'a', scale: 'harmonic_minor' })
  assert.ok(harm.some((s) => /harmonic/.test(s.label)))
  // motif neighbors for new scales are non-empty (degree-driven, not missing)
  for (const scale of ['mixolydian', 'phrygian', 'lydian', 'harmonic_minor'] as const) {
    const motifs = suggestFromKitProfile(punch!, 'lead', 'pattern', { root: 'f', scale })
    assert.ok(motifs.length > 0, `${scale} melodic motifs`)
    assert.ok(motifs.every((m) => (m.detail ?? '').includes(scale) || (m.info ?? '').includes('fragment')))
  }
  console.log(`  PR C mixolydian F notes: ${labels.join(', ')}`)
}


// Song walk soft-rank: F mixolydian I → bVII → I boosts walk triad tones
{
  const song = {
    root: 'f',
    scale: 'mixolydian' as const,
    walk: [
      { degree: 0, quality: 'maj' as const },
      { degree: 10, quality: 'maj' as const },
      { degree: 0, quality: 'maj' as const },
    ],
  }
  // Walk triads: F–A–C and Eb–G–Bb. Scale-only D (deg 2) is not in those triads.
  const sugs = suggestFromKitProfile(punch!, 'lead', 'note', song)
  const ranked = [...sugs].sort((a, b) => b.boost - a.boost)
  const top5 = ranked.slice(0, 5).map((s) => `${s.label}(${s.boost})`)
  const top8 = ranked.slice(0, 8)
  const top4 = ranked.slice(0, 4)
  const top8Pcs = top8.map((s) => s.label.replace(/\d+$/, '').toLowerCase())
  assert.ok(top8Pcs.includes('f'), `top must include F; got ${top8.map((s) => s.label).join(', ')}`)
  assert.ok(top8Pcs.includes('eb'), `top must include Eb (bVII); got ${top8.map((s) => s.label).join(', ')}`)
  assert.ok(
    ranked.some((s) => s.detail === 'walk' || (s.info ?? '').includes('Song walk')),
    'walk tones tagged walk / Song walk',
  )
  // Scale-only D (deg 2) must not outrank walk triads in the head of the list
  assert.ok(
    !top4.some((s) => /^d\d/i.test(s.label)),
    `D must not be in top 4; top4=${top4.map((s) => s.label).join(', ')}`,
  )
  const dSug = ranked.find((s) => /^d\d/i.test(s.label))
  const walkMin = Math.min(...ranked.filter((s) => s.detail === 'walk').map((s) => s.boost))
  if (dSug) {
    assert.ok(
      (dSug.boost ?? 0) < walkMin,
      `D boost ${dSug.boost} must be below walk min ${walkMin}`,
    )
  }
  // Without walk, C-minor kit notes keep prior behavior (covered by earlier asserts)
  console.log(`  song walk F mixo top5: ${top5.join(', ')}`)
}

console.log('ALL CHECKS PASSED')
