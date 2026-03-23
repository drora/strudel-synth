import { linter, type Diagnostic } from '@codemirror/lint'

/**
 * Static linter for Strudel code.
 * Catches common syntax mistakes before evaluation.
 */
function strudelLint(view: { state: { doc: { toString: () => string } } }): Diagnostic[] {
  const code = view.state.doc.toString()
  const diagnostics: Diagnostic[] = []

  // ── Check: Unmatched brackets in mini-notation ──
  // Find all quoted strings and check bracket balance
  const stringRegex = /(["'])((?:\\.|(?!\1).)*?)\1/g
  let match: RegExpExecArray | null
  while ((match = stringRegex.exec(code)) !== null) {
    const inner = match[2]
    const strStart = match.index + 1 // skip opening quote

    // Check [] balance
    let bracketDepth = 0
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '[') bracketDepth++
      else if (inner[i] === ']') bracketDepth--
      if (bracketDepth < 0) {
        diagnostics.push({
          from: strStart + i,
          to: strStart + i + 1,
          severity: 'error',
          message: 'Unmatched closing bracket ]',
        })
        break
      }
    }
    if (bracketDepth > 0) {
      diagnostics.push({
        from: match.index,
        to: match.index + match[0].length,
        severity: 'error',
        message: `Unmatched opening bracket [ (${bracketDepth} unclosed)`,
      })
    }

    // Check <> balance
    let angleDepth = 0
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '<') angleDepth++
      else if (inner[i] === '>') angleDepth--
      if (angleDepth < 0) {
        diagnostics.push({
          from: strStart + i,
          to: strStart + i + 1,
          severity: 'error',
          message: 'Unmatched closing angle bracket >',
        })
        break
      }
    }
    if (angleDepth > 0) {
      diagnostics.push({
        from: match.index,
        to: match.index + match[0].length,
        severity: 'error',
        message: `Unmatched opening angle bracket < (${angleDepth} unclosed)`,
      })
    }

    // Check () balance inside mini-notation (euclidean rhythms)
    let parenDepth = 0
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '(') parenDepth++
      else if (inner[i] === ')') parenDepth--
      if (parenDepth < 0) {
        diagnostics.push({
          from: strStart + i,
          to: strStart + i + 1,
          severity: 'error',
          message: 'Unmatched closing paren )',
        })
        break
      }
    }
    if (parenDepth > 0) {
      diagnostics.push({
        from: match.index,
        to: match.index + match[0].length,
        severity: 'error',
        message: `Unmatched opening paren ( (${parenDepth} unclosed)`,
      })
    }
  }

  // ── Check: Unmatched JS-level parens ──
  let jsParenDepth = 0
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    // Skip strings
    if (ch === '"' || ch === "'" || ch === '`') {
      const closer = ch
      i++
      while (i < code.length && code[i] !== closer) {
        if (code[i] === '\\') i++ // skip escaped
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
      from: code.length - 1,
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
    // Make sure it's not followed by (
    const after = code.slice(typoMatch.index + typoMatch[0].length, typoMatch.index + typoMatch[0].length + 5)
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

export const strudelLinter = linter(strudelLint, { delay: 500 })
