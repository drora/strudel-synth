import assert from 'node:assert/strict'
import {
  drumsBankShortName,
  kitTempoBand,
  filterKits,
  listKitSoftTags,
  pickRandomKit,
} from './kit-browser'
import { KITS } from './kits'

function testBankShort() {
  assert.equal(drumsBankShortName('RolandTR909'), '909')
  assert.equal(drumsBankShortName('RolandTR808'), '808')
  assert.equal(drumsBankShortName('LinnDrum'), 'Linn')
  assert.equal(drumsBankShortName('RolandCompurhythm78'), 'CR78')
}

function testTempoBand() {
  assert.equal(kitTempoBand(85), 'slow')
  assert.equal(kitTempoBand(100), 'mid')
  assert.equal(kitTempoBand(140), 'mid')
  assert.equal(kitTempoBand(141), 'fast')
}

function testFilter() {
  const slow = filterKits(KITS, { tags: ['tempo:slow'] })
  assert.ok(slow.length > 0)
  assert.ok(slow.every((k) => k.bpm < 100))

  const nine = filterKits(KITS, { tags: ['bank:909'] })
  assert.ok(nine.length > 0)
  assert.ok(nine.every((k) => drumsBankShortName(k.drumsBank) === '909'))

  const techno = filterKits(KITS, { tags: ['vibe:techno'] })
  assert.ok(techno.every((k) => k.vibe === 'techno'))

  const both = filterKits(KITS, { tags: ['tempo:mid', 'bank:808'] })
  assert.ok(both.every((k) => k.bpm >= 100 && k.bpm <= 140))
  assert.ok(both.every((k) => drumsBankShortName(k.drumsBank) === '808'))

  const search = filterKits(KITS, { search: '909' })
  assert.ok(search.length > 0)
}

function testSoftTags() {
  const tags = listKitSoftTags(KITS)
  assert.ok(tags.some((t) => t.id === 'tempo:slow'))
  assert.ok(tags.some((t) => t.id === 'bank:909'))
  assert.ok(tags.some((t) => t.id === 'vibe:techno'))
}

function testPick() {
  const a = pickRandomKit(KITS)
  assert.ok(a)
  const b = pickRandomKit([KITS[0]!], KITS[0]!.id)
  assert.equal(b?.id, KITS[0]!.id)
}

testBankShort()
testTempoBand()
testFilter()
testSoftTags()
testPick()
console.log('kit-browser.test.ts: ok')
