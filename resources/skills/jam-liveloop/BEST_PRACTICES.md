# Jam liveloop — best practices

Kit **shuffle profile** knowledge only — never song titles or cover charts.
Partner how-to (room, levers, Strudel lookups, hard rules): see [SKILL.md](./SKILL.md).

## Before you write code

Call **`search_strudel_docs`** / **`get_reference`** first — don’t invent API. Official pages (same list as SKILL.md §3):

- Mini-notation https://strudel.cc/learn/mini-notation/
- Samples / banks https://strudel.cc/learn/samples/
- Effects https://strudel.cc/learn/effects/
- First effects https://strudel.cc/workshop/first-effects/
- Synths / notes https://strudel.cc/learn/synths/
- Code syntax https://strudel.cc/learn/code/
- Signals https://strudel.cc/learn/signals/
- Time / structure https://strudel.cc/learn/time-spans/
- Tempo (prefer `set_bpm`, not `setcps`) https://strudel.cc/learn/factories/

Also: `get_samples` (match kit `drumsBank`), `get_scales_and_chords`. Double quotes = mini-notation; single quotes = plain strings.

## Mini-notation tips

- One cycle ≈ 4 beats at Jam BPM (`cps = bpm/60/4`).
- Rests: `~`. Subdivide: `bd [hh hh] sd hh`. Stack: `bd*4, hh*8`.
- Euclidean: `bd(3,8)`. Alternate: `<bd sd>`. Slow a voice: `hh*8/2` or `.slow(2)` on the chain.
- Prefer editing **one** mini-string region per turn so the user can hear the diff.

## Shuffle profiles + song seed

Kits are **identity + shuffle profile**, not frozen recipes. Profile fields: `groove`, `density`, optional `root` / `scale` / `melodicSounds` / `fxBias` / `pinN`.

- `apply_kit` and `shuffle_sounds` regenerate lines in that profile (same bank / groove / scale family). Melodic lanes follow a shared **song-seed** chord walk (Song Shuffle = new seed; track Shuffle keeps seed; Sound still pins).
- `get_session` exposes `songRoot` / `songScale` / `songWalk` (centers + `walkLength` + `concertNames`). Walk chips highlight current; `set_walk_length` sets 1–4; dice also rolls length.
- Scales: minor, major, dorian, pentatonic, mixolydian, phrygian, lydian, harmonic_minor (`set_song_harmony`).
- `add_track` without code is **seed-aware**.
- Hand `update_track` edits must stay coherent with `get_kit` (read jam state first).
- Prefer shuffle / re-apply for variety over pasting a "classic" pattern as THE kit.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Bare `setcps` / hush whole session | Use `set_bpm` / never stop unless asked |
| Wrong drum bank vs kit | Read kit `drumsBank`; keep `.bank("…")` aligned |
| Pasting a frozen "classic" kit / song recipe | Use `apply_kit` / `shuffle_sounds`; edit in-profile only |
| Dumping RM50/MC303 all `n` variants | Use curated `n(0)` / Sound choices |
| Rewriting every track at once | One `update_track` per turn |
| `evaluate_code` replacing compose | Prefer `update_track` so mute/solo/volume still apply |
| Ignoring quantization | Default `"1"`; structural → `"2"` |
| Removing tracks to “clean up” | Ask first; mute instead |
| Faking mic Rec | Report `mic_status`; user taps Rec |
| Faking Import / Export / Take | Header taps only — no tools; Take ≠ Rec; do not `set_song_harmony` to “restore” |
| Editing walk chips as targets | Highlight-only — use `set_song_harmony` / `set_walk_length` |
| Inventing Strudel API | `get_reference` / `search_strudel_docs` first (see URLs above) |

## Phone Jam constraints

- Thumb UI: kit picker, chips, Sound|FX sheet, Code sheet, A/B near Kit.
- Sheets stay open while browsing sounds — do not spam `close_code_sheet`.
- Sample prebake may briefly block; wait for playable state via `get_session`.
- Touch latency: favor cycle quant over `immediate` for musical edits.

## Quantization guide

```
playing + melodic/rhythmic edit  → quantization "1"
big groove rewrite / kit-like    → "2" (or apply_kit / shuffle_sounds)
mute / solo / volume / remove    → immediate (tools do this)
stopped                          → store update only (no audio)
```

## Kit collision naming

- Kits have unique `id`s and display names with **model** (LM-2, CR-1000, DR-550, SK-1…).
- Never invent bare names like “Linn” / “Casio” / “DR” when listing or applying — use `list_kits` ids.
- Soft tags: `tempo:slow|mid|fast`, `bank:909`, `vibe:techno`.
- Prefer per-track **Lock** (`set_track_lock`) for pinning lanes.

## Spice / Mutate / Intensity

See SKILL.md §2 — one lever per turn. Spice = FX nudge; Mutate = pattern transform; Intensity = up/down only (never hand-write L2–L4).

## Undo

- `undo_jam` reverts last sound/FX (or historical) change from the Jam undo stack.

## Sound + FX

- `list_sound_choices` respects track role (`SOUND_CHOICES`).
- FX keys mirror Jam chips + code-effects: `lpf`, `hpf`, `room`, `delay`, `gain`, plus `roomsize`, `delaytime`, `delayfeedback`, etc.
- Patterned `.lpf(sine.range(…))` cannot be set via `set_fx` — use Code / `update_track`.

## Session hygiene

- Start: `get_session` → note `kitId`, `songRoot`/`songScale`/`songWalk`, banks, muted tracks, A/B.
- End of idea: offer `stash_ab` so the user can flip back.
- Document what you changed in one short line (track name + intent).
