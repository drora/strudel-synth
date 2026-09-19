/**
 * Smoke: kit-scoped Sound sheet choices.
 * Run: npm run test:kit-sound-choices
 */
import assert from 'node:assert/strict'
import { getKit } from './kits'
import { soundChoicesForKit, pickRandomSoundChoice, pickRandomImprovVoice, improvSoundChoices } from './kit-sound-choices'
import { matchSoundChoice, applySoundChoiceToCode } from './kits'
import { primarySSample, getSoundFromCode } from './code-effects'
import { sampleGainBoost, applyVoiceClipToCode, defaultClipForVoice } from './voice-profile'
import { SOUND_CHOICES } from './kits-sound-choices'
import { HIDDEN_PITCHED_CHOICES } from './kits-sound-choices-melodic'

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

// Melodic: role catalog order (kit.melodicSounds does not reorder)
const melodic = soundChoicesForKit('bass', punch)
assert.deepEqual(
  melodic.map((c) => c.sound),
  SOUND_CHOICES.bass.map((c) => c.sound),
  'bass sheet equals SOUND_CHOICES.bass',
)
assert.ok(punch!.shuffle.melodicSounds?.length, 'kit still has melodicSounds field')

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

const leadList = soundChoicesForKit('lead', punch)
const seen = new Set<string>()
for (let i = 0; i < 40; i++) {
  const c = pickRandomSoundChoice('lead', punch)
  assert.ok(c && leadList.some((x) => x.id === c.id), `pick in kit list ${c?.id}`)
  seen.add(c!.id)
}
assert.ok(seen.size >= 2, `+ Track voice variety ${seen.size}`)
const first = leadList[0]!.id
const other = pickRandomSoundChoice('lead', punch, [first])
assert.ok(other && other.id !== first, 'prefer unused sound id')

const padList = improvSoundChoices(punch).filter((c) => c.sound && !c.sound.startsWith('jam_mic_'))
const padSeen = new Set<string>()
for (let i = 0; i < 40; i++) {
  const v = pickRandomImprovVoice(punch)
  assert.ok(v && padList.some((c) => c.sound === v), `pads voice in kit list ${v}`)
  padSeen.add(v!)
}
assert.ok(padSeen.size >= 2, `visit pad voice variety ${padSeen.size}`)
const avoidSaw = pickRandomImprovVoice(punch, 'sawtooth')
assert.ok(avoidSaw && avoidSaw !== 'sawtooth', 'pads visit roll avoids current')

{
  const needed = ['vibraphone', 'harmonica', 'balafon_hard', 'xylophone_hard_ff']
  for (const s of needed) {
    assert.ok(HIDDEN_PITCHED_CHOICES.some((c) => c.sound === s), `hidden ${s}`)
    assert.ok(SOUND_CHOICES.lead.some((c) => c.sound === s), `lead has ${s}`)
  }
  assert.equal(HIDDEN_PITCHED_CHOICES.length, 35)
  // Useful VCSL orphans promoted onto melodic sheets (didgeridoo → FX)
  for (const s of ['psaltery_spiccato', 'vibraphone_bowed']) {
    assert.ok(HIDDEN_PITCHED_CHOICES.some((c) => c.sound === s), `orphan hidden ${s}`)
  }
  assert.ok(SOUND_CHOICES.lead.some((c) => c.sound === 'psaltery_spiccato'), 'lead has psaltery_spiccato')
  assert.ok(!SOUND_CHOICES.bass.some((c) => c.sound === 'didgeridoo'), 'bass dropped didgeridoo')
  assert.ok(!HIDDEN_PITCHED_CHOICES.some((c) => c.sound === 'didgeridoo'), 'hidden dropped didgeridoo')
}


