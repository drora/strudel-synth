import { keymap, EditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { syntaxHighlighting } from '@codemirror/language'
import { classHighlighter } from '@lezer/highlight'
import { strudelDarkTheme, strudelHighlightStyle, miniNotationTheme } from '../../styles/editor-theme'
import { strudelAutocomplete, lookupCompletionInfo } from './strudel-autocomplete'
import { strudelLinter } from './strudel-linter'
import { inlineSliderPlugin } from './inline-slider'
import { miniHighlightPlugin } from './mini-highlight'
import { cursorDocsExtension } from './cursor-docs'

export function createExtensions(options: {
  onEvaluate: () => void
  onStop: () => void
  onChange: (code: string) => void
}) {
  return [
    javascript(),
    // Activate .tok-* classes used by strudelHighlightStyle (were previously inert).
    syntaxHighlighting(classHighlighter),
    strudelDarkTheme,
    strudelHighlightStyle,
    miniNotationTheme,
    strudelAutocomplete,
    strudelLinter,
    inlineSliderPlugin,
    miniHighlightPlugin,
    cursorDocsExtension(lookupCompletionInfo),
    keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: () => {
          options.onEvaluate()
          return true
        },
      },
      {
        key: 'Ctrl-.',
        mac: 'Cmd-.',
        run: () => {
          options.onStop()
          return true
        },
      },
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onChange(update.state.doc.toString())
      }
    }),
  ]
}
