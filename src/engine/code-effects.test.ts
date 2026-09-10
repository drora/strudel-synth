/**
 * Tiny unit test for bank/sound/n + FX toggle helpers.
 * Run: npx --yes tsx src/engine/code-effects.test.ts
 * Or:  npm run test:code-effects
 */
import assert from 'node:assert/strict'
import {
  setBankInCode,
  getBankFromCode,
  setSoundInCode,
  getSoundFromCode,
  setNInCode,
  getNFromCode,
  setEffectInCode,
  removeEffectFromCode,
  parseEffectValue,
  isPatternedEffect,
} from './code-effects'

// --- bank: set / get / replace ---
{
  const base = 's("bd sd").gain(0.8)'
  const withBank = setBankInCode(base, 'RolandTR909')
  assert.match(withBank, /\.bank\("RolandTR909"\)/)
  assert.equal(getBankFromCode(withBank), 'RolandTR909')
  assert.equal(getBankFromCode(base), null)

  const swapped = setBankInCode(withBank, 'RolandTR808')
  assert.equal(getBankFromCode(swapped), 'RolandTR808')
  assert.doesNotMatch(swapped, /RolandTR909/)
}

// --- sound: .sound() and s("...") note lines ---
{
  const soundLine = 'note("c3").sound("sawtooth").gain(0.5)'
  const next = setSoundInCode(soundLine, 'triangle')
  assert.equal(getSoundFromCode(next), 'triangle')
  assert.match(next, /\.sound\("triangle"\)/)

  const sNote = 's("sawtooth").note("c3 e3")'
  const sNext = setSoundInCode(sNote, 'square')
  assert.match(sNext, /^s\("square"\)/)
  // Top-level s("...") has no leading dot — getSoundFromCode reads .sound/.s only
  assert.equal(getSoundFromCode(sNext), null)
  assert.equal(getSoundFromCode('note("c3").s("piano")'), 'piano')
}

// --- n: set / get / floor ---
{
  const base = 's("bd").bank("RolandTR909")'
  const withN = setNInCode(base, 3)
  assert.equal(getNFromCode(withN), 3)
  assert.match(withN, /\.n\(3\)/)

  const replaced = setNInCode(withN, 1.9)
  assert.equal(getNFromCode(replaced), 1)
  assert.equal(getNFromCode(base), null)

  const floored = setNInCode(base, -2)
  assert.equal(getNFromCode(floored), 0)
}

// --- FX toggle: add / clear / scalar parse ---
{
  const base = 's("hh*8").bank("RolandTR909")'
  const withLpf = setEffectInCode(base, 'lpf', 1200)
  assert.equal(parseEffectValue(withLpf, 'lpf'), 1200)
  assert.match(withLpf, /\.lpf\(1200\)/)

  const bumped = setEffectInCode(withLpf, 'lpf', 800)
  assert.equal(parseEffectValue(bumped, 'lpf'), 800)

  const cleared = removeEffectFromCode(bumped, 'lpf')
  assert.equal(parseEffectValue(cleared, 'lpf'), null)
  assert.doesNotMatch(cleared, /\.lpf\(/)
  // bank preserved
  assert.equal(getBankFromCode(cleared), 'RolandTR909')
}

// --- isPatternedEffect ---
{
  const scalar = 's("bd").lpf(800).gain(0.5)'
  assert.equal(isPatternedEffect(scalar, 'lpf'), false)
  assert.equal(isPatternedEffect(scalar, 'gain'), false)
  assert.equal(isPatternedEffect(scalar, 'room'), false)

  const patterned = 's("bd").lpf(sine.range(400,2000)).gain(0.5)'
  assert.equal(isPatternedEffect(patterned, 'lpf'), true)
  assert.equal(isPatternedEffect(patterned, 'gain'), false)

  const expr = 's("hh").room("0.2 0.8")'
  assert.equal(isPatternedEffect(expr, 'room'), true)
}

console.log('code-effects.test.ts: ALL CHECKS PASSED')
