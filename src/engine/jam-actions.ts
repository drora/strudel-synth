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
  addJamTrack,
  setSongHarmony,
  setTrackOctave,
  applyMutate,
} from './jam-actions-a'

export { isTrackShuffleLocked, planShuffleTargets } from './shuffle-lock'

export {
  punchAb,
  toggleAb,
  setLockKit,
  setTrackLock,
  spiceTracks,
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
