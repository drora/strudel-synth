/**
 * Tiny smoke: suggestFromKitProfile ranking (bank / note / sample / sound).
 * Run: npx --yes tsx src/engine/kit-suggest-smoke.test.ts
 * Or:  npm run test:kit-suggest
 */
import assert from 'node:assert/strict'
import { getKit, resolveShuffleProfile } from './kits'
import { suggestFromKitProfile, mergeKitSuggestions } from './kit-suggest'
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

console.log('ALL CHECKS PASSED')
