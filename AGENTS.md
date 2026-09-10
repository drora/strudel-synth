# AGENTS.md — Strudel Studio (Jam-first)

Guide for coding agents working on [`drora/strudel-synth`](https://github.com/drora/strudel-synth).

## Product

**One home: Jam.** Browser music app wrapping [Strudel](https://strudel.cc). Kits, missions, mutations, Sound|FX sheets, and a **Code sheet** (CodeMirror / `TrackCodePane`) overlay the active track — not a separate Studio app mode.

- **Jam** (`JamShell`) — default UI; `freshStartJam()` on mount / bfcache `pageshow` (prefer last `kitId`, then `reshuffleUnlocked`).
- **Learn** — optional teaching path; **Apply to Jam** adds a track + opens Code sheet.
- **+ Track** — under Sounds/FX chips; pick role → `ROLE_PRESETS` default → Sound|FX sheet (no kit switch).
- **Liveloop** — cycle phase on the BPM ring (`JamPhaseRing`) and a subtle per-track phase tick on chips (`JamTrackChip` / `useLoopPhase` via `liveUpdateEngine`); mic Rec (`JamMicRec` / `engine/mic-sample.ts`); simple A/B punch (`JamABToggle` near Kit). Mute is 1-tap via the **M** on each track chip (Mix tab volume still available).

Deploy: GitHub Pages (`https://drora.github.io/strudel-synth/`). Stack: React 18 + Vite + TypeScript + Zustand + Strudel packages.

## Layout (where to edit)

```
src/
  App.tsx                 → shell routes; default is Jam
  components/
    jam/                  → JamShell, JamTrackChip, JamCodeSheet, JamTrackSheet, kits UI, deals,
                            JamPhaseRing, JamMicRec, JamABToggle
    editor/               → CodeMirror (TrackCodePane), used inside Jam Code sheet
    learning/             → LearnShell + challenges
    transport/            → TransportBar (shared)
    session/ layout/ ui/  → session chrome, toasts, etc.
  engine/                 → strudel init, playback, live-update, kits*, missions,
                            mutators, reshuffle, mic-sample, webmcp, …
  store/                  → session-store, jam-store, ui-store, …
  hooks/                  → useJamShell, useLoopPhase, …
resources/skills/         → agent skills (e.g. jam-liveloop)
```

| Task | Where |
|------|--------|
| Kits / vibes / sound choices / kit browser | `engine/kits.ts` + `kits-data-{a..f}.ts`, `kits-types.ts`, `kit-browser.ts` |
| Missions / mutations / reshuffle | `engine/missions.ts`, `mutators.ts`, `reshuffle.ts` |
| Jam UI chrome / chips / sheets | `components/jam/*` |
| Code sheet + CM6 | `components/jam/JamCodeSheet.tsx` + `components/editor/*` |
| Transport / BPM / play | `components/transport/*`, `engine/playback.ts`, `live-update.ts` |
| Mic rec / A/B / phase | `engine/mic-sample.ts`, `jam-store` variants, `hooks/useLoopPhase.ts` |
| WebMCP tools | `engine/webmcp.ts` + `engine/jam-actions.ts` |
| Learn | `components/learning/*` |

## Kits catalog

~**71** Jam kits: **27** original + **44** cherry-picks (Rank **A** 14 · **B** 19 · usable **C** 11). Data split across `kits-data-{a,b,c,d,e,f}.ts`; `kits.ts` concatenates and owns `SOUND_CHOICES`.

- **Kit-first browser** — `kit-browser.ts`: soft tags (tempo / bank / vibe), search, random pick. Every `drumsBank` needs a `BANK_SHORT` entry.
- **Collision-safe names** — unique `kit.id` + display names with model (LM-2, CR-1000, DR-550, SK-1, etc.); never bare “Linn” / “Casio” / “DR”.
- **Sound sheet + autocomplete** — melodic roles (lead/pad/arp/bass/vox/custom) have richer `SOUND_CHOICES`; `FEATURED_BANKS` + `CURATED_AUTOCOMPLETE_SAMPLES` keep Code bank/sample completion in sync with kits.
- **Audit / ranking** — `docs/kit-candidates-ranked.md` (A/B/C/D + skip/deferred). Prefer A/B; usable C only when labeled.
- **Samples** — banks must resolve via `@strudel/desktop-bridge` / sample json (`tidal-drum-machines`, `uzu`, `mridangam`, `vcsl`, `piano`, dirt-samples).
- Existing 27 kits stay unchanged when expanding; skip D-rank and deferred community crates unless explicitly asked.


## WebMCP + agent skills

Browser agents talk to the live Jam via **WebMCP** (`src/engine/webmcp.ts` → `navigator.modelContext`). Shared mutators live in `src/engine/jam-actions.ts` (also used by `useJamShell`) so tools are not UI-only. Cold/reload: `freshStartJam()` (once per page + bfcache `pageshow`) — prefer last `kitId`, then reshuffle; `applyKit` (picker / New Kit / WebMCP) always reshuffles patterns (drum bank locked when lockKit).

**Core (always):** `get_session`, `set_bpm`, `update_track`, `add_track`, `remove_track`, `mute_track`, `solo_track`, `play`, `stop`, `get_reference`, `get_samples`, `get_scales_and_chords`, `evaluate_code`.

**Jam parity:** `get_jam_state`, `get_phase`, `list_kits`, `get_kit`, `apply_kit`, `set_lock_kit`, `shuffle_sounds`, `set_volume`, `set_active_track`, `list_sound_choices`, `apply_sound_choice`, `set_fx`, `open_code_sheet`, `close_code_sheet`, `stash_ab` / `punch_ab` / `toggle_ab`, `list_deals`, `apply_mutation`, `apply_mission`, `undo_jam`, `redeal`, `search_strudel_docs`, `mic_status` (Rec is user-gesture only).

**Skill (in-repo):** `resources/skills/jam-liveloop/` — copy/symlink into Cursor skills (see that folder’s `README.md`). Recipe: get_session first; one change/turn; prefer `update_track` quant 1/2; never hush/stop/remove without ask.

## Conventions

- **Jam-first** — new features belong in Jam sheets/chips, not a revived Studio mode.
- TypeScript strict; Zustand for app state; don’t break Play / live-update.
- Mobile-friendly hit targets; keep Code sheet in-Jam.
- Conventional commits (`feat:` / `fix:` / `docs:` …).
- `npm run build` must pass before merge.

## Don’ts

- **Don’t add a top-level Studio tab** or route that leaves Jam for editing.
- **Don’t invent sample banks** that aren’t in the bridge / known json maps.
- **Don’t ship PLACEHOLDER kit stubs** or uncurated mega-banks (RM50/MC303) into UI tiles.
- **Don’t remove WebMCP registration** or starve tools of shared `jam-actions` (UI and agents share behavior).
- **Don’t commit secrets**; don’t force-push `main`.

## Quick commands

```bash
npm install
npm run dev      # vite
npm run build    # tsc -b && vite build
npm run lint
```
