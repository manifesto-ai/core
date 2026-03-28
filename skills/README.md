# @manifesto-ai/skills

LLM knowledge pack for Manifesto.

## Codex setup

With npm:

```bash
npm i -D @manifesto-ai/skills
npm exec manifesto-skills install-codex
```

With pnpm:

```bash
pnpm add -D @manifesto-ai/skills
pnpm exec manifesto-skills install-codex
```

This installs the managed `manifesto` skill into `$CODEX_HOME/skills/manifesto` or `~/.codex/skills/manifesto`.
The setup is explicit so package-manager `postinstall` approval policies do not block installation.

If package-manager exec is unavailable, run:

```bash
node ./node_modules/@manifesto-ai/skills/scripts/manifesto-skills.mjs install-codex
```

After installation, restart Codex.

## Claude Code setup

Add this to your `CLAUDE.md`:

```md
See @node_modules/@manifesto-ai/skills/SKILL.md for Manifesto development rules.
```

## Notes

- This package does not auto-install Codex files from `postinstall`.
- The installer refuses to overwrite an existing non-managed `manifesto` skill directory.
