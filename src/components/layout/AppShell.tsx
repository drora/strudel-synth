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
// Visualizers: Users can add scope() or spectrum() to their own code for background visuals
import { useSessionStore } from '../../store/session-store'
import { evaluateCode, stop, composeTracks, initEngine } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'
import { reshuffleTrack } from '../../engine/reshuffle'
import { liveUpdateEngine } from '../../engine/live-update'

export function AppShell() {
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [showPiano, setShowPiano] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)

  const toggleCheatsheet = useCallback(() => setShowCheatsheet((v) => !v), [])

  // Auto re-evaluate when mute/solo/volume changes during playback
  useEffect(() => {
    let prevFingerprint = ''

    const unsub = useSessionStore.subscribe((state) => {
      if (!state.isPlaying) return

      // Build a fingerprint of mute/solo/volume state
      const fingerprint = state.tracks
        .map((t) => `${t.id}:${t.muted}:${t.soloed}:${t.volume}`)
        .join('|')

      if (fingerprint !== prevFingerprint && prevFingerprint !== '') {
        // State changed — queue re-evaluation
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

      // Cmd+/ — toggle cheatsheet
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShowCheatsheet((v) => !v)
        return
      }

      // Ctrl+Shift+Enter — evaluate all tracks
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

      // Ctrl+. — stop
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        await stop()
        state.setPlaying(false)
        return
      }

      // Ctrl+Shift+M — mute active track
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        if (state.activeTrackId) state.toggleMute(state.activeTrackId)
        return
      }

      // Ctrl+Shift+S — solo active track
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        if (state.activeTrackId) state.toggleSolo(state.activeTrackId)
        return
      }

      // Ctrl+L — toggle lock on active track
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'l') {
        e.preventDefault()
        if (state.activeTrackId) state.toggleLock(state.activeTrackId)
        return
      }

      // Ctrl+Shift+L — lock all tracks
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        state.lockAll()
        return
      }

      // Ctrl+Shift+R — reshuffle active track
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
      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar: Track List */}
        <TrackList />

        {/* Center column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Code editor panes */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodePane />
          </div>

          {/* Suggestion banner */}
          <SuggestionBanner />

          {/* Piano keyboard (toggle) */}
          {showPiano && <PianoKeyboard />}

          {/* Voice recorder (toggle) */}
          {showRecorder && <VoiceRecorder />}
        </div>

        {/* Right panel: Effects / Docs */}
        {showRightPanel && <RightPanel />}
      </div>

      {/* Master Visualizer Strip */}
      {/* Transport Bar */}
      <TransportBar
        onToggleDocs={() => setShowRightPanel((v) => !v)}
        onToggleCheatsheet={toggleCheatsheet}
        onTogglePiano={() => setShowPiano((v) => !v)}
        onToggleRecorder={() => setShowRecorder((v) => !v)}
      />

      {/* Template Picker Modal */}
      <TemplatePickerModal />

      {/* Cheatsheet Overlay */}
      {showCheatsheet && <Cheatsheet onClose={toggleCheatsheet} />}
    </div>
  )
}
