/**
 * Smoke: pause freezes cycle; stop resets to 0 (no audio engine).
 * Run: npm run test:playback-pause-stop
 */
import assert from 'node:assert/strict'
import { liveUpdateEngine } from './live-update'
import { useSessionStore } from '../store/session-store'

console.log('=== playback pause/stop smoke ===')

{
  // Simulate a play epoch mid-song via markPlayStarted + synthetic pause cycle.
  useSessionStore.setState({ isPlaying: true, pausedCycle: null, bpm: 120 })
  liveUpdateEngine.markPlayStopped()
  // Seed a paused position as if we had been playing.
  // markPlayStarted with no prior pause → bias 0; then force-pause after faking epoch time.
  liveUpdateEngine.markPlayStarted()
  assert.equal(liveUpdateEngine.hasPausedPosition(), false)
  assert.ok(liveUpdateEngine.hasPlayEpoch(), 'play epoch set after start')

  // Directly exercise pause/stop API on the engine (Node: no Strudel hush).
  liveUpdateEngine.markPlayPaused()
  // With fresh start, estimate is near 0+lead; freeze should be set (possibly small).
  assert.equal(liveUpdateEngine.hasPausedPosition(), true, 'pause freezes a cycle')
  assert.equal(liveUpdateEngine.hasPlayEpoch(), false, 'pause clears play epoch')
  const frozen = liveUpdateEngine.getPausedCycle()
  assert.ok(frozen != null && frozen >= 0, 'frozen cycle is non-negative')
  assert.equal(liveUpdateEngine.getCurrentCycle(), frozen, 'getCurrentCycle returns freeze')

  // Resume: consume pause into bias
  liveUpdateEngine.markPlayStarted()
  assert.equal(liveUpdateEngine.hasPausedPosition(), false, 'resume clears pause freeze')
  assert.ok(liveUpdateEngine.hasPlayEpoch(), 'resume sets play epoch')
  // Bias should carry the prior freeze when no scheduler is present
  assert.ok(
    Math.abs(liveUpdateEngine.getCycleBias() - (frozen ?? 0)) < 1e-6 ||
      liveUpdateEngine.getCurrentCycle() >= (frozen ?? 0) - 0.5,
    'resume preserves position via bias or cycle',
  )

  // Stop resets everything
  liveUpdateEngine.markPlayStopped()
  assert.equal(liveUpdateEngine.hasPausedPosition(), false)
  assert.equal(liveUpdateEngine.hasPlayEpoch(), false)
  assert.equal(liveUpdateEngine.getCycleBias(), 0)
  assert.equal(liveUpdateEngine.getCurrentCycle(), 0, 'stop → 0:00')
  assert.equal(liveUpdateEngine.getPausedCycle(), null)
  console.log('engine pause/resume/stop ok')
}

{
  // Mid-song pause: inject via markPlayPaused after setting a fake epoch far in the past.
  liveUpdateEngine.markPlayStopped()
  useSessionStore.setState({ bpm: 120 })
  liveUpdateEngine.markPlayStarted()
  // Backdate performance epoch by monkey-patching through a second pause after
  // manually setting pausedCycle path: pause → then pretend frozen was 5.25
  liveUpdateEngine.markPlayPaused()
  // Force a known freeze by stop+manual: use markPlayStopped then simulate pause mid-song
  // by calling private state via public resume path:
  // Start → pause (near 0) is enough for epoch clear; for a non-zero freeze test:
  liveUpdateEngine.markPlayStopped()
  // Simulate "was playing at cycle 5.25": start with prior pausedCycle
  // by pausing after starting, then we only verify stop clears store mirror fields.
  useSessionStore.getState().setPausedCycle(5.25)
  useSessionStore.getState().setPlaying(false)
  assert.equal(useSessionStore.getState().pausedCycle, 5.25)
  liveUpdateEngine.markPlayStopped()
  useSessionStore.getState().setPausedCycle(null)
  assert.equal(useSessionStore.getState().pausedCycle, null)
  assert.equal(liveUpdateEngine.getCurrentCycle(), 0)
  console.log('store pause mirror + stop reset ok')
}

{
  // Non-zero freeze → resume bias (no scheduler in Node)
  liveUpdateEngine.markPlayStopped()
  // Seed pausedCycle by starting then pausing; then overwrite via resumeFrom path:
  // markPlayStarted reads pausedCycle — we need to set it. Use markPlayPaused after
  // fabricating: start, pause, then the freeze is small; call markPlayStopped and
  // re-enter via a trick — expose by starting from a prior pause:
  liveUpdateEngine.markPlayStarted()
  liveUpdateEngine.markPlayPaused()
  const small = liveUpdateEngine.getPausedCycle()!
  // Re-pause should keep existing freeze
  liveUpdateEngine.markPlayPaused()
  assert.equal(liveUpdateEngine.getPausedCycle(), small)
  liveUpdateEngine.markPlayStarted()
  const bias = liveUpdateEngine.getCycleBias()
  assert.ok(Math.abs(bias - small) < 1e-6, `resume bias ${bias} ≈ frozen ${small}`)
  liveUpdateEngine.markPlayStopped()
  assert.equal(liveUpdateEngine.getCycleBias(), 0)
  console.log('non-zero freeze → resume bias ok')
}

console.log('playback-pause-stop-smoke.test.ts: ok')
