import { useCallback } from 'react'
import { templates } from './template-data'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { evaluateCode, composeTracks, initEngine } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'

export function TemplatePickerModal() {
  const showModal = useUIStore((s) => s.showTemplateModal)
  const setShowModal = useUIStore((s) => s.setShowTemplateModal)
  const loadTemplate = useSessionStore((s) => s.loadTemplate)

  const handlePick = useCallback(
    async (templateId: string) => {
      const template = templates.find((t) => t.id === templateId)
      if (!template) return

      loadTemplate(template)
      setShowModal(false)

      // Auto-play for the 5-second rule
      try {
        await resumeAudioContext()
        await initEngine()
        const state = useSessionStore.getState()
        const code = composeTracks(state.tracks, state.bpm)
        await evaluateCode(code)
        useSessionStore.getState().setPlaying(true)
      } catch (err) {
        console.error('Auto-play failed:', err)
      }
    },
    [loadTemplate, setShowModal]
  )

  const handleBlank = useCallback(() => {
    loadTemplate({
      id: 'blank',
      name: 'Blank',
      description: '',
      bpm: 120,
      tracks: [
        {
          name: 'Track 1',
          role: 'custom',
          color: '#94a3b8',
          code: '// Start coding!\ns("bd sd hh cp")',
        },
      ],
    })
    setShowModal(false)
  }, [loadTemplate, setShowModal])

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-surface border border-border rounded-xl p-8 max-w-3xl w-full mx-4">
        <h1 className="text-2xl font-semibold text-text mb-2">Strudel Studio</h1>
        <p className="text-text-muted mb-6">Pick a template to start making music instantly.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handlePick(t.id)}
              className="text-left p-4 rounded-lg border border-border hover:border-accent bg-bg-elevated hover:bg-bg-elevated/80 transition-colors group"
            >
              <div className="flex gap-1 mb-3">
                {t.tracks.map((track, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: track.color }}
                  />
                ))}
              </div>
              <div className="font-medium text-text group-hover:text-accent transition-colors">
                {t.name}
              </div>
              <div className="text-xs text-text-muted mt-1">{t.bpm} BPM</div>
              <div className="text-xs text-text-muted mt-1 line-clamp-2">{t.description}</div>
            </button>
          ))}
        </div>

        <button
          onClick={handleBlank}
          className="w-full text-center py-2 text-text-muted hover:text-text text-sm transition-colors"
        >
          or start with a blank session
        </button>
      </div>
    </div>
  )
}
