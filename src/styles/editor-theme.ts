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
  },
  { dark: true }
)

export const strudelHighlightStyle = EditorView.baseTheme({
  // Strudel-specific token colors
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
