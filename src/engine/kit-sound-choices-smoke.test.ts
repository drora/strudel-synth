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

// Nobank (Uzu Core): dirt samples for drum roles — not synth tiles
const uzu = getKit('techno-uzu-core')
assert.ok(uzu, 'Uzu Core kit')
assert.equal(uzu!.drumsBank, 'uzu')
const uzuFx = soundChoicesForKit('fx', uzu)
assert.ok(uzuFx.length > 0, 'uzu fx choices')
assert.ok(
  !uzuFx.some((c) => c.sound === 'sawtooth' || c.id.includes('saw')),
  `uzu fx must not be synth-first; got ${uzuFx.map((c) => c.id).join(',')}`,
)
const clapTile = uzuFx.find((c) => c.sound === 'cp' || c.label.toLowerCase().includes('clap'))
assert.ok(clapTile, 'uzu fx includes clap/cp')
assert.equal(clapTile!.sound, 'cp')
const clapCode = 's("~ cp ~ cp").gain(0.7)'
assert.ok(matchSoundChoice(clapCode, clapTile!), 'matchSoundChoice clap on nobank fx')
assert.ok(!matchSoundChoice(clapCode, uzuFx.find((c) => c.sound === 'rd')!), 'ride not selected for cp pattern')

const uzuDrums = soundChoicesForKit('drums', uzu)
assert.ok(uzuDrums.every((c) => c.sound === 'bd' || c.sound === 'sd'), 'uzu drums = bd/sd')
assert.ok(!uzuDrums[0]?.sound?.includes('saw'), 'no sawtooth-first on uzu drums')

const uzuHats = soundChoicesForKit('hihats', uzu)
assert.deepEqual(uzuHats.map((c) => c.sound), ['hh', 'oh'])

const appliedCp = applySoundChoiceToCode(clapCode, uzuFx.find((c) => c.sound === 'rim')!)
assert.ok(appliedCp.includes('rim'), `apply rewrites s() to rim; got ${appliedCp}`)
assert.ok(!appliedCp.includes('.sound('), 'nobank sample apply uses s() rewrite not .sound()')

// Missing-catalog bank (TR-606 / DR-110 absent from FX SOUND_CHOICES): fallback tile + match
const kit606 = getKit('techno-minimal606')
assert.ok(kit606, 'Minimal 606 kit')
assert.equal(kit606!.drumsBank, 'RolandTR606')
const fx606 = soundChoicesForKit('fx', kit606)
assert.ok(fx606[0]?.bank === 'RolandTR606', `606 fx first tile bank=${fx606[0]?.bank}`)
assert.ok(
  fx606.some((c) => c.bank === 'RolandTR606'),
  '606 fx choices include RolandTR606 fallback',
)
const code606 = 's("~ cp ~ cp").bank("RolandTR606")'
assert.ok(
  matchSoundChoice(code606, fx606.find((c) => c.bank === 'RolandTR606')!),
  'matchSoundChoice bank fallback on TR-606 fx',
)

const kit110 = getKit('ambient-dr110-soft')
assert.ok(kit110, 'DR-110 Soft kit')
const hats110 = soundChoicesForKit('hihats', kit110)
assert.ok(
  hats110.some((c) => c.bank === 'BossDR110'),
  'DR-110 hats include BossDR110 fallback (missing from hats catalog)',
)
const drums110 = soundChoicesForKit('drums', kit110)
assert.ok(drums110[0]?.bank === 'BossDR110', 'DR-110 drums still prioritize catalog tile')

const vox = SOUND_CHOICES.vox
assert.deepEqual(
  vox.map((c) => c.sound),
  ['hmm', 'speechless', 'breath', 'diphone'],
  'vox tiles are real vocals, not mouth/yeah/auto',
)
assert.ok(!vox.some((c) => ['mouth', 'yeah', 'auto'].includes(c.sound ?? '')))

console.log('ok — tabla native, Punch 909 prioritizes RolandTR909, amen/mridangam, nobank dirt, bank fallback, match/apply, vox vocals')
