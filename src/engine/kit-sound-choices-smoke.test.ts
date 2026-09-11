/**
 * Smoke: kit-scoped Sound sheet choices.
 * Run: npm run test:kit-sound-choices
 */
import assert from 'node:assert/strict'
import { getKit } from './kits'
import { soundChoicesForKit } from './kit-sound-choices'
import { matchSoundChoice, applySoundChoiceToCode } from './kits'
import { getSoundFromCode } from './code-effects'
import { SOUND_CHOICES } from './kits-sound-choices'

console.log('=== Kit sound choices smoke ===')

const tabla = getKit('ambient-tabla')
assert.ok(tabla, 'Tabla Circle kit')
assert.equal(tabla!.drumsBank, 'dirt-tabla')

const tablaDrums = soundChoicesForKit('drums', tabla)
assert.ok(tablaDrums.length > 0, 'tabla drums choices')
assert.ok(
  tablaDrums.every((c) => c.sound?.startsWith('tabla:')),
  `tabla drums should be tabla:* not TR banks; got ${tablaDrums.map((c) => c.id).join(',')}`,
)
assert.ok(!tablaDrums.some((c) => c.bank === 'RolandTR909'), 'no RolandTR909 on tabla')

const tablaHats = soundChoicesForKit('hihats', tabla)
assert.ok(tablaHats.every((c) => c.sound?.startsWith('tabla2:')), 'tabla hats = tabla2:*')

const punch = getKit('techno-punch909')
assert.ok(punch, 'Punch 909 kit')
assert.equal(punch!.drumsBank, 'RolandTR909')
const punchDrums = soundChoicesForKit('drums', punch)
assert.ok(punchDrums[0]?.bank === 'RolandTR909', `Punch 909 first tile bank=${punchDrums[0]?.bank}`)
assert.ok(
  punchDrums.some((c) => c.bank === 'RolandTR909'),
  'Punch 909 includes RolandTR909',
)

const amen = getKit('techno-amen-chop')
assert.ok(amen)
const amenDrums = soundChoicesForKit('drums', amen)
assert.ok(amenDrums.every((c) => c.sound?.startsWith('amencutup:')), 'amen = amencutup:*')

const mrid = getKit('ambient-mridangam')
assert.ok(mrid)
const mridDrums = soundChoicesForKit('drums', mrid)
assert.deepEqual(
  mridDrums.map((c) => c.sound),
  ['mridangam_tha', 'mridangam_thom'],
)

// Melodic: kit melodicSounds first
const melodic = soundChoicesForKit('bass', punch)
const profileFirst = punch!.shuffle.melodicSounds?.[0]
assert.ok(profileFirst)
assert.equal(melodic[0]?.sound, profileFirst, 'bass prioritizes kit melodicSounds')

// No kit → global
const globalDrums = soundChoicesForKit('drums', null)
assert.deepEqual(globalDrums, SOUND_CHOICES.drums)

// match / apply sample-voice lines
const code = 's("tabla:0 ~ tabla:2 ~").gain(1)'
const choice0 = tablaDrums.find((c) => c.sound === 'tabla:0')!
const choice2 = tablaDrums.find((c) => c.sound === 'tabla:2')!
assert.ok(matchSoundChoice(code, choice0), 'match primary tabla:0')
assert.ok(!matchSoundChoice(code, choice2), 'mixed pattern must not highlight tabla:2')
assert.equal(getSoundFromCode(code), 'tabla:0')

const applied = applySoundChoiceToCode(code, tablaDrums.find((c) => c.sound === 'tabla:3')!)
assert.ok(applied.includes('tabla:3'), `apply rewrites to tabla:3; got ${applied}`)
assert.ok(!applied.includes('tabla:0'), 'old hits replaced')

console.log('ok — tabla native, Punch 909 prioritizes RolandTR909, amen/mridangam, match/apply')
