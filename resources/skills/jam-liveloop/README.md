# jam-liveloop skill

This folder is the **in-Jam WebMCP liveloop partner** skill — not a GitHub Copilot / repo-coding skill. It teaches an agent how to partner in a live browser Jam session (one musical change per turn, kit shuffle-profile only). See `SKILL.md` and `BEST_PRACTICES.md`.

## Install

Copy or symlink into Cursor skills:

```bash
mkdir -p ~/.cursor/skills
ln -s "$(pwd)/resources/skills/jam-liveloop" ~/.cursor/skills/jam-liveloop
```

Requires the Jam app open in a WebMCP-capable browser (`navigator.modelContext`).
