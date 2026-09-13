/**
 * Intensity L3/L4 shared spawn: same lane id+code across 3↔4; edits persist.
 * Run: npx --yes tsx src/engine/intensity-session-smoke.test.ts
 * Or:  npm run test:intensity-session
 */
import assert from 'node:assert/strict'
import { intensityLevelsShareSpawn } from './intensity'

function installLocalStorage() {
  const g = globalThis as typeof globalThis & { localStorage?: Storage; window?: typeof globalThis }
  if (g.localStorage) return
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  if (typeof g.window === 'undefined') g.window = globalThis
}

console.log('=== Intensity session smoke ===')

{
  assert.equal(intensityLevelsShareSpawn(3, 4), true)
  assert.equal(intensityLevelsShareSpawn(4, 3), true)
  assert.equal(intensityLevelsShareSpawn(2, 3), false)
  assert.equal(intensityLevelsShareSpawn(3, 2), false)
  assert.equal(intensityLevelsShareSpawn(1, 4), false)
  console.log('  intensityLevelsShareSpawn: 3↔4 share; others do not')
}

installLocalStorage()

const { useSessionStore } = await import('../store/session-store.ts')
const { useJamStore } = await import('../store/jam-store.ts')
const { applyKit, applyMutate } = await import('./jam-actions.ts')
const { KITS } = await import('./kits.ts')

{
  const kit = KITS.find((k) => !k.tracks.some((t) => t.role === 'pad')) ?? KITS[0]!
  const applied = applyKit(kit.id, { fromPicker: true })
  assert.equal(applied.ok, true, 'applyKit')

  const jam = useJamStore.getState()
  jam.resetIntensitySession()
  jam.setIntensityLevel(1)

  // Climb 1 → 2 → 3
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 2)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)

  const spawnId = useJamStore.getState().spawnedPadId
  assert.ok(spawnId, 'L3 spawns a lane')
  const spawnAt3 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(spawnAt3, 'spawned track present at L3')
  const codeAt3 = spawnAt3!.code
  assert.ok(codeAt3.length > 0)

  // Mutate spawn code at L3
  const editedAt3 = `${codeAt3}/*l3-edit*/`
  useSessionStore.getState().setCode(spawnId!, editedAt3)

  // 3 → 4: same id + same code (no reshuffle)
  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 4)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, 'L4 keeps same spawn id')
  const at4 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(at4, 'spawn still present at L4')
  assert.equal(at4!.code, editedAt3, 'L4 keeps L3-edited spawn code')

  // Edit at L4
  const editedAt4 = `${editedAt3}/*l4-edit*/`
  useSessionStore.getState().setCode(spawnId!, editedAt4)

  // 4 → 3: same id + L4-edited code
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, '3←4 keeps same spawn id')
  const back3 = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(back3, 'spawn still present back at L3')
  assert.equal(back3!.code, editedAt4, '3←4 keeps L4-edited spawn code')

  // 3 → 2 drops spawn; 2 → 3 restores latest shared spawn from snaps
  assert.equal(applyMutate('intensity-down').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 2)
  assert.equal(useJamStore.getState().spawnedPadId, null, 'L2 drops spawn')
  assert.ok(!useSessionStore.getState().tracks.some((t) => t.id === spawnId), 'spawn track removed at L2')

  assert.equal(applyMutate('intensity-up').ok, true)
  assert.equal(useJamStore.getState().intensityLevel, 3)
  assert.equal(useJamStore.getState().spawnedPadId, spawnId, '2→3 restores shared spawn id')
  const restored = useSessionStore.getState().tracks.find((t) => t.id === spawnId)
  assert.ok(restored, 'spawn restored at L3')
  assert.equal(restored!.code, editedAt4, '2→3 restores latest spawn code')

  console.log('  L3↔L4 keep spawn id+code; 2→3 restores latest shared spawn')
}

console.log('ALL INTENSITY SESSION CHECKS PASSED')
