import { useEffect } from 'react'

interface CheatsheetProps {
  onClose: () => void
}

export function Cheatsheet({ onClose }: CheatsheetProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-bg-surface border border-border rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Strudel Cheatsheet</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">ESC</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
          {/* Mini-Notation */}
          <div>
            <h3 className="text-accent font-sans font-medium text-sm mb-2">Mini-Notation</h3>
            <table className="w-full">
              <tbody>
                {[
                  ['"a b c d"', 'Sequence (fit in 1 cycle)'],
                  ['"a*3"', 'Repeat 3x'],
                  ['"[a b]/2"', 'Play over 2 cycles'],
                  ['"<a b c>"', 'One per cycle'],
                  ['"[a b] c"', 'Subdivide time'],
                  ['"~"', 'Rest / silence'],
                  ['"a,b"', 'Play simultaneously'],
                  ['"a@2 b"', 'a takes 2x time'],
                  ['"a!3"', 'Repeat (no subdivide)'],
                  ['"a?"', 'Random include/exclude'],
                  ['"a(3,8)"', 'Euclidean rhythm'],
                ].map(([code, desc]) => (
                  <tr key={code} className="border-b border-border/30">
                    <td className="py-0.5 pr-2 text-[#22d3ee]">{code}</td>
                    <td className="py-0.5 text-text-muted font-sans">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sounds & Effects */}
          <div>
            <h3 className="text-accent font-sans font-medium text-sm mb-2">Sounds & Effects</h3>
            <div className="space-y-2">
              <div>
                <span className="text-text-muted font-sans">Sounds</span>
                <div className="text-[#22c55e]">
                  {['s("bd sd")', 'note("c3 e3")', 'sound("saw")', '.bank("TR808")'].map((s) => (
                    <div key={s}>{s}</div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-text-muted font-sans">Effects</span>
                <div className="text-[#fb923c]">
                  {['.lpf(800)', '.hpf(200)', '.room(0.5)', '.delay(0.3)', '.gain(0.8)', '.shape(0.5)', '.pan(sine)', '.crush(4)'].map((s) => (
                    <div key={s}>{s}</div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-text-muted font-sans">Signals</span>
                <div className="text-[#a78bfa]">sine saw square tri perlin rand</div>
              </div>
            </div>
          </div>

          {/* Patterns & Keys */}
          <div>
            <h3 className="text-accent font-sans font-medium text-sm mb-2">Pattern Modifiers</h3>
            <div className="text-[#ff44cc] space-y-0.5 mb-4">
              {['.fast(2)', '.slow(2)', '.rev()', '.jux(rev)', '.every(4, fast(2))', '.sometimes(rev)', '.struct("x ~ x ~")', '.chop(16)', '.off(0.125, fn)'].map((s) => (
                <div key={s}>{s}</div>
              ))}
            </div>

            <h3 className="text-accent font-sans font-medium text-sm mb-2">Keyboard</h3>
            <table className="w-full">
              <tbody>
                {[
                  ['Ctrl+Enter', 'Eval track'],
                  ['Ctrl+Shift+Enter', 'Eval ALL'],
                  ['Ctrl+.', 'Stop'],
                  ['Ctrl+Shift+M', 'Mute'],
                  ['Ctrl+Shift+S', 'Solo'],
                  ['Ctrl+Z', 'Undo'],
                  ['?', 'This cheatsheet'],
                ].map(([key, desc]) => (
                  <tr key={key} className="border-b border-border/30">
                    <td className="py-0.5 pr-2 text-text">{key}</td>
                    <td className="py-0.5 text-text-muted font-sans">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
