# Jam liveloop — best practices

Kit **shuffle profile** knowledge only — never song titles or cover charts.

## Mini-notation tips

- One cycle ≈ 4 beats at Jam BPM (`cps = bpm/60/4`).
- Rests: `~`. Subdivide: `bd [hh hh] sd hh`. Stack: `bd*4, hh*8`.
- Euclidean: `bd(3,8)`. Alternate: `<bd sd>`. Slow a voice: `hh*8/2` or `.slow(2)` on the chain.
- Prefer editing **one** mini-string region per turn so the user can hear the diff.

## Shuffle profiles + song seed

Kits are **identity + shuffle profile**, not frozen recipes. Profile fields: `groove`, `density`, optional `root` / `scale` / `melodicSounds` / `fxBias` / `pinN`.

- `apply_kit` and `shuffle_sounds` regenerate lines in that profile (same bank / groove / scale family). Melodic lanes follow a shared **song-seed** chord walk (Song Shuffle = new seed; track Shuffle keeps seed; Sound still pins).
- `get_session` / `get_jam_state` expose `songRoot` / `songScale` / `songWalk` (centers + `concertNames`). Walk chips are **display-only**.
- Scales: minor, major, dorian, pentatonic, mixolydian, phrygian, lydian, harmonic_minor (`set_song_harmony`).
- `add_track` without code is **seed-aware** (same as Jam + Track).
- Hand `update_track` edits must stay coherent with `get_kit` (read jam state first).
- Prefer shuffle / re-apply for variety over pasting a "classic" pattern as THE kit.

## Shuffle vs Spice vs Mutate vs Lock

| | Shuffle | Spice | Mutate | Lock |
|-|---------|-------|--------|------|
| Intent | Fresh pattern in profile | FX/timbre nudge | Deterministic pattern transform | Pin lane |
| Tool | `shuffle_sounds` / `apply_kit` | `spice` / `spice_tracks` | `apply_mutate` | `set_track_lock` |
| Keeps tune shape? | No (new lines) | Yes | Partially | Yes (skips lane) |

Never stack all four in one turn. Peek labels: `Shuffle · …` / `Spice · room` / Mutate sheet.

## Familiar → kit

1. `list_kits` (search/tags/vibe/tempo) → `get_kit` — match vibe, `drumsBank`, shuffle groove/density/scale/root, name/description.
2. Starting points: punchy four-on-floor → techno + `four_on_floor` + 909/808; dusty boom-bap → lofi + breakbeat/halftime; airy pads → ambient + sparse; classic house → house + `four_on_floor`.
3. `apply_kit`, then `shuffle_sounds` or soft in-profile `update_track` if close — never invent frozen recipes or cover recreations.
4. Trust `get_kit` / list `shuffle` metadata over memory mini-notation. Recipe of profiles — not a dump of every kit.

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
| Editing walk chips as targets | Display-only concert names — use `set_song_harmony` for key/scale |

## Phone Jam constraints

- Thumb UI: kit picker, chips, Sound|FX sheet, Code sheet, A/B near Kit.
- Sheets stay open while browsing sounds — agents should not spam `close_code_sheet`.
- Sample prebake may briefly block; wait for playable state via `get_session`.
- Touch latency: favor cycle quant over `immediate` for musical edits.

## Quantization guide

```
playing + melodic/rhythmic edit  → quantization "1"
big groove rewrite / kit-like    → "2" (or apply_kit / shuffle_sounds)
mute / solo / volume / remove    → immediate (tools do this)
stopped                          → store update only (no queue)
```

## Kit collision naming

- Kits have unique `id`s and display names with **model** (LM-2, CR-1000, DR-550, SK-1…).
- Never invent bare names like “Linn” / “Casio” / “DR” when listing or applying — use `list_kits` ids.
- Soft tags: `tempo:slow|mid|fast`, `bank:909`, `vibe:techno`.
- `lockKit: true` → shuffle keeps bank **and** profile groove family; `false` → free reshuffle across kits. Prefer per-track **Lock** for pinning lanes.

## Spice

- UI **Spice** = one FX/timbre nudge on existing code (`engine/spice.ts` via `setEffectInCode`).
- **Spice ≠ Shuffle** — same tune; **never** pattern rewrite, denser/sparser groove, bank swap, or `shuffle_sounds`.
- Peek: `Spice · room` / `Spice · darker`. Undo via `undo_jam`.
- Mission deal cards are **removed**. **Mutate** is a pattern-transform sheet (not Shuffle/Spice).

## Undo

- `undo_jam` reverts last sound/FX (or historical) change from the Jam undo stack.

## Sound + FX

- `list_sound_choices` respects track role (`SOUND_CHOICES`).
- FX keys mirror Jam chips + code-effects: `lpf`, `hpf`, `room`, `delay`, `gain`, plus `roomsize`, `delaytime`, `delayfeedback`, etc.
- Patterned `.lpf(sine.range(…))` cannot be set via `set_fx` — use Code.
- Autocomplete biases to the active kit profile + song root/scale — don't suggest off-kit banks.

## Session hygiene

- Start: `get_session` → note `kitId`, `songRoot`/`songScale`/`songWalk`, banks, muted tracks, A/B.
- End of idea: offer `stash_ab` so the user can flip back.
- Document what you changed in one short line (track name + intent).
