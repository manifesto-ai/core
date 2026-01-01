# Contributing to Manifesto

Thank you for your interest in contributing to Manifesto!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/manifesto-ai/core.git
cd core

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for automatic changelog generation.

### Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Changelog |
|------|-------------|-----------|
| `feat` | A new feature | Features |
| `fix` | A bug fix | Bug Fixes |
| `perf` | Performance improvement | Performance |
| `docs` | Documentation only | Hidden |
| `style` | Code style (formatting, etc.) | Hidden |
| `refactor` | Code refactoring | Hidden |
| `test` | Adding tests | Hidden |
| `chore` | Maintenance tasks | Hidden |
| `ci` | CI/CD changes | Hidden |
| `build` | Build system changes | Hidden |

### Scopes

Use the package name as scope:

- `core` - @manifesto-ai/core
- `host` - @manifesto-ai/host
- `world` - @manifesto-ai/world
- `bridge` - @manifesto-ai/bridge
- `builder` - @manifesto-ai/builder
- `react` - @manifesto-ai/react
- `compiler` - @manifesto-ai/compiler

### Examples

```bash
# Feature
feat(core): add explain() method for debugging

# Bug fix
fix(host): handle effect handler timeout properly

# Breaking change (add ! after type)
feat(builder)!: change defineDomain API signature

BREAKING CHANGE: The second parameter is now required.

# Multiple scopes
feat(core,host): add shared utility functions
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit with conventional commit message
6. Push to your fork
7. Open a Pull Request

## Release Process

Releases are automated using [Release Please](https://github.com/googleapis/release-please):

1. Merge PRs to `main` with conventional commits
2. Release Please creates a Release PR automatically
3. Review and merge the Release PR
4. GitHub Release is created automatically
5. Packages are published to npm

## Code Style & Architecture

### Style Requirements

- TypeScript strict mode
- Use `readonly` for immutable properties
- Prefer `const` over `let`
- Use explicit return types for public APIs
- Follow naming conventions from CLAUDE.md Section 7.3

### Package Boundaries

Respect the layered architecture:

- **Core** (pure computation) → MUST NOT import Host, World, Bridge, React
- **Host** (execution) → MUST NOT import World governance or React
- **World** (governance) → MUST NOT import Host or Core internals
- **Bridge** (binding) → MUST NOT import Core/Host/World internals
- **Builder** (DSL) → MUST NOT import Host, World, or compute/apply
- **React** (UI) → MUST NOT import Core/Host/World internals

See [CLAUDE.md Section 3](./CLAUDE.md#3-package-boundary-rules) for complete details.

---

## Constitutional Requirements

All code contributions MUST comply with the Manifesto Constitution (`CLAUDE.md`).

### Core Principles

1. **Determinism** — Same input MUST produce same output, always
2. **Snapshot as Sole Medium** — All state communication through Snapshot only
3. **Separation of Concerns** — Core computes, Host executes, World governs
4. **Immutability** — Snapshots and Worlds MUST NOT mutate after creation
5. **Type Safety** — Zero string paths in user-facing APIs

### State Mutation Rules

- State changes ONLY through patches (`set`, `unset`, `merge`)
- ALL mutations go through `apply(schema, snapshot, patches)`
- Snapshots are immutable; `apply()` returns a new Snapshot

### Effect Handling

- Effect handlers MUST return `Patch[]`, never throw
- Failures MUST be expressed as patches (values in Snapshot)
- Effects MUST be re-entry safe (use state guards)

---

## Anti-Patterns

Avoid these common violations (see [CLAUDE.md Section 10](./CLAUDE.md#10-anti-patterns-explicit-examples)):

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| Direct state mutation (`snapshot.data.x = 5`) | Violates immutability | Use `apply()` with patches |
| String paths in Builder API | No type safety | Use `FieldRef` (e.g., `state.todos[0].title`) |
| Re-entry unsafe Flows | Executes multiple times | Use state guards (`onceNull`, `onceTrue`) |
| Returning values from effects | Violates Snapshot-only rule | Write to Snapshot via patches |
| Throwing errors in Core | Core is pure | Return error values in Snapshot |

---

## Pre-Submission Checklist

Before opening a PR, verify:

### Constitutional Compliance

- [ ] Does this change preserve determinism? (Same input → same output)
- [ ] Does this change maintain Snapshot as sole communication medium?
- [ ] Are all state changes expressed as Patches?
- [ ] Are all errors expressed as values, not exceptions?

### Package Boundaries

- [ ] Does this code import only from allowed packages?
- [ ] Is this code in the correct package for its responsibility?

### Code Quality

- [ ] All tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] No `any` in public APIs
- [ ] No `@ts-ignore` without justification
- [ ] Follows naming conventions (CLAUDE.md Section 7.3)

### Documentation

- [ ] Public APIs have TSDoc comments
- [ ] Breaking changes noted in commit message
- [ ] SPEC documents updated if behavior changes

---

## Questions?

- Open a [Discussion](https://github.com/manifesto-ai/core/discussions)
- Check the [Documentation](./docs/)
- Review [CLAUDE.md](./CLAUDE.md) for constitutional constraints
