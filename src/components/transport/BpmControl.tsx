import { useCallback, useRef, useState } from 'react'
import { useSessionStore } from '../../store/session-store'

/**
 * Set BPM by calling globalThis.setcps directly.
 * This does NOT re-evaluate the pattern — it just changes tempo in-place.
 */
function setLiveBpm(bpm: number) {
  const cps = bpm / 60 / 4
  if (typeof globalThis.setcps === 'function') {
    globalThis.setcps(cps)
  }
}

export function BpmControl() {
  const bpm = useSessionStore((s) => s.bpm)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const setBpm = useSessionStore((s) => s.setBpm)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const dragStartY = useRef<number | null>(null)
  const dragStartBpm = useRef<number>(0)
  const isDragging = useRef(false)

  const updateBpm = useCallback(
    (newBpm: number) => {
      const clamped = Math.max(40, Math.min(300, Math.round(newBpm)))
      setBpm(clamped)
      if (isPlaying) setLiveBpm(clamped)
    },
    [setBpm, isPlaying]
  )

  // Drag to adjust — only on the label, not the input
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      dragStartY.current = e.clientY
      dragStartBpm.current = bpm
      isDragging.current = false
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [bpm]
  )

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return
      isDragging.current = true
      const delta = dragStartY.current - e.clientY
      updateBpm(dragStartBpm.current + delta * 0.5)
    },
    [updateBpm]
  )

  const handleDragEnd = useCallback(() => {
    dragStartY.current = null
    isDragging.current = false
  }, [])

  // Click to edit number directly
  const startEdit = useCallback(() => {
    setEditValue(String(bpm))
    setIsEditing(true)
  }, [bpm])

  const commitEdit = useCallback(() => {
    const val = parseInt(editValue, 10)
    if (!isNaN(val)) updateBpm(val)
    setIsEditing(false)
  }, [editValue, updateBpm])

  return (
    <div className="flex items-center gap-1">
      {/* Draggable label */}
      <label
        className="text-text-muted text-xs uppercase tracking-wide cursor-ns-resize select-none px-1"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        title="Drag to adjust BPM"
      >
        BPM
      </label>

      {/* Editable number */}
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          className="w-14 bg-bg-elevated border border-accent rounded px-2 py-1 text-center text-text font-mono text-sm focus:outline-none"
        />
      ) : (
        <button
          onClick={startEdit}
          className="w-14 bg-bg-elevated border border-border rounded px-2 py-1 text-center text-text font-mono text-sm hover:border-accent transition-colors"
          title="Click to type BPM"
        >
          {bpm}
        </button>
      )}
    </div>
  )
}
