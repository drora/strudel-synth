/**
 * Smoke: sound family grouping is lossless for every role + improv catalog.
 * Run: npm run test:sound-families
 */
import assert from 'node:assert/strict'
import { getKit } from './kits'
import { soundChoicesForKit, improvSoundChoices } from './kit-sound-choices'
import { groupSoundChoices, SOUND_FAMILY_ORDER } from './sound-families'
import type { TrackRole } from './types'

console.log('=== Sound families smoke ===')

const punch = getKit('techno-punch909')
assert.ok(punch, 'techno-punch909 kit')

const roles: TrackRole[] = ['bass', 'lead', 'pad', 'arp', 'vox', 'fx', 'drums', 'hihats', 'custom']

function assertLossless(label: string, choices: { id: string }[]) {
  const groups = groupSoundChoices(choices as any)
  const flat = groups.flatMap((g) => g.items)
  assert.equal(flat.length, choices.length, `${label}: length ${flat.length} !== ${choices.length}`)
  const before = new Set(choices.map((c) => c.id))
  const after = new Set(flat.map((c) => c.id))
  assert.equal(after.size, before.size, `${label}: set size`)
  for (const id of before) {
    assert.ok(after.has(id), `${label}: missing id ${id}`)
  }
  for (const g of groups) {
    assert.ok((SOUND_FAMILY_ORDER as readonly string[]).includes(g.family), `${label}: bad family ${g.family}`)
    assert.ok(g.items.length > 0, `${label}: empty group ${g.family}`)
  }
  const other = groups.find((g) => g.family === 'Other')
  console.log(
    `  ${label}: ${choices.length} choices → ${groups.map((g) => `${g.family}:${g.items.length}`).join(', ')}` +
      (other ? ` [Other leftovers: ${other.items.map((c) => c.id).join(', ')}]` : ''),
  )
}

for (const role of roles) {
  assertLossless(role, soundChoicesForKit(role, punch))
}

assertLossless('improv', improvSoundChoices(punch, ['jam_mic_take1', 'jam_mic_foo']))

console.log('ok — sound family grouping lossless for all roles + improv')
