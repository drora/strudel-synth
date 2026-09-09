# Strudel Studio

**Jam-first** browser music app wrapping [Strudel](https://strudel.cc) (live-coded patterns on Web Audio). One home screen — **Jam** — with kits, deal cards, Sound|FX sheets, and an in-Jam **Code** sheet. Optional **Learn** path teaches Strudel and can apply a challenge into Jam.

**Live:** [GitHub Pages](https://drora.github.io/strudel-synth/) · **Repo:** [drora/strudel-synth](https://github.com/drora/strudel-synth)

## Use it

1. **Jam** — pick a vibe/kit, hit Play, Shuffle / Spice / deal cards.
2. **Tap a track** — Sound|FX sheet (chips write real Strudel code).
3. **Edit in Code** / header **`</> Code`** — CodeMirror sheet for that track (Update / Lock / quantize). Stays in Jam; no mode bounce.
4. **Learn** — challenges with Check / hints; **Apply to Jam** adds a track and opens its Code sheet.

Mobile: Jam is the default landing; touch targets and sheets are thumb-friendly. Desktop uses the same Jam shell.

## Stack

- React 19 + Vite + Tailwind 4 + Zustand
- CodeMirror 6 (Strudel-aware extensions)
- `@strudel/web` (+ core / mini / tonal)
- Static hosting only (no backend) · **AGPL-3.0-or-later**

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
  components/jam/       JamShell, JamCodeSheet, JamTrackSheet, kit/deal UI
  components/editor/    TrackCodePane + CodeMirror guts
  components/learning/  LearnShell + challenges
  components/transport/ PlayButton, sample loading
  components/layout/    AppShell (jam | learn router only)
  engine/               Strudel, playback, kits, missions, mutators, FX helpers
  store/                jam-store, session-store, ui-store
```

Retired: separate Studio app mode / track-picker chrome. Shared guts (editor, `code-effects`, session helpers, playback) remain under Jam or `engine/`.

## Out of scope (for now)

Hydra visuals, MIDI panel chrome, crossfade swap, timeline — not part of the Jam-first product cut.
