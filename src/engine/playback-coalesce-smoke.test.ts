/**
 * Smoke: persist-then-start helpers (coalesce in-flight; no audio engine).
 * Run: npm run test:playback-coalesce
 */
import assert from 'node:assert/strict'
import { coalesceInFlight } from './async-coalesce'

console.log('=== playback coalesce smoke ===')

{
  let runs = 0
  const holder: { current: Promise<string> | null } = { current: null }
  const run = () => {
    runs++
    return new Promise<string>((resolve) => {
      setTimeout(() => resolve('started'), 30)
    })
  }
  const a = coalesceInFlight(holder, run)
  const b = coalesceInFlight(holder, run)
  assert.equal(a, b, 'second caller shares the same promise')
  const [ra, rb] = await Promise.all([a, b])
  assert.equal(ra, 'started')
  assert.equal(rb, 'started')
  assert.equal(runs, 1, 'run() only once while in-flight')
  assert.equal(holder.current, null, 'holder cleared after settle')

  const c = coalesceInFlight(holder, run)
  assert.equal(await c, 'started')
  assert.equal(runs, 2, 'new start after prior settle')
  console.log('coalesceInFlight ok')
}

console.log('playback-coalesce-smoke.test.ts: ok')
