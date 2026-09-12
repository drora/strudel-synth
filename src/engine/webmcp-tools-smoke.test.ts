/**
 * WebMCP register-name list — parity tools present.
 * Run: npx --yes tsx src/engine/webmcp-tools-smoke.test.ts
 * Or:  npm run test:webmcp
 */
import assert from 'node:assert/strict'
import { registerWebMcpToolsA } from './webmcp-tools-a'
import { registerWebMcpToolsB } from './webmcp-tools-b'
import { useJamStore } from '../store/jam-store'
import { getJamStateSnapshot } from './jam-actions'
import { rollSeed, walkConcertNames } from './song-seed'
import { getKit, KITS } from './kits'
import { listKitsFiltered } from './jam-actions'

const names: string[] = []
const defs: Record<string, Record<string, unknown>> = {}
const register = (def: Record<string, unknown>) => {
  assert.equal(typeof def.name, 'string')
  names.push(def.name as string)
  defs[def.name as string] = def
}

registerWebMcpToolsA(register)
registerWebMcpToolsB(register)

const required = [
  'get_session',
  'get_jam_state',
  'add_track',
  'update_track',
  'shuffle_sounds',
  'set_song_harmony',
  'set_octave',
  'set_track_lock',
  'list_kits',
  'list_mutations',
  'apply_mutate',
  'spice',
  'spice_tracks',
  'set_lock_kit',
]

console.log('=== WebMCP tools smoke ===')
for (const n of required) {
  assert.ok(names.includes(n), `missing tool: ${n}`)
  console.log(`  ok ${n}`)
}
assert.equal(new Set(names).size, names.length, 'duplicate tool names')

// PR C: descriptions + songWalk on jam snapshot; list_kits includes E leftover kits
{
  const gs = String(defs.get_session!.description ?? '')
  assert.ok(gs.includes('songWalk'), 'get_session mentions songWalk')
  const gj = String(defs.get_jam_state!.description ?? '')
  assert.ok(gj.includes('songWalk') || gj.includes('songRoot'), 'get_jam_state mentions walk/harmony')
  const add = String(defs.add_track!.description ?? '')
  assert.ok(/seed/i.test(add), 'add_track documents seed-aware generate')
  const harm = String(defs.set_song_harmony!.description ?? '')
  assert.ok(/mixolydian|harmonic_minor/i.test(harm), 'set_song_harmony mentions new ScaleKinds')

  const schema = defs.set_song_harmony!.inputSchema as { properties?: { scale?: { enum?: string[] } } }
  const scaleEnum = schema?.properties?.scale?.enum ?? []
  for (const s of ['mixolydian', 'phrygian', 'lydian', 'harmonic_minor']) {
    assert.ok(scaleEnum.includes(s), `set_song_harmony enum has ${s}`)
  }

  const seed = rollSeed({ root: 'c', scale: 'minor' })
  useJamStore.getState().setSongSeed(seed)
  useJamStore.getState().setSongRoot('c')
  useJamStore.getState().setSongScale('minor')
  const snap = getJamStateSnapshot()
  assert.ok(snap.songWalk, 'jam snapshot songWalk present')
  assert.deepEqual(snap.songWalk!.walk, seed.walk)
  assert.equal(snap.songWalk!.patternId, seed.patternId)
  assert.deepEqual(snap.songWalk!.concertNames, walkConcertNames(seed))
  console.log(`  PR C jam songWalk concertNames: ${snap.songWalk!.concertNames.join(' · ')}`)

  const eIds = ['lofi-ddm110', 'ambient-tg33', 'house-d110', 'lofi-t3', 'techno-krz']
  for (const id of eIds) {
    assert.ok(getKit(id), `E kit ${id} in catalog`)
  }
  const listed = listKitsFiltered({})
  const listedIds = new Set(listed.map((k) => k.id))
  for (const id of eIds) {
    assert.ok(listedIds.has(id), `list_kits includes ${id}`)
  }
  assert.equal(listed.length, KITS.length)
  console.log(`  PR C list_kits E leftovers: ${eIds.join(', ')} (${listed.length} kits)`)
}

console.log(`ALL WEBMCP CHECKS PASSED (${names.length} tools)`)
