import { useEffect, useState, useCallback } from 'react'
import { CodePane } from '../editor/CodePane'
import { TransportBar } from '../transport/TransportBar'
import { TemplatePickerModal } from '../templates/TemplatePickerModal'
import { TrackList } from '../sidebar/TrackList'
import { RightPanel } from './RightPanel'
import { Cheatsheet } from '../cheatsheet/Cheatsheet'
import { SuggestionBanner } from '../editor/SuggestionBanner'
import { PianoKeyboard } from '../piano/PianoKeyboard'
import { VoiceRecorder } from '../recorder/VoiceRecorder'
import { LearnShell } from '../learning/LearnShell'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useIsMobile } from '../../hooks/useIsMobile'
import { evaluateCode, stop, composeTracks, initEngine } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'
import { reshuffleTrack } from '../../engine/reshuffle'
import { liveUpdateEngine } from '../../engine/live-update'

export function AppShell() {
  const appMode = useUIStore((s) => s.appMode)

  if (appMode === 'learn') {
    return <LearnShell />
  }

  return <StudioShell />
}

/** Slide-in drawer overlay for mobile panels */
function MobileDrawer({
  open,
  onClose,
  side,
  children,
}: {
  open: boolean
  onClose: () => void
  side: 'left' | 'right'
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Panel */}
      <div
        className={`relative z-50 h-full overflow-y-auto bg-bg-surface shadow-2xl ${
          side === 'left' ? 'mr-auto' : 'ml-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function StudioShell() {
  const isMobile = useIsMobile()
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(!isMobile)
  const [showPiano, setShowPiano] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showMobileRightPanel, setShowMobileRightPanel] = useState(false)

  const toggleCheatsheet = useCallback(() => setShowCheatsheet((v) => !v), [])

  // Close drawers when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setShowMobileSidebar(false)
      setShowMobileRightPanel(false)
    }
  }, [isMobile])

  // Auto re-evaluate when mute/solo/volume changes during playback
  useEffect(() => {
    let prevFingerprint = ''

    const unsub = useSessionStore.subscribe((state) => {
      if (!state.isPlaying) return

      const fingerprint = state.tracks
        .map((t) => `${t.id}:${t.muted}:${t.soloed}:${t.volume}`)
        .join('|')

      if (fingerprint !== prevFingerprint && prevFingerprint !== '') {
        liveUpdateEngine.queueUpdate('immediate')
      }
      prevFingerprint = fingerprint
    })

    return unsub
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const state = useSessionStore.getState()

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShowCheatsheet((v) => !v)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        try {
          await resumeAudioContext()
          await initEngine()
          const code = composeTracks(state.tracks, state.bpm)
          await evaluateCode(code)
          state.setPlaying(true)
        } catch (err) {
          console.error('Eval all error:', err)
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        await stop()
        state.setPlaying(false)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        if (state.activeTrackId) state.toggleMute(state.activeTrackId)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        if (state.activeTrackId) state.toggleSolo(state.activeTrackId)
        return
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'l') {
        e.preventDefault()
        if (state.activeTrackId) state.toggleLock(state.activeTrackId)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        state.lockAll()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        const activeTrack = state.tracks.find((t) => t.id === state.activeTrackId)
        if (activeTrack) {
          const newCode = reshuffleTrack(activeTrack.role, activeTrack.code)
          state.setCode(activeTrack.id, newCode)
          if (state.isPlaying) liveUpdateEngine.queueUpdate('1')
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Mobile top bar with hamburger */}
      {isMobile && (
        <div className="flex items-center h-10 px-3 bg-bg-surface border-b border-border shrink-0">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text rounded transition-colors"
            aria-label="Open track list"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="5" x2="15" y2="5" />
              <line x1="3" y1="9" x2="15" y2="9" />
              <line x1="3" y1="13" x2="15" y2="13" />
            </svg>
          </button>
          <span className="ml-2 text-xs font-medium text-text-muted">Tracks</span>
          <div className="flex-1" />
          <button
            onClick={() => setShowMobileRightPanel(true)}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text rounded transition-colors"
            aria-label="Open panels"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="12" height="12" rx="2" />
              <line x1="10" y1="3" x2="10" y2="15" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar: Track List — hidden on mobile (use drawer) */}
        {!isMobile && <TrackList />}

        {/* Center column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodePane />
          </div>
          <SuggestionBanner />
          {showPiano && <PianoKeyboard />}
          {showRecorder && <VoiceRecorder />}
        </div>

        {/* Right panel — hidden on mobile (use drawer) */}
        {!isMobile && showRightPanel && <RightPanel />}
      </div>

      {/* Transport Bar */}
      <TransportBar
        onToggleDocs={isMobile ? () => setShowMobileRightPanel((v) => !v) : () => setShowRightPanel((v) => !v)}
        onToggleCheatsheet={toggleCheatsheet}
        onTogglePiano={() => setShowPiano((v) => !v)}
        onToggleRecorder={() => setShowRecorder((v) => !v)}
        isMobile={isMobile}
      />

      {/* Mobile drawers */}
      {isMobile && (
        <>
          <MobileDrawer open={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} side="left">
            <div className="w-72">
              <TrackList onTrackSelect={() => setShowMobileSidebar(false)} />
            </div>
          </MobileDrawer>
          <MobileDrawer open={showMobileRightPanel} onClose={() => setShowMobileRightPanel(false)} side="right">
            <div className="w-72">
              <RightPanel />
            </div>
          </MobileDrawer>
        </>
      )}

      {/* Template Picker Modal */}
      <TemplatePickerModal />

      {/* Cheatsheet Overlay */}
      {showCheatsheet && <Cheatsheet onClose={toggleCheatsheet} />}
    </div>
  )
}
