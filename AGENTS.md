# AGENTS.md — Strudel Studio (Jam-first)

Guide for coding agents working on [`drora/strudel-synth`](https://github.com/drora/strudel-synth).

## Product

**One home: Jam.** Browser music app wrapping [Strudel](https://strudel.cc). Kits, missions, mutations, Sound|FX sheets, and a **Code sheet** (CodeMirror / `TrackCodePane`) overlay the active track — not a separate Studio app mode.

- **Jam** (`JamShell`) — default UI; `freshStartJam()` on mount / bfcache `pageshow` (prefer last `kitId`, then `reshuffleUnlocked`).
- **Code** — sheet/overlay inside Jam (`JamCodeSheet` → `TrackCodePane`).
- **+ Track** — under Sounds/FX chips; pick role → `ROLE_PRESETS` default → Sound|FX sheet (no kit switch).
- **Liveloop** — cycle phase on the BPM ring (`JamPhaseRing`) and a subtle per-track phase tick on chips (`JamTrackChip` / `useLoopPhase` via `liveUpdateEngine`); mic Rec (`JamMicRec` / `engine/mic-sample.ts`); simple A/B punch (`JamABToggle` near Kit). Mute is 1-tap via the **M** on each track chip (Mix tab volume still available).
- **Learn** — optional (`LearnShell`); “Apply to Jam” adds a track and opens its Code sheet.

Out of scope unless explicitly requested: Hydra, MIDI panels, xfade, clip rack, timeline rewrite, audio-engine rewrite.

## Architecture map

```
src/
  App.tsx                 → AppShell (thin jam | learn router)
  components/
    jam/                  → JamShell, JamTrackChip, JamCodeSheet, JamTrackSheet, kits UI, deals,
                            JamPhaseRing, JamMicRec, JamABToggle
    editor/               → TrackCodePane, CodeMirror extensions, kit-aware autocomplete
    learning/             → LearnShell + challenge-data
    transport/            → PlayButton, SampleLoadingIndicator
    layout/               → AppShell only (no Studio chrome)
  engine/                 → strudel init, playback, live-update, kits*, missions,
                            mutators, jam-actions, code-effects, samples, mic-sample, session-*, webmcp, strudel-docs-index
  hooks/                  → useLoopPhase, useIsMobile, useVisualViewport
  store/                  → jam-store (A/B variants), session-store, ui-store (appMode: jam|learn)
```

**Where things live**

| Concern | Location |
|--------|----------|
| Kits / vibes / sound choices / kit browser | `engine/kits.ts` + `kits-data-{a..f}.ts`, `kits-types.ts`, `kit-browser.ts`, `reshuffle.ts` (profile pools) |
| Kit-aware Code autocomplete | `engine/kit-suggest.ts` → `components/editor/strudel-autocomplete.ts` (active `kitId` + track role) |
| Missions / mutations | `engine/missions.ts`, `engine/mutators.ts` |
| Sample registry / prebake | `engine/samples.ts`, `engine/strudel.ts` |
| Mic → sample → track | `engine/mic-sample.ts`, `components/jam/JamMicRec.tsx` |
| Loop phase (BPM ring + chip ticks) | `hooks/useLoopPhase.ts`, `JamPhaseRing`, `JamTrackChip`, `liveUpdateEngine` |
| A/B arrangement punch | `store/jam-store.ts` (`stashVariant` / `punchVariant` / `toggleAb`), `JamABToggle` |
| FX in code | `engine/code-effects.ts` |
| Session encode / autosave helpers | `engine/session-codec.ts`, `engine/session-manager.ts` |
| Jam UI state | `store/jam-store.ts` (`soundTrackId`, `codeTrackId`, deals, A/B) |
| Tracks / BPM / play | `store/session-store.ts` |


## Kits catalog

~**71** Jam kits: **27** original + **44** cherry-picks (Rank **A** 14 · **B** 19 · usable **C** 11). Data split across `kits-data-{a,b,c,d,e,f}.ts`; `kits.ts` concatenates and owns `SOUND_CHOICES`.

A **Kit** is **identity + shuffle profile**, not frozen Strudel recipes. Each kit keeps `id` / vibe / name / bpm / `drumsBank`, a track **layout** (name + role only — no baked `code`), and a `shuffle` profile (`groove`, `density`, optional `root` / `scale` / `melodicSounds` / `fxBias` / `pinN`). `kitToTemplate` / `generateKitTracks` / `reshuffleTrack` regenerate in-pattern code on every apply, reload, and Shuffle (same bank + groove + scale family, not identical lines).

- **Kit-first browser** — `kit-browser.ts`: soft tags (tempo / bank / vibe), search, random pick. Every `drumsBank` needs a `BANK_SHORT` entry.
- **Collision-safe names** — unique `kit.id` + display names with model (LM-2, CR-1000, DR-550, SK-1, etc.); never bare “Linn” / “Casio” / “DR”.
- **Track sheet Shuffle** — per-lane reshuffle (`reshuffleTrackById` / `shuffle_sounds` optional `trackId`); lead pools use multiple pattern families (held, syncopated, call-response, euclidean-ish, motifs, plain).
- **Sound sheet + autocomplete** — melodic roles (lead/pad/arp/bass/vox/custom) have richer `SOUND_CHOICES`; `FEATURED_BANKS` + `CURATED_AUTOCOMPLETE_SAMPLES` keep Code bank/sample completion in sync with kits. **Code autocomplete** soft-ranks using the active kit `shuffle` profile + `drumsBank` (same pools as apply/reshuffle): stable in-scale notes (enharmonics deduped), plus shuffle-sampled groove/motif neighbors each open; kit bank / `melodicSounds` first — never full-line regen on keystroke (`engine/kit-suggest.ts`).
- **Heavy packs curated** — `YamahaRM50` / `RolandMC303` profiles use `shuffle.pinN: 0`; do **not** dump all bank files into the Sound sheet.
- **Non-tidal banks** — dirt / uzu / mridangam / VCSL / piano use stable short `drumsBank` strings (`dirt-amen`, `uzu`, `mridangam`, `vcsl`, …) for tags; reshuffle voices them specially (amen chops, tabla, gretsch, etc.).
- Existing 27 kits stay unchanged when expanding; skip D-rank and deferred community crates unless explicitly asked.


## WebMCP + agent skills

Browser agents talk to the live Jam via **WebMCP** (`src/engine/webmcp.ts` → `navigator.modelContext`). Shared mutators live in `src/engine/jam-actions.ts` (also used by `useJamShell`) so tools are not UI-only. Cold/reload: `freshStartJam()` (once per page + bfcache `pageshow`) — prefer last `kitId`, then generate+reshuffle from that kit’s shuffle profile; `applyKit` (picker / New Kit / WebMCP) always regenerates (`kit · Name · shuffled`) and keeps `drumsBank` / groove / scale coherent.

**Core (always):** `get_session`, `set_bpm`, `update_track`, `add_track`, `remove_track`, `mute_track`, `solo_track`, `play`, `stop`, `get_reference`, `get_samples`, `get_scales_and_chords`, `evaluate_code`.

**Jam parity:** `get_jam_state`, `get_phase`, `list_kits`, `get_kit`, `apply_kit`, `set_lock_kit`, `shuffle_sounds`, `set_volume`, `set_active_track`, `list_sound_choices`, `apply_sound_choice`, `set_fx`, `open_code_sheet`, `close_code_sheet`, `stash_ab` / `punch_ab` / `toggle_ab`, `list_deals`, `apply_mutation`, `apply_mission`, `undo_jam`, `redeal`, `search_strudel_docs`, `mic_status` (Rec is user-gesture only).

**Skill (in-repo):** `resources/skills/jam-liveloop/` — copy/symlink into Cursor skills (see that folder’s `README.md`). Recipe: get_session first; one change/turn; prefer `update_track` quant 1/2; never hush/stop/remove without ask.

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
- **Don’t ship PLACEHOLDER kit stubs** or uncurated mega-banks (RM50/MC303) into UI tiles.
- Keep liveloop UI tiny (phase ring, one Rec, one A/B chip group) — no clip rack.

## License

AGPL-3.0-or-later (Strudel compatibility).