// Dirt one-shots live on FX sheet, not melodic pad/lead (keep sax/gtr/arpy)
{
  const padSounds = SOUND_CHOICES.pad.map((c) => c.sound)
  const leadSounds = SOUND_CHOICES.lead.map((c) => c.sound)
  const fxDirt = SOUND_CHOICES.fx.filter((c) => c.sound).map((c) => c.sound)
  for (const s of ['pad', 'padlong', 'stab', 'hoover', 'pluck', 'juno', 'fm', 'didgeridoo']) {
    assert.ok(fxDirt.includes(s), `fx has ${s}`)
  }
  assert.ok(!padSounds.includes('pad') && !padSounds.includes('padlong'), 'pad sheet dropped dirt pads')
  assert.ok(!leadSounds.includes('stab') && !leadSounds.includes('hoover'), 'lead dropped stab/hoover')
  assert.ok(!leadSounds.includes('pluck') && !leadSounds.includes('juno'), 'lead dropped pluck/juno')
  assert.ok(['sax', 'gtr', 'arpy'].every((s) => leadSounds.includes(s)), 'lead keeps sax/gtr/arpy')
  assert.ok(!leadSounds.includes('fm'), 'lead dropped dirt fm')
  assert.ok(!SOUND_CHOICES.arp.some((c) => c.sound === 'fm'), 'arp dropped dirt fm')
  assert.ok(!SOUND_CHOICES.custom.some((c) => c.sound === 'fm'), 'custom dropped dirt fm')
  assert.ok(SOUND_CHOICES.fx.some((c) => c.sound === 'fm'), 'fx has dirt fm')
  assert.ok(!leadSounds.includes('didgeridoo'), 'lead dropped didgeridoo')
  assert.ok(!padSounds.includes('didgeridoo'), 'pad dropped didgeridoo')
  assert.ok(!SOUND_CHOICES.arp.some((c) => c.sound === 'didgeridoo'), 'arp dropped didgeridoo')
  assert.ok(!SOUND_CHOICES.custom.some((c) => c.sound === 'didgeridoo'), 'custom dropped didgeridoo')
  assert.ok(SOUND_CHOICES.fx.some((c) => c.sound === 'didgeridoo'), 'fx has didgeridoo')
  const fmApplied = applySoundChoiceToCode(
    's("cp ~ ~ cp").bank("RolandTR909").gain(0.8)',
    { id: 'dirt-fm', label: 'Dirt FM', sound: 'fm' },
  )
  assert.equal(fmApplied, 's("fm").gain(0.8)', `dirt fm apply; got ${fmApplied}`)
  const digApplied = applySoundChoiceToCode(
    's("cp ~ ~ cp").bank("RolandTR909").gain(0.8)',
    { id: 'didgeridoo', label: 'Didgeridoo', sound: 'didgeridoo' },
  )
  assert.equal(digApplied, 's("didgeridoo").gain(0.8)', `didgeridoo apply; got ${digApplied}`)
  assert.ok(SOUND_CHOICES.arp.some((c) => c.sound === 'arpy'), 'arp keeps arpy')
  assert.ok(!SOUND_CHOICES.arp.some((c) => c.sound === 'pluck'), 'arp dropped pluck')

  const applied = applySoundChoiceToCode(
    's("cp ~ ~ cp").bank("RolandTR909").gain(0.8)',
    { id: 'dirt-pad', label: 'Dirt pad', sound: 'pad' },
  )
  assert.equal(applied, 's("pad").gain(0.8)', `dirt pad apply cleared bank; got ${applied}`)
  assert.ok(matchSoundChoice(applied, { id: 'dirt-pad', label: 'Dirt pad', sound: 'pad' }))
}



