import { useState, useEffect, useRef, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'

interface AxisMapping {
  axisIndex: number
  param: string
  min: number
  max: number
}

export function GamepadInput() {
  const [gamepad, setGamepad] = useState<Gamepad | null>(null)
  const [axisMappings, setAxisMappings] = useState<AxisMapping[]>([])
  const [axisValues, setAxisValues] = useState<number[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => setGamepad(e.gamepad)
    const onDisconnect = () => setGamepad(null)

    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)

    return () => {
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  // Poll gamepad state
  useEffect(() => {
    if (!gamepad) return

    const poll = () => {
      const pads = navigator.getGamepads()
      const gp = pads[gamepad.index]
      if (!gp) return

      const axes = Array.from(gp.axes)
      setAxisValues(axes)

      // Apply mappings
      axisMappings.forEach((mapping) => {
        if (mapping.axisIndex >= axes.length) return
        const raw = (axes[mapping.axisIndex] + 1) / 2 // normalize -1..1 to 0..1
        const value = mapping.min + raw * (mapping.max - mapping.min)

        const state = useSessionStore.getState()
        const activeTrack = state.tracks.find((t) => t.id === state.activeTrackId)
        if (activeTrack) {
          const regex = new RegExp(`\\.${mapping.param}\\([^)]*\\)`)
          const replacement = `.${mapping.param}(${value.toFixed(2)})`
          const newCode = regex.test(activeTrack.code)
            ? activeTrack.code.replace(regex, replacement)
            : activeTrack.code.trimEnd() + replacement
          state.setCode(activeTrack.id, newCode)
        }
      })

      animRef.current = requestAnimationFrame(poll)
    }

    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [gamepad, axisMappings])

  const addMapping = useCallback((axisIndex: number, param: string) => {
    setAxisMappings((prev) => [
      ...prev.filter((m) => m.axisIndex !== axisIndex),
      { axisIndex, param, min: 0, max: 1 },
    ])
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Gamepad</h3>
      </div>

      {!gamepad ? (
        <div className="px-3 py-4 text-xs text-text-muted text-center">
          Connect a gamepad and press any button to detect it
        </div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] text-success">{gamepad.id}</span>
          </div>

          {/* Axes display */}
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] text-text-muted">Axes</span>
            {axisValues.map((val, i) => (
              <div key={i} className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-text-muted w-8">Axis {i}</span>
                <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${((val + 1) / 2) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-text-muted w-8">{val.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Quick map */}
          <div className="px-3 py-2">
            <span className="text-[10px] text-text-muted">Quick Map</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {['lpf', 'gain', 'room', 'pan'].map((param) => (
                <button
                  key={param}
                  onClick={() => addMapping(0, param)}
                  className="px-1.5 py-0.5 text-[9px] bg-bg-elevated text-text-muted hover:text-accent rounded"
                >
                  Axis 0 → {param}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
