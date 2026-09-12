import { useMemo } from 'react'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { PlayButton } from '../transport/PlayButton'
import { SampleLoadingIndicator } from '../transport/SampleLoadingIndicator'
import { JamTrackSheet } from './JamTrackSheet'
import { JamCodeSheet } from './JamCodeSheet'
import { JamMutateSheet } from './JamMutateSheet'
import { JamImprovPlate } from './JamImprovPlate'
import { liveUpdateEngine } from '../../engine/live-update'
import { JamKitPicker } from './JamKitPicker'
import { JamAddTrack } from './JamAddTrack'
import { JamPhaseRing } from './JamPhaseRing'
import { JamMicRec } from './JamMicRec'
import { JamABToggle } from './JamABToggle'
import { useJamShell } from './useJamShell'
import { JamTrackChip } from './JamTrackChip'
import { drumsBankShortName } from '../../engine/kit-browser'
import { resolveCodeOpenTrackId } from '../../engine/last-touched'
import { setSongHarmony } from '../../engine/jam-actions'
import { SONG_ROOTS, SONG_SCALES, SONG_SCALE_LABELS } from '../../engine/note-harmony'
import { walkConcertNames } from '../../engine/song-seed'
import type { ScaleKind } from '../../engine/kits'

function openCodeForTrack(trackId: string | null | undefined) {
  if (!trackId) return
  useSessionStore.getState().setActiveTrack(trackId)
  useJamStore.getState().setCodeTrackId(trackId)
}

