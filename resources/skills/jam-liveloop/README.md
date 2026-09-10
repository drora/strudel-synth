# jam-liveloop skill

In-repo Cursor skill for living-loop partnership with **Strudel Studio Jam** via WebMCP.

Kits are **identity + shuffle profile** (not frozen recipes). See `SKILL.md` / `BEST_PRACTICES.md` for profile-aware partnering and Familiar → kit picking.

## Install into Cursor

Copy or symlink this folder into your personal or project skills directory:

```bash
# Project (this repo) — already at:
#   resources/skills/jam-liveloop/

# User skills (Cursor):
mkdir -p ~/.cursor/skills
ln -s "$(pwd)/resources/skills/jam-liveloop" ~/.cursor/skills/jam-liveloop
# or:
cp -R resources/skills/jam-liveloop ~/.cursor/skills/jam-liveloop
```

Some Cursor builds also pick up skills from `.cursor/skills/` in the project:

```bash
mkdir -p .cursor/skills
ln -s ../../resources/skills/jam-liveloop .cursor/skills/jam-liveloop
```

Then enable / select the **jam-liveloop** skill in Cursor Agent settings (or `@` the skill).

## Requires

- Jam app open in a WebMCP-capable browser (`navigator.modelContext`).
- Tools registered by `src/engine/webmcp.ts` (play the app once so registration runs).

## Files

| File | Role |
|------|------|
| `SKILL.md` | Frontmatter + liveloop partner guide (profiles, Familiar → kit) |
| `BEST_PRACTICES.md` | Mini-notation, shuffle profiles, phone constraints, quant |
| `README.md` | This install note |

## Related

- Repo `AGENTS.md` — architecture + ship rules
- `src/engine/webmcp.ts` — tool surface
- `src/engine/jam-actions.ts` — shared Jam actions (UI + WebMCP)
