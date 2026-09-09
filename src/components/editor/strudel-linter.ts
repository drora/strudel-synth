import { linter, type Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'

/**
 * Static linter for Strudel code.
 * - Prefer @strudel/mini parse for mini-notation strings at known call sites
 * - Keep bracket / paren / typo checks as always-on fallback
 */

type MiniParse = (code: string) => unknown

let mini2astFn: MiniParse | null | undefined

/** Lazy-load so a missing/broken @strudel/mini never breaks the editor bundle. */
async function ensureMini(): Promise<MiniParse | null> {
  if (mini2astFn !== undefined) return mini2astFn
  try {
    const mod = await import('@strudel/mini')
    mini2astFn = (mod.mini2ast ?? mod.parse) as MiniParse
  } catch {
    mini2astFn = null
  }
  return mini2astFn
}

// Kick off load early (non-blocking)
void ensureMini()

/** Call sites where the string arg is almost certainly mini-notation. */
const MINI_CALL_BEFORE =
  /(?:^|[^\w$.])(?:s|note|sound|struct|n|speed|gain|pan|room|delay|lpf|hpf|vowel|chop)\(\s*$/

function looksLikeMini(inner: string): boolean {
  return /[~*![\]<>@?/|,()]/.test(inner)
}

function bracketBalanceDiagnostics(
  inner: string,
  strStart: number,
  matchIndex: number,
  matchLen: number,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const pairs: [string, string, string][] = [
    ['[', ']', 'bracket'],
    ['<', '>', 'angle bracket'],
    ['(', ')', 'paren'],
  ]

  for (const [open, close, label] of pairs) {
    let depth = 0
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === open) depth++
      else if (inner[i] === close) depth--
      if (depth < 0) {
        diagnostics.push({
          from: strStart + i,
          to: strStart + i + 1,
          severity: 'error',
          message: `Unmatched closing ${label} ${close}`,
        })
        break
      }
    }
    if (depth > 0) {
      diagnostics.push({
        from: matchIndex,
        to: matchIndex + matchLen,
        severity: 'error',
        message: `Unmatched opening ${label} ${open} (${depth} unclosed)`,
      })
    }
  }
  return diagnostics
}

function tryMiniParseDiagnostics(
  parse: MiniParse,
  inner: string,
  strStart: number,
): Diagnostic[] {
  try {
    parse(inner)
    return []
  } catch (err) {
    const e = err as {
      message?: string
      location?: { start?: { offset?: number }; end?: { offset?: number } }
    }
    const startOff = e.location?.start?.offset
    const endOff = e.location?.end?.offset
    const msg = (e.message ?? String(err)).replace(/^\[mini\]\s*/i, '')
    if (typeof startOff === 'number') {
      const from = strStart + Math.max(0, startOff)
      const to =
        strStart +
        Math.max(from - strStart + 1, typeof endOff === 'number' ? endOff : startOff + 1)
      return [
        {
          from,
          to: Math.min(to, strStart + inner.length),
          severity: 'error',
          message: `Mini-notation: ${msg}`,
        },
      ]
    }
    // mini2ast sometimes wraps without peg location — fall through to brackets
    return [
      {
        from: strStart,
        to: strStart + Math.max(1, inner.length),
        severity: 'warning',
        message: `Mini-notation: ${msg}`,
      },
    ]
  }
}

function strudelLint(view: EditorView): Diagnostic[] {
  const code = view.state.doc.toString()
  const diagnostics: Diagnostic[] = []
  const parse = mini2astFn === undefined ? null : mini2astFn

  // ── Quoted strings: mini parse (when available) + bracket fallback ──
  const stringRegex = /(["'])((?:\\.|(?!\1).)*?)\1/g
  let match: RegExpExecArray | null
  while ((match = stringRegex.exec(code)) !== null) {
    const inner = match[2]
    const strStart = match.index + 1
    const before = code.slice(Math.max(0, match.index - 48), match.index)
    const isMiniSite = MINI_CALL_BEFORE.test(before) || looksLikeMini(inner)

    if (isMiniSite && parse) {
      diagnostics.push(...tryMiniParseDiagnostics(parse, inner, strStart))
    }

    // Bracket checks always retained as fallback (even when mini parse is active)
    diagnostics.push(
      ...bracketBalanceDiagnostics(inner, strStart, match.index, match[0].length),
    )
  }

  // ── Check: Unmatched JS-level parens ──
  let jsParenDepth = 0
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const closer = ch
      i++
      while (i < code.length && code[i] !== closer) {
        if (code[i] === '\\') i++
        i++
      }
      continue
    }
    if (ch === '(') jsParenDepth++
    else if (ch === ')') jsParenDepth--
    if (jsParenDepth < 0) {
      diagnostics.push({
        from: i,
        to: i + 1,
        severity: 'error',
        message: 'Unmatched closing parenthesis )',
      })
      jsParenDepth = 0
    }
  }
  if (jsParenDepth > 0) {
    diagnostics.push({
      from: Math.max(0, code.length - 1),
      to: code.length,
      severity: 'error',
      message: `${jsParenDepth} unclosed parenthesis`,
    })
  }

  // ── Check: Empty pattern strings ──
  const emptyPattern = /(?:s|note|sound)\(\s*["']\s*["']\s*\)/g
  let emptyMatch: RegExpExecArray | null
  while ((emptyMatch = emptyPattern.exec(code)) !== null) {
    diagnostics.push({
      from: emptyMatch.index,
      to: emptyMatch.index + emptyMatch[0].length,
      severity: 'warning',
      message: 'Empty pattern string — this will produce silence',
    })
  }

  // ── Check: Common typo — .gain without () ──
  const missingCallRegex = /\.(gain|lpf|hpf|room|delay|pan|speed|crush)\s*(?=[.\n]|$)/g
  let typoMatch: RegExpExecArray | null
  while ((typoMatch = missingCallRegex.exec(code)) !== null) {
    const after = code.slice(
      typoMatch.index + typoMatch[0].length,
      typoMatch.index + typoMatch[0].length + 5,
    )
    if (!after.startsWith('(')) {
      diagnostics.push({
        from: typoMatch.index + 1,
        to: typoMatch.index + typoMatch[0].length,
        severity: 'warning',
        message: `.${typoMatch[1]} needs arguments — did you mean .${typoMatch[1]}(value)?`,
      })
    }
  }

  return diagnostics
}

/**
 * Async-capable wrapper: once @strudel/mini loads, re-lint so mini diagnostics appear.
 */
export const strudelLinter = linter(
  async (view) => {
    await ensureMini()
    return strudelLint(view)
  },
  { delay: 500 },
)
