# Strudel Studio

**Jam-first** browser music app wrapping [Strudel](https://strudel.cc) (live-coded patterns on Web Audio). One home screen — **Jam** — with kits, deal cards, Sound|FX sheets, an in-Jam **Code** sheet, and **liveloop** controls (cycle phase, mic Rec, A/B). Optional **Learn** path teaches Strudel and can apply a challenge into Jam.

**Live:** [GitHub Pages](https://drora.github.io/strudel-synth/) · **Repo:** [drora/strudel-synth](https://github.com/drora/strudel-synth)

## Use it

1. **Jam** — choosing a kit (or cold reload) always reshuffles patterns (`kit · name · reshuffled`; drum bank stays when lockKit); bfcache restore re-runs fresh start; open the kit browser (search / soft tags), Play, Shuffle / Spice / deals.
2. **Tap a track** — Sound|FX sheet (chips write real Strudel code; sheet stays open while browsing). **M** on the chip mutes. **+ Track** adds a role with preset code without switching kits.
3. **Edit in Code** / header **`</> Code`** — CodeMirror sheet for that track (Update / Lock / quantize). Stays in Jam; no mode bounce.
4. **Liveloop** — BPM ring + per-track phase ticks while playing; **Rec** (red) records mic → sample → track; Stop is neutral (not Rec-red); **A/B** near Kit stashes and punches arrangement variants.
5. **Learn** — challenges with Check / hints; **Apply to Jam** adds a track and opens its Code sheet.

Mobile: Jam is the default landing; touch targets and sheets are thumb-friendly. Desktop uses the same Jam shell.


## Kits

About **71** kits in the Jam catalog (**27** originals + **44** Rank A/B/usable-C cherry-picks across classic drum machines, dirt breaks, uzu, mridangam, VCSL, piano).

- **Kit browser** — soft tags (tempo / bank / vibe) + search; bank short labels from `BANK_SHORT` in `kit-browser.ts`.
- **Collision-safe names** — display names include model (LM-2, CR-1000, …); unique ids.
- Ranking notes: `docs/kit-candidates-ranked.md`.
- Data: `engine/kits-data-{a..f}.ts` → `kits.ts` (`SOUND_CHOICES` for featured banks).

## Stack

React 18 · Vite · TypeScript · Zustand · CodeMirror 6 · Strudel (`@strudel/web`, `@strudel/desktop-bridge`) · optional WebMCP for agent control.

## WebMCP

With a WebMCP-capable browser, agents can drive Jam (kits, A/B, FX, deals, phase, docs search) through tools registered in `src/engine/webmcp.ts`. Shared logic: `src/engine/jam-actions.ts`.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Repo map

```
src/
  App.tsx               Jam-first shell
  components/jam/       JamShell, JamTrackChip, JamCodeSheet, JamTrackSheet, kit/deal UI,
                        JamPhaseRing, JamMicRec, JamABToggle
  components/editor/    CodeMirror (used by Code sheet)
  components/learning/  LearnShell + challenges
  components/transport/ TransportBar
  engine/               Strudel, playback, kits (a–f data + kit-browser), missions, mutators,
                        reshuffle, mic-sample, webmcp, …
  store/                session-store, jam-store, ui-store, …
resources/skills/       Agent skills (jam-liveloop)
docs/                   Kit ranking and notes
```

MIT-ish / see repo for license details. Strudel is separate upstream.
