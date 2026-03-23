import { keymap, EditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { strudelDarkTheme, strudelHighlightStyle } from '../../styles/editor-theme'
import { strudelAutocomplete } from './strudel-autocomplete'
import { strudelLinter } from './strudel-linter'
import { inlineSliderPlugin } from './inline-slider'

export function createExtensions(options: {
  onEvaluate: () => void
  onStop: () => void
  onChange: (code: string) => void
}) {
  return [
    javascript(),
    strudelDarkTheme,
    strudelHighlightStyle,
    strudelAutocomplete,
    strudelLinter,
    inlineSliderPlugin,
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
