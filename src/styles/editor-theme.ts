import { EditorView } from '@codemirror/view'

export const strudelDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0a0a0f',
      color: '#e0e0e8',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: '14px',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#a78bfa',
      padding: '12px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#a78bfa',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#a78bfa30',
    },
    '.cm-activeLine': {
      backgroundColor: '#ffffff08',
    },
    '.cm-gutters': {
      backgroundColor: '#0a0a0f',
      color: '#555566',
      border: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#ffffff08',
      color: '#888899',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#1a1a25',
      color: '#888899',
      border: 'none',
    },
    '.cm-tooltip': {
      backgroundColor: '#1a1a25',
      border: '1px solid #2a2a3a',
      color: '#e0e0e8',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: '#a78bfa30',
      },
    },
    // Phase 1 + 3 — 16px editor font on touch; slightly roomier line height for thumbs.
    '@media (pointer: coarse)': {
      '&': {
        fontSize: '16px',
      },
      '.cm-content': {
        padding: '14px 0',
        lineHeight: '1.55',
      },
      '.cm-gutters': {
        minWidth: '2.5rem',
      },
    },
  },
  { dark: true },
)

export const strudelHighlightStyle = EditorView.baseTheme({
  // Strudel-specific token colors (classHighlighter → .tok-*)
  '.tok-keyword': { color: '#c084fc' },
  '.tok-string': { color: '#22d3ee' },
  '.tok-string2': { color: '#22d3ee' },
  '.tok-number': { color: '#fb923c' },
  '.tok-comment': { color: '#555566', fontStyle: 'italic' },
  '.tok-variableName': { color: '#e0e0e8' },
  '.tok-propertyName': { color: '#a78bfa' },
  '.tok-operator': { color: '#888899' },
  '.tok-punctuation': { color: '#555566' },
  '.tok-function': { color: '#22c55e' },
  '.tok-typeName': { color: '#ff44cc' },
  '.tok-bool': { color: '#fb923c' },
})

/** Mini-notation mark decorations inside strings (see mini-highlight.ts). */
export const miniNotationTheme = EditorView.baseTheme({
  '.cm-mini-rest': { color: '#64748b', fontStyle: 'italic' },
  '.cm-mini-op': { color: '#f472b6', fontWeight: '600' },
  '.cm-mini-bracket': { color: '#fbbf24' },
  '.cm-mini-number': { color: '#fb923c' },
  '.cm-mini-note': { color: '#4ade80' },
  '.cm-mini-punct': { color: '#94a3b8' },
})

/**
 * Phase 3 layout lives in AppShell / CodePane / TransportBar / LearnShell.
 * Keep CM theme tweaks here only (font / gutter / line-height).
 */
