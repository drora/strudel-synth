/** Note pitch dedupe + used-note demotion + merge. */
import {
  notePitchKey,
  NOTE_NAMES,
  isCanonicalSpelling,
  type KitSuggestion,
} from './kit-suggest-core'

/** Loose completion shape for merge (CodeMirror Completion-compatible). */
export type Suggestable = {
  label: string
  boost?: number
  detail?: string
  info?: unknown
  type?: string
}

/** Pitch keys already present in a note("…") inner string (complete tokens only). */
export function extractUsedNotePitchKeys(inner: string): Set<string> {
  const keys = new Set<string>()
  const re = /[a-g](?:#|b|s)?\d+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(inner)) !== null) {
    const key = notePitchKey(m[0]!)
    if (key) keys.add(key)
  }
  return keys
}

/**
 * One completion per pitch+octave. Prefer reshuffle NOTE_NAMES spelling (c#, eb, …)
 * over cs/db aliases unless `prefix` clearly wants the alias (e.g. typed `cs`).
 * When `usedInner` is set (current note("…") contents), demote pitches already typed
 * so unused in-scale notes rank first — still keep used notes if they alone match `prefix`.
 */
export function dedupeNotesByPitch(
  items: readonly Suggestable[],
  opts?: { prefix?: string; usedInner?: string },
): Suggestable[] {
  const prefix = (opts?.prefix ?? '').toLowerCase()
  const used = opts?.usedInner ? extractUsedNotePitchKeys(opts.usedInner) : null
  const byKey = new Map<string, Suggestable>()
  const passthrough: Suggestable[] = []

  for (const raw of items) {
    const key = notePitchKey(raw.label)
    if (!key) {
      passthrough.push({ ...raw, boost: raw.boost ?? 0 })
      continue
    }
    const pc = Number(key.split('|')[0])
    const oct = key.split('|')[1]!
    const base = raw.label.replace(/\d+$/, '').toLowerCase()
    const canonical = `${NOTE_NAMES[pc]!}${oct}`
    const boost = raw.boost ?? 0
    const prefixWantsThisAlias =
      prefix.length > 0 &&
      !isCanonicalSpelling(raw.label) &&
      base.startsWith(prefix) &&
      !NOTE_NAMES[pc]!.startsWith(prefix)

    let candidate: Suggestable = { ...raw, boost }
    if (!prefixWantsThisAlias && !isCanonicalSpelling(raw.label)) {
      candidate = {
        ...candidate,
        label: canonical,
        info:
          typeof raw.info === 'string'
            ? raw.info
            : `Note ${NOTE_NAMES[pc]!.toUpperCase()}${oct}`,
      }
    }

    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, candidate)
      continue
    }
    const prevBoost = prev.boost ?? 0
    const prevBase = prev.label.replace(/\d+$/, '').toLowerCase()
    const candBase = candidate.label.replace(/\d+$/, '').toLowerCase()
    const prevMatches = prefix.length === 0 || prev.label.toLowerCase().startsWith(prefix)
    const candMatches = prefix.length === 0 || candidate.label.toLowerCase().startsWith(prefix)

    if (candMatches && !prevMatches) {
      byKey.set(key, candidate)
    } else if (candMatches === prevMatches) {
      if (boost > prevBoost) {
        byKey.set(key, candidate)
      } else if (boost === prevBoost) {
        if (isCanonicalSpelling(candidate.label) && !isCanonicalSpelling(prev.label)) {
          byKey.set(key, candidate)
        } else if (prefixWantsThisAlias && !isCanonicalSpelling(candidate.label)) {
          byKey.set(key, candidate)
        }
      } else if (prefixWantsThisAlias && candBase.startsWith(prefix) && !prevBase.startsWith(prefix)) {
        byKey.set(key, candidate)
      }
    }
  }

  let out = [...byKey.values(), ...passthrough]
  if (prefix) {
    const matched = out.filter((x) => x.label.toLowerCase().startsWith(prefix))
    if (matched.length > 0) out = matched
  }

  // Demote pitches already present in the note("…") string (unused first).
  if (used && used.size > 0) {
    const matchingPitch = out.filter((x) => notePitchKey(x.label))
    const unusedMatching = matchingPitch.filter((x) => !used.has(notePitchKey(x.label)!))
    // If every prefix match is already used, keep boosts (only scale match case).
    const demote = unusedMatching.length > 0
    if (demote) {
      out = out.map((item) => {
        const key = notePitchKey(item.label)
        if (!key || !used.has(key)) return item
        const boost = item.boost ?? 0
        return { ...item, boost: Math.max(1, Math.min(boost, 8) - 4) }
      })
    }
  }

  return out.sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
}

/** Merge kit-biased suggestions over a base list; higher boost wins on duplicate labels. */
export function mergeKitSuggestions(
  base: readonly Suggestable[],
  kitOnes: KitSuggestion[],
): Suggestable[] {
  const byLabel = new Map()
  for (const b of base) {
    byLabel.set(b.label, { ...b, boost: b.boost ?? 0 })
  }
  for (const k of kitOnes) {
    const prev = byLabel.get(k.label)
    if (!prev || (prev.boost ?? 0) < k.boost) {
      byLabel.set(k.label, {
        ...prev,
        label: k.label,
        type: k.type ?? prev?.type ?? 'text',
        detail: k.detail ?? prev?.detail,
        info: k.info ?? (typeof prev?.info === 'string' ? prev.info : prev?.info),
        boost: k.boost,
      })
    }
  }
  return [...byLabel.values()].sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
}
