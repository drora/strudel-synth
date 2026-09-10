# Strudel Studio

**Jam-first** browser music app wrapping [Strudel](https://strudel.cc) (live-coded patterns on Web Audio). One home screen — **Jam** — with kits, Sound|FX sheets, an in-Jam **Code** sheet, and **liveloop** controls (cycle phase, mic Rec, A/B). Optional **Learn** path teaches Strudel and can apply a challenge into Jam.

**Live:** [GitHub Pages](https://drora.github.io/strudel-synth/) · **Repo:** [drora/strudel-synth](https://github.com/drora/strudel-synth)

## Use it

1. **Jam** — choosing a kit (or cold reload) always regenerates from that kit’s **shuffle profile** (`kit · name · shuffled`; same bank / groove / scale family, fresh lines); bfcache restore re-runs fresh start; open the kit browser (search / soft tags), Play, Shuffle / New kit.
2. **Tap a track** — Sound|FX sheet (chips write real Strudel code; sheet stays open while browsing). **M** on the chip mutes. **+ Track** adds a role with preset code without switching kits.
3. **Edit in Code** / header **`\u003c/>` Code** — CodeMirror sheet for that track (Update / Lock / quantize). Completions soft-bias to the active kit shuffle profile (in-scale notes with scale detail; already-used pitches demoted in `note()`, kit bank/hits, melodicSounds). Stays in Jam; no mode bounce.
4. **Liveloop** — BPM ring + per-track phase ticks while playing; **Rec** (red) records mic → sample → track; Stop is neutral (not Rec-red); **A/B** near Kit stashes and punches arrangement variants.
5. **Learn** — challenges with Check / hints; **Apply to Jam** adds a track and opens its Code sheet.

Mobile: Jam is the default landing; touch targets and sheets are thumb-friendly. Desktop uses the same Jam shell.


## Kits

About **71** kits in the Jam catalog (**27** originals + **44** Rank A/B/usable-C cherry-picks across classic drum machines, dirt breaks, uzu, mridangam, VCSL, piano).

Kits are **shuffle profiles**, not baked Strudel recipes: layout (track name + role) + `shuffle` (`groove` / `density` / scale hints). Apply, reload, and Shuffle always regenerate in-pattern music via `reshuffle.ts`. Code autocomplete reuses the same profile for ranked neighbor suggestions (not whole-track regen).

- **Kit browser** — soft tags (tempo / bank / vibe) + search; bank short labels from `BANK_SHORT` in `kit-browser.ts`.
- **Naming** — collision-safe ids and display names (model in the title: LM-2 Pocket, CR-1000 Disco, MC-303 Groove, …).
- **Curated heavies** — RM-50 / MC-303 profiles pin `n(0)` — not every sample in the UI.
- Data: `engine/kits-data-{a..f}.ts` → `kits.ts` (`SOUND_CHOICES` for featured banks).

## Stack

- React 19 + Vite + Tailwind 4 + Zustand
- CodeMirror 6 (Strudel-aware extensions)
- `@strudel/web` (+ core / mini / tonal)
- Static hosting only (no backend) · **AGPL-3.0-or-later**


## WebMCP + liveloop skill

With a WebMCP-capable browser, agents can drive Jam (kits, A/B, FX, phase, docs search) through tools registered in `src/engine/webmcp.ts`. Shared logic: `src/engine/jam-actions.ts`.

**Agent skill:** [`resources/skills/jam-liveloop/`](./resources/skills/jam-liveloop/) — install notes in that folder’s README (`SKILL.md` + best practices). Point Cursor at it via copy/symlink into `~/.cursor/skills` or `.cursor/skills`.

## Develop

```bash
npm install
npm run dev
npm run build   # required before merge
```

See **[AGENTS.md](./AGENTS.md)** for architecture map, ship rules, and don’ts (for humans and coding agents).

## Layout (after Jam-first)

```
src/
  components/jam/       JamShell, JamTrackChip, JamCodeSheet, JamTrackSheet, kit UI,
                        JamPhaseRing, JamMicRec, JamABToggle
  components/editor/    TrackCodePane + CodeMirror guts
  components/learning/  LearnShell + challenges
  components/transport/ PlayButton, sample loading
  components/layout/    AppShell (jam | learn router only)
  engine/               Strudel, playback, kits (a–f data + kit-browser),
                        FX helpers, jam-actions, webmcp, mic-sample (Rec → samples)
  hooks/                useLoopPhase, mobile / visual viewport
  store/                jam-store (incl. A/B), session-store, ui-store
```

Retired: separate Studio app mode / track-picker chrome. Shared guts (editor, `code-effects`, session helpers, playback) remain under Jam or `engine/`.

## Out of scope (for now)

Hydra visuals, MIDI panel chrome, clip rack, timeline rewrite — not part of the Jam-first / liveloop cut.