// Voice profiles: gain cuts/boosts + wash auto-clip on Sound apply
{
  assert.ok(sampleGainBoost('sax') < 1, 'sax gain cut')
  assert.equal(sampleGainBoost('marimba'), 8)
  assert.equal(sampleGainBoost('arpy'), 1)
  assert.equal(defaultClipForVoice('sax', 'lead'), 0.2)
  assert.equal(defaultClipForVoice('arpy', 'lead'), null)
  assert.equal(defaultClipForVoice('sax', 'fx'), null)

  const saxLead = applySoundChoiceToCode(
    'note("c4 ~ eb4").sound("sine").gain(0.7)',
    { id: 'sax', label: 'Sax', sound: 'sax' },
    'lead',
  )
  assert.ok(saxLead.includes('.sound("sax")'), `sax sound; got ${saxLead}`)
  assert.ok(saxLead.includes('.clip(0.2)'), `sax lead auto-clip; got ${saxLead}`)

  const arpyLead = applySoundChoiceToCode(
    'note("c4 ~ eb4").sound("sine").gain(0.7)',
    { id: 'arpy', label: 'Arpy', sound: 'arpy' },
    'lead',
  )
  assert.ok(arpyLead.includes('.sound("arpy")'), `arpy sound; got ${arpyLead}`)
  assert.ok(!arpyLead.includes('.clip('), `arpy lead no clip; got ${arpyLead}`)

  // Switching wash → short clears auto default clip
  const cleared = applyVoiceClipToCode('note("c4").sound("sax").clip(0.2)', 'arpy', 'lead')
  assert.ok(!cleared.includes('.clip('), `clear auto clip; got ${cleared}`)
  // User override clip survives leave-wash
  const kept = applyVoiceClipToCode('note("c4").sound("sax").clip(0.8)', 'arpy', 'lead')
  assert.ok(kept.includes('.clip(0.8)'), `keep user clip; got ${kept}`)
}


