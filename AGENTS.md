# AGENTS.md — Strudel Studio (Jam-first)

Guide for coding agents working on [`drora/strudel-synth`](https://github.com/drora/strudel-synth).

## Product

**One home: Jam.** Browser music app wrapping [Strudel](https://strudel.cc). Kits, Sound|FX sheets, and a **Code sheet** (CodeMirror / `TrackCodePane`) overlay the active track — not a separate Studio app mode.

- **Jam** (`JamShell`) — default UI; `freshStartJam()` on mount / bfcache `pageshow` (prefer last `kitId`, then `reshuffleUnlocked`). Song **Root/Scale** near Kit (defaults from kit `shuffle.root`/`scale`); feeds Shuffle; changing remaps melodic `note(...)` (drums/fx ignore). Melodic tracks expose **Octave** on the Mix tab (± shifts pitches; Sound pinned). Per-track **Lock** pins lane from Shuffle / Shuffle this / Mutate; Mix tab + chip; not kit Lock. Footer **Mutate** sheet applies deterministic pattern transforms (last-touched track; Half/Double-time = song; Undo). Footer: New kit / Mutate / Shuffle / Spice. **Pads** sits under `+ Track` (8 fixed pads; SuperDough one-shots (~20ms warm lead) — jam stack stays put; hold-to-sustain + Vel; volume + LPF/HPF/Room/Delay/Gain; Keep → last phrase only (from first note; octave change does not split), sheet closes, `@` holds, `~` gaps, `.velocity`; Rec holds smear at hold÷take, no chip; Keep `.slow` when the sentence is longer than a bar; Pads chip Sound sheet uses the live pad voice list, not vox Mouth/Yeah/Hmm/Auto; Clear drops the take; last voice / octave / mix / FX survive close).
- **Code** — sheet/overlay inside Jam (`JamCodeSheet` → `TrackCodePane`). Kit-row `</> Code` opens one editor for every track (Save evaluates); header GitHub mark opens `drora/strudel-synth` in a new tab. Chip long-press / Edit in Code still opens one track. Last-touched chip: thin accent ring + tiny purple dot (`JamTrackChip`).
- **+ Track** — under Sounds/FX chips; pick role → `ROLE_PRESETS` default → Sound|FX sheet (no kit switch).
- **Liveloop** — cycle phase on the BPM ring (`JamPhaseRing`) and a subtle per-track phase tick on chips (`JamTrackChip` / `useLoopPhase` via `liveUpdateEngine`); mic Rec (`JamMicRec` / `engine/mic-sample.ts` — release the mic when Rec finishes; skip `initEngine` if Play is on or SuperDough is already up; never silent-unlock a live context); simple A/B punch (`JamABToggle` on the walk-hint row). Walk chips are inert hints. Jam top chrome (Kit+Code, Root/Scale, walk+A/B) is anchored. Pinch-zoom blocked where the browser allows. Mute is 1-tap via the **M** on each track chip (Mix tab volume still available).
- **Learn** — optional (`LearnShell`); “Apply to Jam” adds a track and opens its Code sheet.

## Architecture map

```
src/
  App.tsx                 → AppShell (thin jam | learn router)
  components/
    jam/                  → JamShell, JamTrackChip, JamCodeSheet, JamAllCodeSheet, JamTrackSheet, JamMutateSheet, JamImprovPlate, kits UI,
                            JamPhaseRing, JamMicRec, JamABToggle
    editor/               → TrackCodePane, CodeMirror extensions, kit-aware autocomplete
    learning/             → LearnShell + challenge-data
    transport/            → PlayButton, SampleLoadingIndicator
    layout/               → AppShell only (no Studio chrome)
  engine/                 → strudel init, playback, live-update, kits*, jam-actions,
                            last-touched, mutate, code-effects, samples, mic-sample, session-*, webmcp
  hooks/                  → useLoopPhase, useIsMobile, useVisualViewport
  store/                  → jam-store (A/B, lastTouchedTrackId), session-store, ui-store (appMode: jam|learn)
```

**Where things live**

| Concern | Location |
|--------|----------|
| Kits / vibes / sound choices / kit browser | `engine/kits.ts` + `kits-data-{a..f}.ts`, `kits-types.ts`, `kit-browser.ts`, `reshuffle.ts` (profile pools) |
| Kit-aware Code autocomplete | `engine/kit-suggest.ts` → `components/editor/strudel-autocomplete.ts` (active `kitId` + track role + song root/scale) |
| Sample registry / prebake | `engine/samples.ts`, `engine/strudel.ts` |
| Mic → sample → track | `engine/mic-sample.ts`, `components/jam/JamMicRec.tsx` — new vox track; do not pop Sound |
| Loop phase (BPM ring + chip ticks) | `hooks/useLoopPhase.ts`, `JamPhaseRing`, `JamTrackChip`, `liveUpdateEngine` |
| A/B arrangement punch | `store/jam-store.ts` (`stashVariant` / `punchVariant` / `toggleAb`), `JamABToggle` |
| FX in code | `engine/code-effects.ts` |
| Session encode / autosave helpers | `engine/session-codec.ts`, `engine/session-manager.ts` |
| Jam UI state | `store/jam-store.ts` (`soundTrackId`, `codeTrackId`, `lastTouchedTrackId`, `songRoot`/`songScale`, A/B, undo) |
| Song key + octave | `engine/note-harmony.ts` + `setSongHarmony` / `setTrackOctave` in `jam-actions-a`; Shuffle uses song root/scale; track `octave` offset |
| Spice (FX-only) | `engine/spice.ts` — one-tap `setEffectInCode` nudges (lpf/room/shape/delay/gain). **Spice ≠ Shuffle** |
| Mutate (patterns) | `engine/mutate.ts` — deterministic s()/note() transforms (Sparse…Stutter + Rotate/Reverse/…). Track via `lastTouchedTrackId`; Half/Double-time = song. Undo snapshots (batch for song). **Mutate ≠ Shuffle ≠ Spice** |
| Improv pads / Keep vox | `engine/improv-plate.ts` + `improv-trigger.ts` + `JamImprovPlate` — 8 fixed pads (2×4); walk-glow triad; SuperDough one-shots (no jam re-eval); Keep → new vox track (mix baked, including Gain); octave change does not split Keep; sheet closes |
| Last-touched track | `engine/last-touched.ts` + `jam-store.lastTouchedTrackId` — header Code + chip ring/dot; tap/Code open/edits update; mute does not |
| Tracks / BPM / play | `store/session-store.ts` |

## Kits catalog

~**76** Jam kits: **27** original + **44** locked cherry-picks (Rank **A** 14 · **B** 19 · usable **C** 11) + **5** leftover CDN (DDM-110, TG-33, D-110, T3, KRZ). Data split across `kits-data-{a,b,c,d,e,f}.ts`; `kits.ts` concatenates and owns `SOUND_CHOICES`.

A **Kit** is **identity + shuffle profile**, not frozen Strudel recipes. Each kit keeps `id` / vibe / name / bpm / `drumsBank`, a track **layout** (name + role only — no baked `code`), and a `shuffle` profile (`groove`, `density`, optional `root` / `scale` / `melodicSounds` / `fxBias` / `pinN`). `kitToTemplate` / `generateKitTracks` / `reshuffleTrack` regenerate in-pattern code on every apply, reload, and Shuffle (same bank + groove + scale family, not identical lines).

- **Kit-first browser** — `kit-browser.ts`: soft tags (tempo / bank / vibe), search, random pick. Every `drumsBank` needs a `BANK_SHORT` entry. Scrolling the kit list collapses search/filter chips; tap the compact bar to expand (filters stay applied).
- **Collision-safe names** — unique `kit.id` + display names with model (LM-2, CR-1000, DR-550, SK-1, etc.); never bare “Linn” / “Casio” / “DR”.
- **Song seed (chord walk)** — melodic generate follows a `SongSeed` walk (`engine/song-seed.ts`): Song **Shuffle** rolls a new seed (same Root/Scale); per-track Shuffle keeps the seed and re-voices that lane; Sound still pins. Seed also carries `kickClock`, a per-role density `budget`, and a `mix` card (gain/pan/room/delay + bass/kick LPF + optional swing/euclid/duck feel). Song scales: minor/major/dorian/pentatonic/mixolydian/phrygian/lydian/harmonic_minor. Jam shows display-only **concert-name walk chips** under Root/Scale (`walkConcertNames`: Cm · Ab · Eb · G). Hats fill around the kick; amen/breaks hats use that voice (never leftover `hh`). Shuffle pin rewrites only the primary `s()` hit. `applyKit` is one generate (no double reshuffle). Each visit’s first generate (empty session) randomizes home + scale from the full `SONG_ROOTS` × `SONG_SCALES` pools (avoid current). `hasPickedKit` is only for the picker. Later kit changes (picker / New kit) keep that pair. Dice next to Scale re-rolls both and remaps unlocked `note()` lanes.
- **Track sheet Shuffle** — per-lane reshuffle (`reshuffleTrackById` / `shuffle_sounds` optional `trackId`); **Shuffle pins sound/bank, regenerates pattern only** (rhythm + notes may change; Sound tile stays). Lead pools use multiple pattern families (held, syncopated, call-response, euclidean-ish, motifs, plain).
- **Sound sheet + autocomplete** — Sound sheet is kit-scoped via `soundChoicesForKit` (kit-first: bank/melodicSounds prioritized, other globals still listed; special-voice kits show native samples only; **nobank** kits like Uzu/piano/vcsl-keys get dirt `bd`/`sd`/`cp`/… tiles for drum roles, not synths; bank kits missing from a role catalog get a `drumsBank` fallback tile so highlight works). Melodic roles (lead/pad/arp/bass/vox/custom) have richer `SOUND_CHOICES`; `FEATURED_BANKS` + `CURATED_AUTOCOMPLETE_SAMPLES` keep Code bank/sample completion in sync with kits. **Code autocomplete** soft-ranks using the active kit `shuffle` profile + `drumsBank` (same pools as apply/reshuffle), with **song** `songRoot`/`songScale` for `note()` / scale / melodic motifs (same override as Shuffle): stable single-pitch in-scale notes with scale `detail` (enharmonics deduped; already-used pitches demoted); shuffle-sampled groove/motif neighbors in pattern / `s(` contexts; kit bank / `melodicSounds` first — never full-line regen on keystroke (`engine/kit-suggest.ts`).
- **Heavy packs curated** — `YamahaRM50` / `RolandMC303` profiles use `shuffle.pinN: 0`; do **not** dump all bank files into the Sound sheet.
- **Non-tidal banks** — dirt / uzu / mridangam / VCSL / piano use stable short `drumsBank` strings (`dirt-amen`, `uzu`, `mridangam`, `vcsl`, …) for tags; reshuffle voices them specially (amen chops, tabla, gretsch, etc.).
- Existing 27 kits stay unchanged when expanding; skip D-rank and deferred community crates unless explicitly asked.

## WebMCP + agent skills

Browser agents talk to the live Jam via **WebMCP** (`src/engine/webmcp.ts` → `navigator.modelContext`). Shared actions live in `src/engine/jam-actions.ts` (also used by `useJamShell`) so tools are not UI-only. Cold/reload: `freshStartJam()` (once per page + bfcache `pageshow`) — prefer last `kitId`, then generate+reshuffle from that kit’s shuffle profile; `applyKit` (picker / New Kit / WebMCP) always regenerates (`kit · Name · shuffled`) and keeps `drumsBank` / groove / scale coherent.

**Core (always):** `get_session`, `set_bpm`, `update_track`, `add_track`, `remove_track`, `mute_track`, `solo_track`, `play`, `stop`, `get_reference`, `get_samples`, `get_scales_and_chords`, `evaluate_code`.

**Jam parity:** `get_jam_state`, `get_phase`, `list_kits`, `get_kit`, `apply_kit`, `set_lock_kit` (legacy bank lock; UI omitted), `shuffle_sounds` (skips locked), `set_song_harmony`, `set_octave`, `set_track_lock`, `list_mutations` / `apply_mutate`, `spice` / `spice_tracks`, `set_volume`, `set_active_track`, `list_sound_choices`, `apply_sound_choice`, `set_fx`, `open_code_sheet`, `close_code_sheet`, `stash_ab` / `punch_ab` / `toggle_ab`, `undo_jam`, `search_strudel_docs`, `mic_status` (Rec is user-gesture only). `get_session` includes `songRoot`/`songScale`/`songWalk` and per-track `octave`/`locked`.

**Skill (in-repo):** `resources/skills/jam-liveloop/` — copy/symlink into Cursor skills (see that folder’s `README.md`). Recipe: get_session first; one change/turn; prefer `update_track` quant 1/2; never hush/stop/remove without ask. **PR C** skill + WebMCP cover the full generator surface (song seed / walk / root / scale, kick clock, concert-name chips display-only, new ScaleKinds, seed-aware `add_track`). `get_session` / `get_jam_state` expose `songWalk` (centers + `concertNames`). Kit-suggest ranks notes/motifs from song harmony — no second autocomplete.

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
- Keep liveloop UI tiny (phase ring, one Rec, one A/B chip group).

## License

AGPL-3.0-or-later (Strudel compatibility).
