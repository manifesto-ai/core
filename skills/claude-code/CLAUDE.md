# Manifesto Development Rules

This project uses the Manifesto framework. Read the rules below before writing any code.

## Entry Point

See @../SKILL.md for absolute rules and task-specific knowledge routing.

## Knowledge Files

Load the relevant file BEFORE writing code:

- Architecture & boundaries: @../knowledge/architecture.md
- Writing MEL code: @../knowledge/mel-patterns.md
- Effect handler implementation: @../knowledge/effect-patterns.md
- State mutations & patches: @../knowledge/patch-rules.md
- Common mistakes to avoid: @../knowledge/antipatterns.md
- SPEC document references: @../knowledge/spec-index.md

## Quick Rules

1. Core is pure — no IO, no side effects
2. Snapshot is the only communication medium
3. Only `set`, `unset`, `merge` patches exist
4. Effects are declarations, not executions
5. Errors are values in state, never thrown
6. All Flow patches/effects must be guarded (when/once/onceIntent)
7. `$` prefix is reserved for platform namespaces
