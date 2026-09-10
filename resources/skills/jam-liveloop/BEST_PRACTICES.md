# Jam liveloop — best practices

## Mini-notation tips

- One cycle ≈ 4 beats at Jam BPM (`cps = bpm/60/4`).
- Rests: `~`. Subdivide: `bd [hh hh] sd hh`. Stack: `bd*4, hh*8`.
- Euclidean: `bd(3,8)`. Alternate: `<bd sd>`. Slow a voice: `hh*8/2` or `.slow(2)` on the chain.
- Prefer editing **one** mini-string region per turn so the user can hear the diff.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Bare `setcps` / hush whole session | Use `set_bpm` / never stop unless asked |
| Wrong drum bank vs kit | Read kit `drumsBank`; keep `.bank("…")` aligned |
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
big groove rewrite / kit-like    → "2" (or apply_kit)
mute / solo / volume / remove    → immediate (tools do this)
stopped                          → store update only (no queue)
```

## Kit collision naming

- Kits have unique `id`s and display names with **model** (LM-2, CR-1000, DR-550, SK-1…).
- Never invent bare names like “Linn” / “Casio” / “DR” when listing or applying — use `list_kits` ids.
- Soft tags: `tempo:slow|mid|fast`, `bank:909`, `vibe:techno`.
- `lockKit: true` → shuffle keeps bank; `false` → free reshuffle.

## Deal mutations as suggestions

- Phrase: “Deal suggests *Busy kick* on drums — apply?”
- After apply, deals redeal automatically; call `list_deals` again if offering another.
- `undo_jam` reverts last mutation/mission/sound/FX.

## Sound + FX

- `list_sound_choices` respects track role (`SOUND_CHOICES`).
- FX keys mirror Jam chips + code-effects: `lpf`, `hpf`, `room`, `delay`, `gain`, plus `roomsize`, `delaytime`, `delayfeedback`, etc.
- Patterned `.lpf(sine.range(…))` cannot be set via `set_fx` — use Code.

## Session hygiene

- Start: `get_session` → note `kitId`, banks, muted tracks, A/B.
- End of idea: offer `stash_ab` so the user can flip back.
- Document what you changed in one short line (track name + intent).
