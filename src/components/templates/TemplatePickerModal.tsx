import { useCallback } from 'react'
import { templates } from './template-data'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'

/**
 * First-run / template picker.
 * Loads a template on tap but does NOT auto-play — iOS requires Play to be
 * a dedicated user gesture that unlocks the Strudel AudioContext.
 */
export function TemplatePickerModal() {
  const showModal = useUIStore((s) => s.showTemplateModal)
  const setShowModal = useUIStore((s) => s.setShowTemplateModal)
  const loadTemplate = useSessionStore((s) => s.loadTemplate)

  const handlePick = useCallback(
    (templateId: string) => {
      const template = templates.find((t) => t.id === templateId)
      if (!template) return
      loadTemplate(template)
      setShowModal(false)
    },
    [loadTemplate, setShowModal],
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 max-w-3xl w-full mx-0 sm:mx-4 shadow-2xl max-h-[92dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <h1 className="text-2xl font-semibold text-text mb-1 tracking-tight">Strudel Studio</h1>
        <p className="text-text-muted mb-2 text-sm sm:text-base">
          Pick a template, then tap <span className="text-accent font-medium">Play</span> to hear it.
        </p>
        <p className="text-[11px] text-text-muted/80 mb-5">
          On iPhone: Play must be a direct tap so Safari unlocks audio.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handlePick(t.id)}
              className="text-left p-4 rounded-xl border border-border hover:border-accent/60 bg-bg-elevated hover:bg-bg-elevated/90 transition-all active:scale-[0.98] group shadow-sm"
            >
              <div className="flex gap-1.5 mb-3">
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
          type="button"
          onClick={handleBlank}
          className="w-full text-center py-3 text-text-muted hover:text-text text-sm transition-colors rounded-lg hover:bg-bg-elevated active:scale-[0.99]"
        >
          or start with a blank session
        </button>
      </div>
    </div>
  )
}
