# How-to Guides

> Task-oriented guides for solving specific problems with Manifesto.

::: tip Looking for tutorials?
If you're new to Manifesto, start with the **[Tutorial](/tutorial/)** which walks you through building an app step by step.

Guides assume you already understand the basics.
:::

---

## Tutorials vs Guides

| | Tutorials | Guides |
|---|-----------|--------|
| **Goal** | Learn Manifesto | Solve a specific problem |
| **Structure** | Sequential, step-by-step | Standalone, jump to what you need |
| **Audience** | Beginners | Developers who know the basics |
| **Example** | "Build a counter app" | "Debug a re-entry loop" |

---

## Available Guides

| Guide | Description | Difficulty |
|-------|-------------|------------|
| [Effect Handlers](./effect-handlers) | Write robust handlers for API calls, database, etc. | Intermediate |
| [Re-entry Safety](./reentry-safe-flows) | Prevent infinite loops and duplicate effects | Intermediate |
| [Debugging](./debugging) | Inspect traces, state, and performance | Beginner |
| [Migrate App to SDK](./migrate-app-to-sdk) | Replace legacy app-facade imports with `@manifesto-ai/sdk` | Beginner |
| [Performance Report](./performance-report) | Benchmark results and reproduction commands | Advanced |
| [Code Generation](./code-generation) | Generate TypeScript types and Zod schemas from DomainSchema | Beginner |

---

## Quick Reference

### When to Use Which Guide

| Problem | Guide |
|---------|-------|
| Flow runs multiple times | [Re-entry Safety](./reentry-safe-flows) |
| Effect handler never called | [Effect Handlers](./effect-handlers) |
| State not updating | [Debugging](./debugging) |
| Migrating legacy imports | [Migrate App to SDK](./migrate-app-to-sdk) |
| Checking deployment readiness | [Performance Report](./performance-report) |
| Generating types from schema | [Code Generation](./code-generation) |

---

## See Also

- **[Tutorial](/tutorial/)** -- Step-by-step learning path (start here if new)
- **[Integration](/integration/)** -- Connect Manifesto with React, AI agents
- **[API Reference](/api/)** -- Complete package documentation
- **[MEL Syntax](/mel/SYNTAX)** -- Domain definition language