// GM useful set on role catalogs + voice-profile wash/default keys
{
  assert.ok(SOUND_CHOICES.pad.some((c) => c.sound === 'gm_string_ensemble_1'), 'pad has String ensemble')
  assert.ok(SOUND_CHOICES.lead.some((c) => c.sound === 'gm_violin'), 'lead has Violin')
  assert.ok(SOUND_CHOICES.bass.some((c) => c.sound === 'gm_cello'), 'bass has Cello')
  // Spread of new GM across roles (not novelty)
  assert.ok(SOUND_CHOICES.bass.some((c) => c.sound === 'gm_acoustic_bass'), 'bass has GM Acoustic bass')
  assert.ok(SOUND_CHOICES.lead.some((c) => c.sound === 'gm_flute'), 'lead has GM Flute')
  assert.ok(SOUND_CHOICES.pad.some((c) => c.sound === 'gm_pad_warm'), 'pad has GM Pad warm')
  assert.ok(SOUND_CHOICES.arp.some((c) => c.sound === 'gm_kalimba'), 'arp has GM Kalimba')
  assert.ok(SOUND_CHOICES.fx.some((c) => c.sound === 'gm_orchestra_hit'), 'fx has GM Orchestra hit')
  // FX-flavored WTs moved off melodic
  for (const role of ['bass', 'lead', 'pad', 'arp'] as const) {
    assert.ok(!SOUND_CHOICES[role].some((c) => c.sound === 'wt_digital_crickets'), `${role} no WT crickets`)
    assert.ok(!SOUND_CHOICES[role].some((c) => c.sound === 'wt_digital_curses'), `${role} no WT curses`)
  }
  assert.ok(SOUND_CHOICES.fx.some((c) => c.sound === 'wt_digital_crickets'), 'fx has WT crickets')
  assert.ok(SOUND_CHOICES.lead.some((c) => c.sound === 'wt_digital_basique'), 'lead keeps WT basique')
  // Novelty must NOT pollute melodic pools
  for (const role of ['bass', 'lead', 'pad', 'arp'] as const) {
    assert.ok(!SOUND_CHOICES[role].some((c) => c.sound === 'gm_gunshot'), `${role} excluded gunshot`)
    assert.ok(!SOUND_CHOICES[role].some((c) => c.sound === 'gm_helicopter'), `${role} excluded helicopter`)
    assert.ok(!SOUND_CHOICES[role].some((c) => c.sound === 'pad'), `${role} no dirt pad`)
    assert.ok(!SOUND_CHOICES[role].some((c) => c.sound === 'stab'), `${role} no dirt stab`)
  }
  assert.equal(sampleGainBoost('gm_string_ensemble_1'), 0.95, 'ensemble mild wash gain')
  assert.equal(defaultClipForVoice('gm_string_ensemble_1', 'pad'), 0.55)
  assert.equal(defaultClipForVoice('gm_violin', 'lead'), 0.2)
  assert.equal(defaultClipForVoice('gm_cello', 'bass'), 0.2)
  assert.equal(sampleGainBoost('gm_piano'), 0.85, 'gm default held gain')
  assert.equal(defaultClipForVoice('gm_pad_warm', 'pad'), 0.55, 'gm pad wash clip')
  assert.equal(sampleGainBoost('gm_pad_warm'), 1.15, 'gm quiet wash pad boost')
  assert.equal(sampleGainBoost('gm_flute'), 1.45, 'gm quiet wash flute boost')
  assert.equal(defaultClipForVoice('gm_flute', 'lead'), 0.2, 'gm flute wash clip')
  assert.equal(defaultClipForVoice('gm_clarinet', 'lead'), 0.2, 'gm clarinet wash clip')
  assert.equal(defaultClipForVoice('gm_alto_sax', 'lead'), 0.2, 'gm alto sax wash clip')
  assert.equal(defaultClipForVoice('gm_bagpipe', 'lead'), 0.2, 'gm bagpipe wash clip')
  assert.equal(defaultClipForVoice('gm_fiddle', 'lead'), 0.2, 'gm fiddle wash clip')
  assert.equal(defaultClipForVoice('gm_marimba', 'arp'), null, 'gm marimba stays held')
  assert.equal(defaultClipForVoice('gm_piano', 'lead'), null, 'gm piano stays held')
  assert.equal(sampleGainBoost('gm_orchestra_hit'), 0.6, 'gm loud hit cut')
  assert.equal(sampleGainBoost('pipeorgan_quiet'), 6, 'pipeorgan quiet boost')
  assert.equal(defaultClipForVoice('pipeorgan_quiet', 'lead'), 0.2, 'pipeorgan quiet wash')
  assert.equal(sampleGainBoost('vibraphone_bowed'), 8, 'bowed vibes boost')
  assert.equal(defaultClipForVoice('vibraphone_bowed', 'pad'), 0.55, 'bowed vibes wash')
  assert.equal(sampleGainBoost('psaltery_spiccato'), 1.75, 'spiccato mild boost')
  assert.equal(defaultClipForVoice('psaltery_spiccato', 'lead'), null, 'spiccato stays short')
  assert.equal(sampleGainBoost('didgeridoo'), 0.75, 'didgeridoo leave cut')
  assert.equal(defaultClipForVoice('didgeridoo', 'bass'), 0.2, 'didgeridoo wash')
  assert.equal(sampleGainBoost('sid'), 2, 'dirt sid boost')
  assert.equal(defaultClipForVoice('sid', 'lead'), null, 'dirt sid stays short')
  assert.equal(sampleGainBoost('sitar'), 1, 'dirt sitar leave gain')
  assert.equal(defaultClipForVoice('sitar', 'lead'), 0.2, 'dirt sitar wash clip')
  assert.equal(sampleGainBoost('fm'), 0.55, 'dirt fm wash cut')
  assert.equal(defaultClipForVoice('fm', 'arp'), 0.2, 'dirt fm wash clip')
  const ens = applySoundChoiceToCode(
    'note("c3 e3 g3").sound("sine").gain(0.6)',
    { id: 'gm-string-ensemble', label: 'String ensemble', sound: 'gm_string_ensemble_1' },
    'pad',
  )
  assert.ok(ens.includes('.sound("gm_string_ensemble_1")'), `ensemble sound; got ${ens}`)
  assert.ok(ens.includes('.clip(0.55)'), `ensemble pad auto-clip; got ${ens}`)
  const fluteLead = applySoundChoiceToCode(
    'note("c4 ~ eb4").sound("sine").gain(0.7)',
    { id: 'gm-flute', label: 'GM Flute', sound: 'gm_flute' },
    'lead',
  )
  assert.ok(fluteLead.includes('.sound("gm_flute")'), `flute sound; got ${fluteLead}`)
  assert.ok(fluteLead.includes('.clip(0.2)'), `flute lead auto-clip; got ${fluteLead}`)
}


