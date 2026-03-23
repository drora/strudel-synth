import {
  ViewPlugin,
  Decoration,
  WidgetType,
  type EditorView,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'

/**
 * Inline slider widget for CodeMirror 6.
 * Detects `slider(value, min, max)` in code and renders a draggable slider inline.
 * Dragging the slider updates the value in the code (debounced to avoid widget rebuild during drag).
 */

const SLIDER_REGEX = /slider\(\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+))?\s*\)/g

// Track active drags to avoid rebuilding widgets mid-interaction
let activeDrag = false

class SliderWidget extends WidgetType {
  constructor(
    readonly value: number,
    readonly min: number,
    readonly max: number,
    readonly fullFrom: number,
    readonly fullTo: number,
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-inline-slider'
    wrap.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      vertical-align: middle;
      margin: 0 4px;
      padding: 2px 6px;
      background: rgba(167, 139, 250, 0.08);
      border-radius: 4px;
      border: 1px solid rgba(167, 139, 250, 0.15);
    `

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(this.min)
    slider.max = String(this.max)
    slider.step = String(Math.max(0.001, (this.max - this.min) / 200))
    slider.value = String(this.value)
    slider.style.cssText = `
      width: 80px;
      height: 14px;
      cursor: pointer;
      accent-color: #a78bfa;
      vertical-align: middle;
      margin: 0;
    `

    const label = document.createElement('span')
    label.style.cssText = 'font-size:10px;color:#a78bfa;font-family:monospace;min-width:32px;text-align:right;'
    label.textContent = formatValue(this.value, this.max)

    let pendingValue: number | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const commitValue = () => {
      if (pendingValue === null) return
      const val = pendingValue
      pendingValue = null

      const newText = `slider(${formatValue(val, this.max)}, ${this.min}, ${this.max})`
      // Re-read current positions from the doc (they may have shifted)
      const doc = view.state.doc.toString()
      const currentMatch = doc.substring(this.fullFrom).match(/^slider\([^)]*\)/)
      if (currentMatch) {
        view.dispatch({
          changes: { from: this.fullFrom, to: this.fullFrom + currentMatch[0].length, insert: newText },
        })
      }
    }

    slider.addEventListener('input', (e) => {
      e.stopPropagation()
      const newVal = parseFloat(slider.value)
      label.textContent = formatValue(newVal, this.max)
      pendingValue = newVal

      // Debounce: only commit to code after drag pauses
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(commitValue, 150)
    })

    slider.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      activeDrag = true
    })

    slider.addEventListener('pointerup', () => {
      activeDrag = false
      // Commit immediately on release
      if (debounceTimer) clearTimeout(debounceTimer)
      commitValue()
    })

    slider.addEventListener('mousedown', (e) => e.stopPropagation())
    slider.addEventListener('click', (e) => e.stopPropagation())
    slider.addEventListener('focus', (e) => e.stopPropagation())
    wrap.addEventListener('mousedown', (e) => e.stopPropagation())

    wrap.appendChild(slider)
    wrap.appendChild(label)
    return wrap
  }

  eq(other: SliderWidget): boolean {
    // During active drag, always report equal to prevent rebuild
    if (activeDrag) return true
    return (
      this.value === other.value &&
      this.min === other.min &&
      this.max === other.max &&
      this.fullFrom === other.fullFrom
    )
  }

  ignoreEvent(): boolean {
    return true
  }
}

function formatValue(val: number, max: number): string {
  if (max <= 2) return val.toFixed(2)
  if (max <= 100) return val.toFixed(1)
  return Math.round(val).toString()
}

function buildDecorations(view: EditorView): DecorationSet {
  // Don't rebuild during active drag
  if (activeDrag) return Decoration.none

  const decorations: Array<{ pos: number; decoration: Decoration }> = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let match: RegExpExecArray | null

    SLIDER_REGEX.lastIndex = 0
    while ((match = SLIDER_REGEX.exec(text)) !== null) {
      const value = parseFloat(match[1])
      const min = match[2] !== undefined ? parseFloat(match[2]) : 0
      const max = match[3] !== undefined ? parseFloat(match[3]) : 1

      const matchFrom = from + match.index
      const matchTo = matchFrom + match[0].length

      const widget = new SliderWidget(value, min, max, matchFrom, matchTo)
      decorations.push({
        pos: matchTo,
        decoration: Decoration.widget({ widget, side: 1 }),
      })
    }
  }

  return Decoration.set(
    decorations.map((d) => d.decoration.range(d.pos)),
    true
  )
}

export const inlineSliderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (activeDrag) return // Don't rebuild during drag
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)
