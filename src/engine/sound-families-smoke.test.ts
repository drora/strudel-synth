/**
 * Smoke: sound family grouping is lossless for every role + improv catalog.
 * Run: npm run test:sound-families
 */
import assert from 'node:assert/strict'
import { getKit } from './kits'
import { soundChoicesForKit, improvSoundChoices } from './kit-sound-choices'
import { groupSoundChoices, SOUND_FAMILY_ORDER, soundFamilyForChoice } from './sound-families'
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


// Dirt fm + VCSL didgeridoo are FX; fmpiano stays Keys; sid stays Synths; sitar stays World
{
  assert.equal(
    soundFamilyForChoice({ id: 'dirt-fm', label: 'Dirt FM', sound: 'fm' }),
    'FX',
    'dirt fm → FX',
  )
  assert.equal(
    soundFamilyForChoice({ id: 'didgeridoo', label: 'Didgeridoo', sound: 'didgeridoo' }),
    'FX',
    'didgeridoo → FX (not World)',
  )
  assert.equal(
    soundFamilyForChoice({ id: 'fmpiano', label: 'FM piano', sound: 'fmpiano' }),
    'Keys',
    'fmpiano stays Keys',
  )
  assert.equal(
    soundFamilyForChoice({ id: 'dirt-sid', label: 'Dirt SID', sound: 'sid' }),
    'Synths',
    'sid stays Synths (ambiguous)',
  )
  assert.equal(
    soundFamilyForChoice({ id: 'dirt-sitar', label: 'Dirt sitar', sound: 'sitar' }),
    'World',
    'sitar stays World',
  )
  const fxIds = new Set(soundChoicesForKit('fx', punch).map((c) => c.sound))
  assert.ok(fxIds.has('fm'), 'fx catalog includes fm')
  assert.ok(fxIds.has('didgeridoo'), 'fx catalog includes didgeridoo')
  for (const role of ['lead', 'pad', 'arp', 'bass', 'custom'] as TrackRole[]) {
    const sounds = soundChoicesForKit(role, punch).map((c) => c.sound)
    assert.ok(!sounds.includes('fm'), `${role} catalog dropped fm`)
    assert.ok(!sounds.includes('didgeridoo'), `${role} catalog dropped didgeridoo`)
  }
}

console.log('ok — sound family grouping lossless for all roles + improv')
