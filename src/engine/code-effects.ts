/** Effect / sound-chain methods safe to pin across reshuffles and kit swaps. */
export const PINNABLE_EFFECTS = new Set([
  'lpf', 'hpf', 'lpq', 'hpq', 'bpf', 'bandpass', 'vowel',
  'room', 'size', 'roomsize',
  'delay', 'delaytime', 'delayfeedback',
  'gain', 'shape', 'distort', 'crush', 'coarse',
  'phaser', 'tremolo', 'pan',
  'attack', 'decay', 'sustain', 'release',
  'lpenv', 'lpa', 'lpd', 'lps', 'lpr',
  'hpenv', 'hpa', 'hpd', 'hps', 'hpr',
  'fm', 'fmh', 'fmenv', 'fmdecay', 'fmattack', 'fmrelease', 'fmsustain',
  'speed', 'begin', 'end', 'orbit', 'duck', 'duckattack', 'duckorbit',
  'sound', 'bank',
])

/** Scalar number only — returns null for patterned / expression args. */
export function parseEffectValue(code: string, key: string): number | null {
  const regex = new RegExp(`\\.${key}\\((\\d+\\.?\\d*)\\)`)
  const match = code.match(regex)
  return match ? parseFloat(match[1]) : null
}

/**
 * True when `.key(...)` exists but the argument is not a plain scalar number.
 */
export function isPatternedEffect(code: string, key: string): boolean {
  const call = new RegExp(`\\.${key}\\(([^)]*)\\)`)
  const m = code.match(call)
  if (!m) return false
  const inner = m[1].trim()
  if (inner.length === 0) return false
  if (/^\d+\.?\d*$/.test(inner)) return false
  return true
}

export function setEffectInCode(code: string, key: string, value: number): string {
  const regex = new RegExp(`\\.${key}\\([^)]*\\)`)
  const replacement = `.${key}(${value})`
  if (regex.test(code)) return code.replace(regex, replacement)
  return code.trimEnd() + replacement
}

/**
 * Split trailing `.method(...)` calls that look like effects / sound.
 * Nested parens inside args are not supported (good enough for studio code).
 */
export function splitEffectSuffix(code: string): { head: string; fx: string } {
  let rest = code.trimEnd()
  const parts: string[] = []
  const re = /(\.[a-zA-Z_]\w*\([^()]*\))$/
  while (true) {
    const m = rest.match(re)
    if (!m) break
    const call = m[1]!
    const name = call.slice(1, call.indexOf('('))
    if (!PINNABLE_EFFECTS.has(name)) break
    parts.unshift(call)
    rest = rest.slice(0, -call.length).trimEnd()
  }
  return { head: rest, fx: parts.join('') }
}

export function setMethodString(code: string, key: string, value: string): string {
  const regex = new RegExp(`\\.${key}\\([^)]*\\)`)
  const replacement = `.${key}("${value}")`
  if (regex.test(code)) return code.replace(regex, replacement)
  return code.trimEnd() + replacement
}

export function setBankInCode(code: string, bank: string): string {
  return setMethodString(code, 'bank', bank)
}

export function setSoundInCode(code: string, sound: string): string {
  return setMethodString(code, 'sound', sound)
}

/** Read `.bank("Name")` if present. */
export function getBankFromCode(code: string): string | null {
  const m = code.match(/\.bank\(\s*["']([^"']+)["']\s*\)/)
  return m?.[1] ?? null
}

export function getSoundFromCode(code: string): string | null {
  const m = code.match(/\.sound\(\s*["']([^"']+)["']\s*\)/)
    ?? code.match(/\.s\(\s*["']([^"']+)["']\s*\)/)
  return m?.[1] ?? null
}

/** Set or append `.n(index)` for drum-machine sample variant. */
export function setNInCode(code: string, n: number): string {
  const regex = /\.n\([^)]*\)/
  const replacement = `.n(${Math.max(0, Math.floor(n))})`
  if (regex.test(code)) return code.replace(regex, replacement)
  return code.trimEnd() + replacement
}

export function getNFromCode(code: string): number | null {
  const m = code.match(/\.n\(\s*(\d+)\s*\)/)
  return m ? parseInt(m[1]!, 10) : null
}
