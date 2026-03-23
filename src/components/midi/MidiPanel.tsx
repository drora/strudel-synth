import { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'

interface MidiDevice {
  id: string
  name: string
  type: 'input' | 'output'
}

interface CcMapping {
  cc: number
  param: string
  trackId: string
  min: number
  max: number
}

export function MidiPanel() {
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [ccMappings, setCcMappings] = useState<CcMapping[]>([])
  const [learnMode, setLearnMode] = useState(false)
  const [learnTarget, setLearnTarget] = useState<string | null>(null)
  const [lastCc, setLastCc] = useState<{ cc: number; value: number } | null>(null)

  // Request MIDI access
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return

    navigator.requestMIDIAccess().then((access) => {
      setMidiAccess(access)
      updateDevices(access)
      access.onstatechange = () => updateDevices(access)
    }).catch((err) => {
      console.warn('MIDI not available:', err)
    })
  }, [])

  const updateDevices = useCallback((access: MIDIAccess) => {
    const devs: MidiDevice[] = []
    access.inputs.forEach((input) => {
      devs.push({ id: input.id, name: input.name || 'Unknown', type: 'input' })
    })
    access.outputs.forEach((output) => {
      devs.push({ id: output.id, name: output.name || 'Unknown', type: 'output' })
    })
    setDevices(devs)
  }, [])

  // Listen for MIDI CC messages
  useEffect(() => {
    if (!midiAccess) return

    const handleMidi = (e: MIDIMessageEvent) => {
      const [status, cc, value] = e.data || []
      // CC message: status 0xB0-0xBF
      if ((status & 0xf0) === 0xb0) {
        setLastCc({ cc, value })

        if (learnMode && learnTarget) {
          // Map this CC to the learn target
          const activeTrackId = useSessionStore.getState().activeTrackId
          if (activeTrackId) {
            setCcMappings((prev) => [
              ...prev.filter((m) => m.param !== learnTarget),
              { cc, param: learnTarget, trackId: activeTrackId, min: 0, max: 1 },
            ])
            setLearnMode(false)
            setLearnTarget(null)
          }
        }

        // Apply mapped CC values
        ccMappings
          .filter((m) => m.cc === cc)
          .forEach((mapping) => {
            const normalized = value / 127
            const mappedValue = mapping.min + normalized * (mapping.max - mapping.min)
            const state = useSessionStore.getState()
            const track = state.tracks.find((t) => t.id === mapping.trackId)
            if (track) {
              const regex = new RegExp(`\\.${mapping.param}\\([^)]*\\)`)
              const replacement = `.${mapping.param}(${mappedValue.toFixed(2)})`
              const newCode = regex.test(track.code)
                ? track.code.replace(regex, replacement)
                : track.code.trimEnd() + replacement
              state.setCode(mapping.trackId, newCode)
            }
          })
      }
    }

    midiAccess.inputs.forEach((input) => {
      input.onmidimessage = handleMidi
    })

    return () => {
      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = null
      })
    }
  }, [midiAccess, learnMode, learnTarget, ccMappings])

  if (!navigator.requestMIDIAccess) {
    return (
      <div className="px-3 py-4 text-xs text-text-muted text-center">
        WebMIDI not available in this browser
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">MIDI</h3>
      </div>

      {/* Devices */}
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] text-text-muted">Devices</span>
        {devices.length === 0 ? (
          <p className="text-[10px] text-text-muted mt-1">No MIDI devices detected</p>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${d.type === 'input' ? 'bg-success' : 'bg-accent'}`} />
              <span className="text-[10px] text-text truncate">{d.name}</span>
              <span className="text-[9px] text-text-muted">{d.type}</span>
            </div>
          ))
        )}
      </div>

      {/* CC Learn */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">CC Learn</span>
          <button
            onClick={() => setLearnMode(!learnMode)}
            className={`px-2 py-0.5 text-[9px] rounded transition-colors ${
              learnMode ? 'bg-error/20 text-error animate-pulse' : 'bg-bg-elevated text-text-muted hover:text-text'
            }`}
          >
            {learnMode ? 'Learning...' : 'Learn'}
          </button>
        </div>
        {learnMode && (
          <div className="mt-1 flex flex-wrap gap-1">
            {['lpf', 'hpf', 'gain', 'room', 'delay', 'shape', 'pan'].map((param) => (
              <button
                key={param}
                onClick={() => setLearnTarget(param)}
                className={`px-1.5 py-0.5 text-[9px] rounded ${
                  learnTarget === param ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-muted'
                }`}
              >
                {param}
              </button>
            ))}
          </div>
        )}
        {lastCc && (
          <p className="text-[9px] text-text-muted mt-1">Last CC: {lastCc.cc} = {lastCc.value}</p>
        )}
      </div>

      {/* Active mappings */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <span className="text-[10px] text-text-muted">Mappings</span>
        {ccMappings.length === 0 ? (
          <p className="text-[10px] text-text-muted mt-1">No mappings. Use Learn mode to map MIDI CC to effects.</p>
        ) : (
          ccMappings.map((m, i) => (
            <div key={i} className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-accent font-mono">CC{m.cc}</span>
              <span className="text-[10px] text-text">→ .{m.param}()</span>
              <button
                onClick={() => setCcMappings((prev) => prev.filter((_, j) => j !== i))}
                className="text-[9px] text-text-muted hover:text-error ml-auto"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
