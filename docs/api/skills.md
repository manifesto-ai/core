# @manifesto-ai/skills

> Explicit AI coding tool installers for Manifesto-specific guidance.

## Overview

`@manifesto-ai/skills` packages the current public Manifesto seams for agent use.

The installed guidance is aligned to:

- base runtime via `@manifesto-ai/sdk`
- continuity via `@manifesto-ai/lineage`
- legitimacy via `@manifesto-ai/governance`
- terminal inspection via `@manifesto-ai/studio-cli`
- projection-first analysis via `@manifesto-ai/studio-core`

Use this package when you want Codex or another AI coding tool to reason from the current Manifesto surface instead of stale local conventions.

## Install

```bash
npm install -D @manifesto-ai/skills
```

Run installers with your package-manager exec:

```bash
npx manifesto-skills install-codex
npx manifesto-skills install-claude
npx manifesto-skills install-cursor
npx manifesto-skills install-copilot
npx manifesto-skills install-windsurf
npx manifesto-skills install-all
```

Check the current state:

```bash
npx manifesto-skills status
```

## Installer Targets

| Command | Target | Strategy |
|---------|--------|----------|
| `install-codex` | `~/.codex/skills/manifesto/` | Copies the skill and knowledge files |
| `install-claude` | `CLAUDE.md` | Appends an `@` reference to the packaged `SKILL.md` |
| `install-cursor` | `.cursor/rules/manifesto.mdc` | Writes inlined rules and knowledge references |
| `install-copilot` | `.github/copilot-instructions.md` | Appends inlined guidance and knowledge paths |
| `install-windsurf` | `.windsurfrules` | Appends inlined guidance and knowledge paths |

Project-level installers use a managed-block strategy so only the Manifesto-owned section is updated.

## Removal

```bash
npx manifesto-skills uninstall-claude
npx manifesto-skills uninstall-all
```

## Operational Notes

- Setup is explicit. This package does not auto-install from `postinstall`.
- Re-running an installer is expected when the package updates.
- The installer refuses to overwrite existing non-managed files or directories.
- Project-level installs reference `node_modules/` knowledge files instead of duplicating them.

## Where It Fits

- Use [`@manifesto-ai/cli`](./cli) when you want repo configuration and installation flow around the skills package.
- Use this package directly when the only missing piece is AI tool guidance.
- Pair it with [`@manifesto-ai/studio-mcp`](./studio-mcp) when the agent also needs live read-only inspection tools.

## Related Docs

- [Developer Tooling Guide](/guides/developer-tooling)
- [AI Agents](/integration/ai-agents)
- [@manifesto-ai/studio-mcp](./studio-mcp)
