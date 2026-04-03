# How-to Guides

> Solve one concrete problem at a time.

If you are still learning the basics, start with the [Tutorial](/tutorial/). These guides assume you know how to dispatch intents and read Snapshots.

---

## Available Guides

| Guide | When to Read It |
|-------|-----------------|
| [Bundler Setup](./bundler-setup) | You need to configure Vite, Next.js, Webpack, or another bundler for `.mel` files |
| [Codex Skills Setup](./codex-skills) | You want Codex to load Manifesto-specific guidance from `@manifesto-ai/skills` |
| [Effect Handlers](./effect-handlers) | You need to connect Manifesto to an API, database, or other IO |
| [Governed Composition](./governed-composition) | You want to compose Lineage and Governance decorators explicitly |
| [Debugging](./debugging) | A dispatch does not do what you expected |
| [Release Hardening](./release-hardening) | You need the current release gate, known limitations, or operator checks |
| [Upgrade to Next Major](./upgrade-next-major) | You are moving app/runtime code onto the hard-cut next-major surface |
| [Re-entry Safety](./reentry-safe-flows) | An action or effect runs more than once |
| [Code Generation](./code-generation) | You want generated TypeScript or Zod artifacts from a schema |

---

## Recommended Order After the Tutorial

1. Read [Effect Handlers](./effect-handlers)
2. Read [Governed Composition](./governed-composition) if you need explicit lineage or authority
3. Read [Debugging](./debugging)
4. Read [Release Hardening](./release-hardening) when you are preparing a governed runtime for release
5. Read [Codex Skills Setup](./codex-skills) if you work with Codex
6. Read [Re-entry Safety](./reentry-safe-flows)
That sequence matches the problems most teams hit first.

---

## What These Guides Assume

- You use `createManifesto()` and `activate()` for base runtime apps
- You add `withLineage()` and `withGovernance()` only when the app needs governed composition
- You create intents through an activated runtime or low-level governance helpers
- You observe outcomes through subscriptions, runtime events, governed proposals, and lineage/governance query APIs
- You treat Snapshot as the single source of truth

---

## See Also

- [Tutorial](/tutorial/) for the step-by-step learning path
- [Integration](/integration/) for React and AI-agent patterns
- [Architecture](/architecture/) for the system-level model
