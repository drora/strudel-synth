import { useState, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { EffectKnob } from './EffectKnob'

interface EffectParam {
  name: string
  key: string
  min: number
  max: number
  step: number
  default: number
  log?: boolean
}

interface EffectSection {
  title: string
  params: EffectParam[]
}

const EFFECT_SECTIONS: EffectSection[] = [
  {
    title: 'Filter',
    params: [
      { name: 'LPF', key: 'lpf', min: 20, max: 20000, step: 1, default: 20000, log: true },
      { name: 'HPF', key: 'hpf', min: 20, max: 20000, step: 1, default: 20, log: true },
      { name: 'Resonance', key: 'lpq', min: 0, max: 20, step: 0.1, default: 1 },
    ],
  },
  {
    title: 'Amplitude',
    params: [
      { name: 'Gain', key: 'gain', min: 0, max: 1.5, step: 0.01, default: 1 },
      { name: 'Attack', key: 'attack', min: 0, max: 2, step: 0.01, default: 0.01 },
      { name: 'Decay', key: 'decay', min: 0, max: 2, step: 0.01, default: 0.1 },
      { name: 'Sustain', key: 'sustain', min: 0, max: 1, step: 0.01, default: 0.8 },
      { name: 'Release', key: 'release', min: 0, max: 4, step: 0.01, default: 0.1 },
    ],
  },
  {
    title: 'Space',
    params: [
      { name: 'Room', key: 'room', min: 0, max: 2, step: 0.01, default: 0 },
      { name: 'Room Size', key: 'roomsize', min: 0, max: 10, step: 0.1, default: 1 },
      { name: 'Delay', key: 'delay', min: 0, max: 1, step: 0.01, default: 0 },
      { name: 'Delay Time', key: 'delaytime', min: 0, max: 1, step: 0.001, default: 0.125 },
      { name: 'Feedback', key: 'delayfeedback', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    title: 'Distortion',
    params: [
      { name: 'Shape', key: 'shape', min: 0, max: 1, step: 0.01, default: 0 },
      { name: 'Distort', key: 'distort', min: 0, max: 10, step: 0.1, default: 0 },
      { name: 'Crush', key: 'crush', min: 1, max: 16, step: 1, default: 16 },
      { name: 'Coarse', key: 'coarse', min: 1, max: 32, step: 1, default: 1 },
    ],
  },
  {
    title: 'Modulation',
    params: [
      { name: 'Phaser', key: 'phaser', min: 0, max: 10, step: 0.1, default: 0 },
      { name: 'Pan', key: 'pan', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    title: 'FM Synth',
    params: [
      { name: 'FM Index', key: 'fm', min: 0, max: 20, step: 0.1, default: 0 },
      { name: 'Harmonicity', key: 'fmh', min: 0.01, max: 16, step: 0.01, default: 1 },
    ],
  },
]

function parseEffectValue(code: string, key: string): number | null {
  const regex = new RegExp(`\\.${key}\\((\\d+\\.?\\d*)\\)`)
  const match = code.match(regex)
  return match ? parseFloat(match[1]) : null
}

function setEffectInCode(code: string, key: string, value: number): string {
  const regex = new RegExp(`\\.${key}\\([^)]*\\)`)
  const replacement = `.${key}(${value})`
  if (regex.test(code)) {
    return code.replace(regex, replacement)
  }
  // Append effect at end of code (before any trailing whitespace)
  return code.trimEnd() + replacement
}

export function EffectsPanel() {
  const activeTrackId = useSessionStore((s) => s.activeTrackId)
  const tracks = useSessionStore((s) => s.tracks)
  const setCode = useSessionStore((s) => s.setCode)
  const activeTrack = tracks.find((t) => t.id === activeTrackId)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleSection = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  const handleParamChange = useCallback(
    (key: string, value: number) => {
      if (!activeTrack) return
      const newCode = setEffectInCode(activeTrack.code, key, value)
      setCode(activeTrack.id, newCode)
    },
    [activeTrack, setCode]
  )

  if (!activeTrack) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-text-muted">Select a track</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Effects</h2>
        <div className="text-xs text-text mt-0.5" style={{ color: activeTrack.color }}>
          {activeTrack.name}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {EFFECT_SECTIONS.map((section) => (
          <div key={section.title} className="border-b border-border/50">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full px-3 py-2 text-left text-[10px] font-medium text-text-muted uppercase tracking-wider hover:text-text flex items-center"
            >
              <span className={`mr-1 transition-transform ${collapsed.has(section.title) ? '' : 'rotate-90'}`}>
                ▶
              </span>
              {section.title}
            </button>
            {!collapsed.has(section.title) && (
              <div className="px-3 pb-2 grid grid-cols-2 gap-x-2 gap-y-1">
                {section.params.map((param) => {
                  const currentValue = parseEffectValue(activeTrack.code, param.key)
                  return (
                    <EffectKnob
                      key={param.key}
                      label={param.name}
                      value={currentValue ?? param.default}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      onChange={(v) => handleParamChange(param.key, v)}
                      isActive={currentValue !== null}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
