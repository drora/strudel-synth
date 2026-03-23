import { useState, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11] // c, d, e, f, g, a, b
const BLACK_NOTES = [1, 3, 6, 8, 10] // c#, d#, f#, g#, a#
const BLACK_POSITIONS = [1, 2, 4, 5, 6] // position relative to white keys

interface PianoKeyboardProps {
  onInsertNote?: (note: string) => void
}

export function PianoKeyboard({ onInsertNote }: PianoKeyboardProps) {
  const [baseOctave, setBaseOctave] = useState(3)
  const activeTrackId = useSessionStore((s) => s.activeTrackId)
  const setCode = useSessionStore((s) => s.setCode)
  const tracks = useSessionStore((s) => s.tracks)
  const activeTrack = tracks.find((t) => t.id === activeTrackId)

  const handleKeyClick = useCallback(
    (noteName: string) => {
      if (onInsertNote) {
        onInsertNote(noteName)
        return
      }
      // Append note to active track's code
      if (activeTrack) {
        const code = activeTrack.code
        // Simple: append note to the pattern string
        setCode(activeTrack.id, code + ` ${noteName}`)
      }
    },
    [activeTrack, setCode, onInsertNote]
  )

  const octaves = [baseOctave, baseOctave + 1]

  return (
    <div className="bg-bg-surface border-t border-border px-3 py-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Piano</span>
        <button
          onClick={() => setBaseOctave((o) => Math.max(1, o - 1))}
          className="px-1.5 py-0.5 text-[10px] bg-bg-elevated rounded text-text-muted hover:text-text"
        >
          -
        </button>
        <span className="text-[10px] text-text font-mono">C{baseOctave}-C{baseOctave + 2}</span>
        <button
          onClick={() => setBaseOctave((o) => Math.min(6, o + 1))}
          className="px-1.5 py-0.5 text-[10px] bg-bg-elevated rounded text-text-muted hover:text-text"
        >
          +
        </button>
      </div>

      <div className="relative h-20">
        {/* White keys */}
        <div className="flex h-full gap-px">
          {octaves.flatMap((octave) =>
            WHITE_NOTES.map((noteIdx) => {
              const name = `${NOTE_NAMES[noteIdx]}${octave}`
              return (
                <button
                  key={name}
                  onClick={() => handleKeyClick(name)}
                  className="flex-1 bg-[#e8e8e8] hover:bg-[#d0d0d0] active:bg-[#c0c0c0] rounded-b border border-[#ccc] flex items-end justify-center pb-1 transition-colors"
                  title={name}
                >
                  <span className="text-[8px] text-[#666]">{name}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Black keys */}
        <div className="absolute top-0 left-0 w-full h-[55%] flex pointer-events-none">
          {octaves.flatMap((octave, octIdx) => {
            const whiteKeyWidth = 100 / (WHITE_NOTES.length * 2) // percentage per white key
            return BLACK_POSITIONS.map((pos, i) => {
              const noteIdx = BLACK_NOTES[i]
              const name = `${NOTE_NAMES[noteIdx]}${octave}`
              const leftPercent = (octIdx * 7 + pos) * whiteKeyWidth - whiteKeyWidth * 0.35
              return (
                <button
                  key={name}
                  onClick={() => handleKeyClick(name)}
                  className="absolute h-full pointer-events-auto bg-[#222] hover:bg-[#333] active:bg-[#444] rounded-b border border-[#111] transition-colors"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${whiteKeyWidth * 0.7}%`,
                  }}
                  title={name}
                >
                  <span className="text-[7px] text-[#999] block mt-auto mb-1 text-center">{name}</span>
                </button>
              )
            })
          })}
        </div>
      </div>
    </div>
  )
}
