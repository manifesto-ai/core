---
name: manifesto
description: Use when working on Manifesto repositories, MEL flows, or Core/Host/SDK/World boundaries. Loads implementation-aligned architecture, patch, effect, and package guidance.
---

# Manifesto Skills v0.2.0

You are working on a Manifesto-based project. These rules are non-negotiable.

## Scope Note

This skills pack follows the current implementation in this repo.

- `@manifesto-ai/world` is still the active code target for world/governance/lineage behavior.
- `@manifesto-ai/governance` and `@manifesto-ai/lineage` are currently split-design docs, not code packages to target for implementation work here.
- When docs describe future structure that is not implemented yet, prefer existing package exports and source files.

## Absolute Rules

1. **Core is pure.** No IO, no `Date.now()`, no side effects, no randomness. `compute()` is a pure function.
2. **Snapshot is the only medium.** All communication between computations happens through Snapshot. No hidden channels, no return values from effects.
3. **Three patch ops only.** `set`, `unset`, `merge` (shallow). No other mutation operations exist.
4. **Effects are declarations.** Core declares requirements; Host executes them. Core never performs IO.
5. **Errors are values.** Errors live in Snapshot state, never thrown. Core must not throw for business logic.
6. **Flows terminate.** No unbounded loops in Flow. Host controls iteration. All guards required for re-entry safety.
7. **`$` is reserved.** `$host`, `$mel`, `$system` are platform namespaces. Never use `$` in domain identifiers.

## Normative Hierarchy

SPEC > FDR > ADR > Code > README. Never invent semantics not in SPEC.

## Task-Specific Knowledge

Load these before writing code in each area:

| Task | Knowledge File |
|------|---------------|
| Understanding Core/Host/SDK/World boundaries | `@knowledge/architecture.md` |
| Writing MEL domain code | `@knowledge/mel-patterns.md` |
| MEL complete function reference | `@knowledge/mel-reference.md` |
| Implementing effect handlers | `@knowledge/effect-patterns.md` |
| Working with state/patches | `@knowledge/patch-rules.md` |
| Reviewing or debugging | `@knowledge/antipatterns.md` |
| Looking up current specs and design docs | `@knowledge/spec-index.md` |

## Package API Reference

Load when working with a specific package API:

| Package | Knowledge File |
|---------|---------------|
| @manifesto-ai/sdk | `@knowledge/packages/sdk.md` |
| @manifesto-ai/core | `@knowledge/packages/core.md` |
| @manifesto-ai/host | `@knowledge/packages/host.md` |
| @manifesto-ai/world | `@knowledge/packages/world.md` |
| @manifesto-ai/compiler | `@knowledge/packages/compiler.md` |
| @manifesto-ai/codegen | `@knowledge/packages/codegen.md` |

## Self-Check

Before submitting any code change, verify:

- [ ] Determinism preserved? (same input -> same output)
- [ ] Snapshot is sole communication medium?
- [ ] All mutations via patches?
- [ ] No forbidden imports across package boundaries?
- [ ] Flow guards present for re-entry safety?
