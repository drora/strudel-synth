/**
 * WebMCP register-name list — parity tools present.
 * Run: npx --yes tsx src/engine/webmcp-tools-smoke.test.ts
 * Or:  npm run test:webmcp
 */
import assert from 'node:assert/strict'
import { registerWebMcpToolsA } from './webmcp-tools-a'
import { registerWebMcpToolsB } from './webmcp-tools-b'

const names: string[] = []
const register = (def: Record<string, unknown>) => {
  assert.equal(typeof def.name, 'string')
  names.push(def.name as string)
}

registerWebMcpToolsA(register)
registerWebMcpToolsB(register)

const required = [
  'get_session',
  'update_track',
  'shuffle_sounds',
  'set_song_harmony',
  'set_octave',
  'set_track_lock',
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
console.log(`ALL WEBMCP CHECKS PASSED (${names.length} tools)`)
