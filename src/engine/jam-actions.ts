/**
 * Shared Jam actions used by useJamShell and WebMCP.
 * Split across jam-actions-a (kit/AB/fresh-start) and jam-actions-b (mix/FX/snapshots).
 */
export {
  type JamQueueReason,
  queueLive,
  queueLiveImmediate,
  applyKit,
  undoJam,
  reshuffleUnlocked,
  reshuffleTrackById,
  stashAb,
  resetFreshStartGuard,
  resetFreshStartGuardForTests,
  type FreshStartResult,
  freshStartJam,
} from './jam-actions-a'

export {
  punchAb,
  toggleAb,
  setLockKit,
  setVolume,
  setActiveTrack,
  listSoundChoices,
  applySoundChoice,
  setFx,
  openCodeSheet,
  closeCodeSheet,
  getJamStateSnapshot,
  getPhaseSnapshot,
  listKitsFiltered,
  getKitDetail,
  readFxValue,
  PINNABLE_EFFECTS,
} from './jam-actions-b'
