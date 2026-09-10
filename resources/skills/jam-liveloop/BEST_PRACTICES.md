# Jam liveloop — best practices

## Mini-notation tips

- One cycle ≈ 4 beats at Jam BPM (`cps = bpm/60/4`).
- Rests: `~`. Subdivide: `bd [hh hh] sd hh`. Stack: `bd*4, hh*8`.
- Euclidean: `bd(3,8)`. Alternate: `<bd sd>`. Slow a voice: `hh*8/2` or `.slow(2)` on the chain.
- Prefer editing **one** mini-string region per turn so the user can hear the diff.

## Shuffle profiles

Kits are **identity + shuffle profile**, not frozen recipes. Profile fields: `groove`, `density`, optional `root` / `scale` / `melodicSounds` / `fxBias` / `pinN`.

- `apply_kit` and `shuffle_sounds` regenerate lines in that profile (same bank / groove / scale family).
- Hand `update_track` edits must stay coherent with `get_kit` (read jam state first).
- Prefer shuffle / re-apply for variety over pasting a "classic" pattern as THE kit.
- Deals are secondary spice — profile-coherent tweaks come first.

## Familiar → kit

1. `list_kits` (search/tags/vibe/tempo) → `get_kit` — match vibe, `drumsBank`, shuffle groove/density/scale/root, name/description.
2. Starting points: punchy four-on-floor → techno + `four_on_floor` + 909/808; dusty boom-bap → lofi + breakbeat/halftime; airy pads → ambient + sparse; classic house → house + `four_on_floor`.
3. `apply_kit`, then `shuffle_sounds` or soft in-profile `update_track` if close — never invent frozen recipes.
4. Trust `get_kit` / list `shuffle` metadata over memory mini-notation.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Bare `setcps` / hush whole session | Use `set_bpm` / never stop unless asked |
| Wrong drum bank vs kit | Read kit `drumsBank`; keep `.bank("…")` aligned |
| Pasting a frozen "classic" kit recipe | Use `apply_kit` / `shuffle_sounds`; edit in-profile only |
| Dumping RM50/MC303 all `n` variants | Use curated `n(0)` / Sound choices |
| Rewriting every track at once | One `update_track` per turn |
| `evaluate_code` replacing compose | Prefer `update_track` so mute/solo/volume still apply |
| Ignoring quantization | Default `"1"`; structural → `"2"` |
| Removing tracks to “clean up” | Ask first; mute instead |
| Faking mic Rec | Report `mic_status`; user taps Rec |

## Phone Jam constraints

- Thumb UI: kit picker, chips, Sound|FX sheet, Code sheet, deal strip, A/B near Kit.
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
- `lockKit: true` → shuffle keeps bank **and** profile groove family; `false` → free reshuffle across kits.

## Deal mutations as suggestions

- Phrase: “Deal suggests *Busy kick* on drums — apply?”
- After apply, deals redeal automatically; call `list_deals` again if offering another.
- `undo_jam` reverts last mutation/mission/sound/FX.
- Prefer profile-coherent kit/track tweaks before stacking deals.

## Sound + FX

- `list_sound_choices` respects track role (`SOUND_CHOICES`).
- FX keys mirror Jam chips + code-effects: `lpf`, `hpf`, `room`, `delay`, `gain`, plus `roomsize`, `delaytime`, `delayfeedback`, etc.
- Patterned `.lpf(sine.range(…))` cannot be set via `set_fx` — use Code.
- Autocomplete biases to the active kit profile — don't suggest off-kit banks.

## Session hygiene

- Start: `get_session` → note `kitId`, banks, muted tracks, A/B.
- End of idea: offer `stash_ab` so the user can flip back.
- Document what you changed in one short line (track name + intent).
