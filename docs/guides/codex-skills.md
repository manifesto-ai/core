# Codex Skills Setup

> Install the Manifesto guidance pack explicitly when you want Codex to load Manifesto-specific skills.

---

## Summary

`@manifesto-ai/skills` is a separate developer package. It is not installed by `@manifesto-ai/sdk`, and it does not auto-register itself from `postinstall`.

Codex setup is explicit:

1. Install the package as a dev dependency
2. Run the setup CLI once
3. Restart Codex

---

## Install

### npm

```bash
npm i -D @manifesto-ai/skills
```

### pnpm

```bash
pnpm add -D @manifesto-ai/skills
```

---

## Install The Codex Skill

### npm

```bash
npm exec manifesto-skills install-codex
```

If your npm version does not support `npm exec`, use:

```bash
npx manifesto-skills install-codex
```

### pnpm

```bash
pnpm exec manifesto-skills install-codex
```

This installs the managed `manifesto` skill into:

- `$CODEX_HOME/skills/manifesto`
- or `~/.codex/skills/manifesto` when `CODEX_HOME` is not set

After that, restart Codex.

---

## What The Installer Does

- Copies the packaged Manifesto skill files into the Codex skills directory
- Marks the install as managed by `@manifesto-ai/skills`
- Updates that managed install on rerun
- Refuses to overwrite an existing non-managed `manifesto` skill directory

---

## What It Does Not Do

- It does not run automatically from `postinstall`
- It does not modify `@manifesto-ai/sdk`
- It does not create project-local `.codex` config automatically

---

## Claude Code

If you are using Claude Code instead of Codex, point your local `CLAUDE.md` at the installed package:

```md
See @node_modules/@manifesto-ai/skills/SKILL.md for Manifesto development rules.
```

---

## Troubleshooting

### `manifesto-skills` command not found

Run the command through your package manager from the project root:

```bash
npm exec manifesto-skills install-codex
```

or:

```bash
pnpm exec manifesto-skills install-codex
```

### Existing `manifesto` skill directory blocks install

The installer will not overwrite a non-managed skill at `~/.codex/skills/manifesto`.

If that directory is yours, rename or remove it first, then rerun the install command.