export function JamShell() {
  const j = useJamShell()
  const codeTrackId = useJamStore((s) => s.codeTrackId)
  const songSeed = useJamStore((s) => s.songSeed)
  const walkChips = useMemo(
    () => (songSeed ? walkConcertNames(songSeed) : []),
    [songSeed],
  )
  const codeTrack = j.tracks.find((t) => t.id === codeTrackId)

  return (
    <div
      className={`flex flex-col bg-bg w-full flex-1 text-text ${j.isMobile ? 'min-h-0 overflow-hidden' : 'h-full'}`}
      style={j.shellStyle}
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div>
          <div className="text-sm font-semibold tracking-wide">Strudel Studio</div>
          <div className="text-[10px] uppercase tracking-wider text-accent">Jam</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-11 px-3 rounded-lg text-xs font-medium bg-bg-elevated text-text-muted border border-border hover:text-accent"
            onClick={() => {
              const jam = useJamStore.getState()
              const id = resolveCodeOpenTrackId(
                jam.lastTouchedTrackId,
                j.tracks.map((tr) => tr.id),
              )
              openCodeForTrack(id)
            }}
            title="Edit last-modified track code"
          >
            {'<' + '/>'} Code
          </button>
          <button
            type="button"
            className="min-h-11 px-3 rounded-lg text-xs font-medium bg-bg-elevated text-text-muted border border-border hover:text-accent"
            onClick={() => useUIStore.getState().setAppMode('learn')}
          >
            Learn
          </button>
        </div>
      </header>

      {j.showKitLoadingBanner && (
        <div
          className="shrink-0 px-3 py-2 bg-accent/15 border-b border-accent/30 text-accent text-xs font-medium flex items-center justify-between gap-2"
          role="status"
          aria-live="polite"
        >
          <span className="animate-pulse">Loading kit samples…</span>
          <SampleLoadingIndicator compact />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => useJamStore.getState().setShowKitPicker(true)}
            className="flex-1 min-h-12 px-4 rounded-xl border border-accent/40 bg-accent/10 text-left flex items-center justify-between gap-2 hover:border-accent transition-colors"
          >
            <span className="min-w-0">
              <span className="text-sm font-medium text-accent truncate block">
                Kit · {j.activeKit?.name ?? 'Browse kits'}
              </span>
              {j.activeKit && (
                <span className="text-[10px] text-text-muted truncate block">
                  {j.activeKit.bpm} BPM · {drumsBankShortName(j.activeKit.drumsBank)}
                </span>
              )}
            </span>
            <span className="text-accent shrink-0" aria-hidden>
              ▾
            </span>
          </button>
          <JamABToggle />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex-1 min-h-11 px-3 rounded-xl border border-border bg-bg-elevated flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted shrink-0">
              Root
            </span>
            <select
              className="flex-1 min-h-9 bg-transparent text-sm outline-none capitalize"
              value={j.songRoot}
              aria-label="Song root"
              onChange={(e) =>
                setSongHarmony(e.target.value, j.songScale, { remap: true })
              }
            >
              {SONG_ROOTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-h-11 px-3 rounded-xl border border-border bg-bg-elevated flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted shrink-0">
              Scale
            </span>
            <select
              className="flex-1 min-h-9 bg-transparent text-sm outline-none"
              value={j.songScale}
              aria-label="Song scale"
              onChange={(e) =>
                setSongHarmony(j.songRoot, e.target.value as ScaleKind, {
                  remap: true,
                })
              }
            >
              {SONG_SCALES.map((s) => (
                <option key={s} value={s}>
                  {SONG_SCALE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {walkChips.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            aria-label="Chord walk"
          >
            {walkChips.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="shrink-0 min-h-8 px-2.5 rounded-full text-[11px] font-medium border border-border bg-bg-elevated text-text-muted"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center py-2">
          <JamPhaseRing bpm={j.bpm} isPlaying={j.isPlaying} />
          {j.showKitLoadingBanner && (
            <div className="mt-2 text-[11px] text-accent animate-pulse font-medium">
              Loading kit samples…
            </div>
          )}
          <div className="mt-3 w-full max-w-sm mx-auto">
            <div className="text-[10px] uppercase tracking-wider text-text-muted text-center mb-1.5">
              Sounds / FX · tap · M mute · long-press Code
            </div>
            {/* Vertical stack: fixed chip widths (PR #19) — no sideways reflow; page scrolls */}
            <div className="flex flex-col items-center gap-1.5">
              {j.tracks.map((t) => (
                <JamTrackChip
                  key={t.id}
                  track={t}
                  isPlaying={j.isPlaying}
                />
              ))}
              <JamAddTrack />
              <button
                type="button"
                onClick={() => j.setShowImprovPlate(true)}
                className="shrink-0 w-[7.25rem] h-[2.75rem] px-2.5 rounded-lg text-[11px] font-medium border border-border bg-bg-elevated text-text-muted hover:text-text box-border"
                title="Improv pads — hold notes over the jam, Keep as vox"
              >
                Pads
              </button>
            </div>
          </div>
        </div>

        {(j.lastPeek || j.undoLen > 0) && (
          <div className="text-[11px] text-accent px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            {j.lastPeek}
            {j.undoLen > 0 && (
              <button type="button" className="ml-3 underline" onClick={j.onUndo}>
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-3 py-2 flex flex-col gap-1.5 safe-pb">
        {(j.showKitLoadingBanner || (j.sampleLoading.totalBanks > 0 && !j.sampleLoading.done)) && (
          <div className="flex items-center justify-between gap-2 px-1">
            <SampleLoadingIndicator compact />
            {j.showKitLoadingBanner && (
              <span className="text-[10px] text-accent whitespace-nowrap font-medium">
                Loading kit samples…
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <PlayButton large={!!j.isMobile} />
          <JamMicRec large={!!j.isMobile} />
          <button
            type="button"
            onClick={j.onNewKit}
            className="min-h-11 px-3 rounded-xl text-xs font-medium bg-bg-elevated border border-border"
          >
            New kit
          </button>
          <button
            type="button"
            onClick={() => j.setShowMutateSheet(true)}
            className="min-h-11 px-3 rounded-xl text-xs font-medium bg-bg-elevated border border-border"
            title="Deterministic pattern transforms — not Shuffle, not Spice"
          >
            Mutate
          </button>
          <button
            type="button"
            onClick={j.onShuffle}
            className="min-h-11 flex-1 rounded-xl text-xs font-medium bg-accent/20 text-accent border border-accent/30"
          >
            Shuffle
          </button>
          <button
            type="button"
            onClick={j.onSpice}
            className="min-h-11 px-3 rounded-xl text-xs font-medium bg-accent/20 text-accent border border-accent/30"
            title="FX/timbre nudge — same tune, spiced up"
          >
            Spice
          </button>
        </div>
      </div>

      {j.showKitPicker && (
        <JamKitPicker
          kits={j.kits}
          kitId={j.kitId}
          filterTags={j.kitFilterTags}
          filterSearch={j.kitFilterSearch}
          onFilterTagsChange={j.setKitFilterTags}
          onFilterSearchChange={j.setKitFilterSearch}
          onPick={(id) => j.applyKit(id, true)}
          onSkip={() => {
            useJamStore.getState().setShowKitPicker(false)
            useJamStore.getState().setHasPickedKit(true)
          }}
        />
      )}

      {j.soundTrack && <JamTrackSheet track={j.soundTrack} />}
      {codeTrack && <JamCodeSheet track={codeTrack} />}
      {j.showMutateSheet && (
        <JamMutateSheet onClose={() => j.setShowMutateSheet(false)} />
      )}
      {j.showImprovPlate && (
        <JamImprovPlate
          onClose={() => {
            useJamStore.getState().setImprovHold(null)
            if (useSessionStore.getState().isPlaying) {
              liveUpdateEngine.queueUpdate('immediate', 'jam')
            }
            j.setShowImprovPlate(false)
          }}
        />
      )}
    </div>
  )
}