// Sound-only (gm_*) on ANY bank s() lane (drums/hihats/fx): strip bank, rewrite pattern; single highlight
{
  const goblins = { id: 'gm-fx-goblins', label: 'GM Goblins', sound: 'gm_fx_goblins' }
  const bankTile = { id: 'bank-drumtraks', label: 'Drumtraks', bank: 'SequentialCircuitsDrumtracks' }

  const lanes: { role: 'drums' | 'hihats' | 'fx'; code: string }[] = [
    { role: 'drums', code: 's("bd ~ cp ~").bank("SequentialCircuitsDrumtracks").gain(0.8)' },
    { role: 'hihats', code: 's("hh*8").bank("SequentialCircuitsDrumtracks").gain(0.4)' },
    { role: 'fx', code: 's("~ ~ cp ~").bank("SequentialCircuitsDrumtracks").gain(0.55).pan(-0.12).room(0.5)' },
  ]

  for (const { role, code: bankCode } of lanes) {
    // Legacy stacked bug: bank + .sound(gm) — only GM tile selected
    const stacked = `${bankCode}.sound("gm_fx_goblins")`
    assert.ok(matchSoundChoice(stacked, goblins), `${role} stacked: gm selected`)
    assert.ok(!matchSoundChoice(stacked, bankTile), `${role} stacked: bank NOT selected when .sound present`)

    const applied = applySoundChoiceToCode(bankCode, goblins, role)
    assert.ok(!applied.includes('.bank('), `${role}: gm apply clears bank; got ${applied}`)
    assert.ok(!applied.includes('.sound('), `${role}: gm apply uses s() not .sound; got ${applied}`)
    assert.equal(primarySSample(applied), 'gm_fx_goblins', `${role}: primary is goblins; got ${applied}`)
    assert.ok(matchSoundChoice(applied, goblins), `${role} applied: gm selected`)
    assert.ok(!matchSoundChoice(applied, bankTile), `${role} applied: bank not selected`)

    // Switching back to bank strips stray .sound
    const back = applySoundChoiceToCode(stacked, bankTile, role)
    assert.ok(back.includes('.bank("SequentialCircuitsDrumtracks")'), `${role} bank restore; got ${back}`)
    assert.ok(!back.includes('.sound('), `${role} bank restore strips .sound; got ${back}`)
    assert.ok(matchSoundChoice(back, bankTile), `${role} bank restore: bank selected`)
    assert.ok(!matchSoundChoice(back, goblins), `${role} bank restore: gm not selected`)
  }

  // Melodic note() lines still use setSoundInCode (keep note path)
  const melodic = applySoundChoiceToCode(
    'note("c4 ~ eb4").sound("sine").gain(0.7)',
    goblins,
    'lead',
  )
  assert.ok(melodic.includes('.sound("gm_fx_goblins")'), `note() keeps .sound path; got ${melodic}`)
  assert.ok(melodic.includes('note('), `note() preserved; got ${melodic}`)
  assert.ok(!melodic.includes('s('), `note() path does not rewrite s(); got ${melodic}`)
}

console.log('ok — tabla native, Punch 909 prioritizes RolandTR909, amen/mridangam, melodic=catalog, nobank dirt, bank fallback, match/apply, vox vocals, +Track random voice, visit pad voice, voice-profile clip/gain, gm useful set + orphans, gm sound-only strips bank on drums/hihats/fx')
