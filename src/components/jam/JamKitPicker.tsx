import { useMemo, useRef, useState, type UIEvent } from 'react'
import type { Kit } from '../../engine/kits'
import {
  drumsBankShortName,
  listKitSoftTags,
  filterKits,
  type SoftTag,
} from '../../engine/kit-browser'

interface Props {
  kits: Kit[]
  kitId: string | null
  /** Controlled filter tags (shared with New Kit). */
  filterTags: string[]
  filterSearch: string
  onFilterTagsChange: (tags: string[]) => void
  onFilterSearchChange: (search: string) => void
  onPick: (id: string) => void
  onSkip: () => void
}

/** Collapse only after scrolling down past this; expand only near top (hysteresis). */
const COLLAPSE_AT = 48
const EXPAND_AT = 12
/** Minimum downward delta before collapse while expanded. */
const COLLAPSE_DELTA = 8
/** Ignore scroll while layout height settles after expand/collapse. */
const SCROLL_IGNORE_MS = 250

function toggleTag(tags: string[], id: string): string[] {
  return tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id]
}

function TagChip({
  tag,
  active,
  onToggle,
}: {
  tag: SoftTag
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 min-h-9 px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
        active
          ? 'bg-accent text-bg border-accent'
          : 'bg-bg text-text-muted border-border hover:border-accent/40'
      }`}
      aria-pressed={active}
    >
      {tag.label}
    </button>
  )
}

function collapsedFilterSummary(search: string, tagCount: number): string {
  const q = search.trim()
  const parts: string[] = []
  if (q) parts.push(q.length > 28 ? `${q.slice(0, 28)}…` : q)
  if (tagCount > 0) {
    parts.push(`${tagCount} filter${tagCount === 1 ? '' : 's'}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Search / filter'
}

export function JamKitPicker({
  kits,
  kitId,
  filterTags,
  filterSearch,
  onFilterTagsChange,
  onFilterSearchChange,
  onPick,
  onSkip,
}: Props) {
  const softTags = useMemo(() => listKitSoftTags(kits), [kits])
  const filtered = useMemo(
    () => filterKits(kits, { search: filterSearch, tags: filterTags }),
    [kits, filterSearch, filterTags],
  )
  const [localFocus, setLocalFocus] = useState(false)
  /** Open on mount so search/filters are visible immediately. */
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)
  const ignoreScrollUntilRef = useRef(0)

  const tempoTags = softTags.filter((t) => t.kind === 'tempo')
  const bankTags = softTags.filter((t) => t.kind === 'bank')
  const vibeTags = softTags.filter((t) => t.kind === 'vibe')

  const setCollapsed = (collapsed: boolean) => {
    setFiltersCollapsed(collapsed)
    ignoreScrollUntilRef.current = performance.now() + SCROLL_IGNORE_MS
  }

  const expandFilters = () => {
    setCollapsed(false)
    const list = listRef.current
    if (list) {
      list.scrollTop = 0
      lastScrollTopRef.current = 0
    }
  }

  const onKitListScroll = (e: UIEvent<HTMLDivElement>) => {
    if (performance.now() < ignoreScrollUntilRef.current) {
      lastScrollTopRef.current = e.currentTarget.scrollTop
      return
    }
    const scrollTop = e.currentTarget.scrollTop
    const delta = scrollTop - lastScrollTopRef.current
    lastScrollTopRef.current = scrollTop

    if (scrollTop < EXPAND_AT) {
      if (filtersCollapsed) setCollapsed(false)
      return
    }

    if (delta > COLLAPSE_DELTA && scrollTop > COLLAPSE_AT) {
      if (!filtersCollapsed) setCollapsed(true)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div
        className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3 max-h-[85vh] flex flex-col"
        role="dialog"
        aria-label="Kit browser"
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="text-sm font-semibold">Kits</div>
          <button
            type="button"
            className="min-h-9 px-2 text-xs text-text-muted hover:text-accent"
            onClick={onSkip}
          >
            Close
          </button>
        </div>

        {filtersCollapsed ? (
          <button
            type="button"
            className="shrink-0 w-full min-h-9 px-3 rounded-xl border border-border bg-bg-elevated text-left text-[11px] text-text-muted hover:border-accent/40 hover:text-accent transition-colors truncate relative z-10"
            onClick={expandFilters}
            aria-expanded={false}
            aria-label="Expand search and filters"
          >
            {collapsedFilterSummary(filterSearch, filterTags.length)}
          </button>
        ) : (
          <div className="shrink-0 space-y-3">
            <p className="text-xs text-text-muted">
              Search and filter, then pick a full kit recipe.
            </p>

            <input
              type="search"
              value={filterSearch}
              onChange={(e) => onFilterSearchChange(e.target.value)}
              onFocus={() => setLocalFocus(true)}
              onBlur={() => setLocalFocus(false)}
              placeholder="Search kits, banks, BPM…"
              className={`w-full min-h-11 px-3 rounded-xl bg-bg border text-sm outline-none transition-colors ${
                localFocus ? 'border-accent' : 'border-border'
              }`}
              aria-label="Search kits"
            />

            <div className="space-y-2">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {tempoTags.map((t) => (
                  <TagChip
                    key={t.id}
                    tag={t}
                    active={filterTags.includes(t.id)}
                    onToggle={() =>
                      onFilterTagsChange(toggleTag(filterTags, t.id))
                    }
                  />
                ))}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {bankTags.map((t) => (
                  <TagChip
                    key={t.id}
                    tag={t}
                    active={filterTags.includes(t.id)}
                    onToggle={() =>
                      onFilterTagsChange(toggleTag(filterTags, t.id))
                    }
                  />
                ))}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {vibeTags.map((t) => (
                  <TagChip
                    key={t.id}
                    tag={t}
                    active={filterTags.includes(t.id)}
                    onToggle={() =>
                      onFilterTagsChange(toggleTag(filterTags, t.id))
                    }
                  />
                ))}
              </div>
            </div>

            {(filterTags.length > 0 || filterSearch.trim()) && (
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>
                  {filtered.length} kit{filtered.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="hover:text-accent"
                  onClick={() => {
                    onFilterTagsChange([])
                    onFilterSearchChange('')
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto space-y-1.5 -mx-1 px-1"
          onScroll={onKitListScroll}
        >
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              No kits match — try clearing filters.
            </div>
          ) : (
            filtered.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => onPick(k.id)}
                className={`w-full min-h-14 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  kitId === k.id
                    ? 'border-accent bg-accent/15'
                    : 'border-border hover:border-accent/50 bg-bg'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-medium truncate">{k.name}</div>
                  <div className="text-[11px] text-accent font-medium shrink-0 tabular-nums">
                    {k.bpm} BPM
                  </div>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5 leading-snug flex items-center gap-1.5 flex-wrap">
                  <span className="text-text-muted/90">
                    {drumsBankShortName(k.drumsBank)}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{k.description}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
