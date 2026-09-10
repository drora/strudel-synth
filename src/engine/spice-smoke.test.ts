/**
 * Spice must keep the same tune: pattern head (s()/note()…) unchanged; only FX suffix moves.
 */
import assert from 'node:assert/strict'
import { applySpiceToTracks } from './spice'
import { splitEffectSuffix } from './code-effects'
import type { Track } from './types'

function track(id: string, code: string, role: Track['role'] = 'lead'): Track {
  return {
    id,
    name: id,
    role,
    code,
    color: '#fff',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    error: null,
  }
}

console.log('=== Spice FX-only smoke ===')

const samples: { label: string; code: string; role: Track['role'] }[] = [
  { label: 'note', code: 'note("c3 eb3 g3").sound("sawtooth").gain(0.7)', role: 'lead' },
  { label: 's-drums', code: 's("bd sd hh hh").bank("RolandTR909").gain(0.8)', role: 'drums' },
  { label: 's-bass', code: 'note("c2 ~ eb2 g2").sound("triangle").lpf(800)', role: 'bass' },
]

for (const s of samples) {
  const before = splitEffectSuffix(s.code).head
  let changed = false
  // Run several times — random nudge, but head must always stay identical when code changes.
  for (let i = 0; i < 24; i++) {
    const result = applySpiceToTracks([track('t1', s.code, s.role)], 't1')
    assert.ok(result, `${s.label}: spice should produce a change`)
    assert.notEqual(result.code, s.code, `${s.label}: code should change`)
    const after = splitEffectSuffix(result.code).head
    assert.equal(after, before, `${s.label}: pattern head must be unchanged (got ${after!})`)
    // Mini-notation inside s()/note() must still match
    const mini = s.code.match(/(?:s|note)\("([^"]*)"\)/)?.[1]
    assert.ok(mini, `${s.label}: expected s/note mini`)
    assert.ok(
      result.code.includes(`"${mini}"`),
      `${s.label}: mini-string "${mini}" must remain in code`,
    )
    changed = true
  }
  assert.ok(changed)
  console.log(`  ${s.label}: head stable across 24 spices`)
}

// Prefer active track id
{
  const a = track('a', 'note("c4").sound("sawtooth")', 'lead')
  const b = track('b', 's("bd*4").bank("RolandTR808")', 'drums')
  const result = applySpiceToTracks([a, b], 'b')
  assert.ok(result)
  assert.equal(result.trackId, 'b', 'prefer active track when it can change')
  assert.equal(splitEffectSuffix(result.code).head, splitEffectSuffix(b.code).head)
  console.log('  preferTrackId: spices active drum track; head intact')
}

console.log('ALL SPICE CHECKS PASSED')
