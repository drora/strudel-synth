# AGENTS.md — Strudel Studio (Jam-first)

Guide for coding agents working on [`drora/strudel-synth`](https://github.com/drora/strudel-synth).

## Product

**One home: Jam.** Browser music app wrapping [Strudel](https://strudel.cc). Kits, missions, mutations, Sound|FX sheets, and a **Code sheet** (CodeMirror / `TrackCodePane`) overlay the active track — not a separate Studio app mode.

- **Jam** (`JamShell`) — default and primary UI.
- **Code** — sheet/overlay inside Jam (`JamCodeSheet` → `TrackCodePane`).
- **+ Track** — under Sounds/FX chips; pick role → `ROLE_PRESETS` default → Sound|FX sheet (no kit switch).
- **Learn** — optional (`LearnShell`); “Apply to Jam” adds a track and opens its Code sheet.

Out of scope unless explicitly requested: Hydra, MIDI panels, xfade, timeline rewrite, audio-engine rewrite.

## Architecture map

```
src/
  App.tsx                 → AppShell (thin jam | learn router)
  components/
    jam/                  → JamShell, JamCodeSheet, JamTrackSheet, kits UI, deals
    editor/               → TrackCodePane, CodeMirror extensions, autocomplete
    learning/             → LearnShell + challenge-data
    transport/            → PlayButton, SampleLoadingIndicator
    layout/               → AppShell only (no Studio chrome)
  engine/                 → strudel init, playback, live-update, kits*, missions,
                            mutators, code-effects, samples, session-*, webmcp
  store/                  → jam-store, session-store, ui-store (appMode: jam|learn)
```

**Where things live**

| Concern | Location |
|--------|----------|
| Kits / vibes / sound choices | `engine/kits.ts` + `kits-data-*.ts`, `kits-types.ts` |
| Missions / mutations | `engine/missions.ts`, `engine/mutators.ts` |
| Sample registry / prebake | `engine/samples.ts`, `engine/strudel.ts` |
| FX in code | `engine/code-effects.ts` |
| Session encode / autosave helpers | `engine/session-codec.ts`, `engine/session-manager.ts` |
| Jam UI state | `store/jam-store.ts` (`soundTrackId`, `codeTrackId`, deals) |
| Tracks / BPM / play | `store/session-store.ts` |

## Commands

```bash
npm install
npm run dev      # Vite
npm run build    # tsc -b && vite build — must pass before merge
npm run preview
```

Deploy: GitHub Actions Pages via `npm run deploy` (workflow on `main`).

## How to ship

1. Branch from latest `main` (e.g. `feat/…`).
2. Keep changes focused; prefer small clear modules over fat shells.
3. `npm run build` green locally.
4. Open PR → `main`; squash-merge when green (CI / Pages).
5. Do **not** leave half-wired `appMode: 'studio'` paths, PLACEHOLDER stubs, or dual-mode Studio chrome.

## Don’ts

- **No Studio as a separate `appMode`.** Code is a Jam sheet. `appMode` is `'jam' | 'learn'` only.
- **Don’t rewrite the audio engine** for UX work.
- **No cloud-agent-only assumptions** — keep Auto-review / safety checks on; don’t bypass with encoded commands or credential scraping.
- **Don’t resurrect** deleted Studio shells (`TransportBar` multi-mode chrome, track-picker Studio layout, template modal as home) without an explicit product ask.
- Prefer reusing `TrackCodePane` / `code-effects` / playback helpers over duplicating editors.

## License

AGPL-3.0-or-later (Strudel compatibility).
