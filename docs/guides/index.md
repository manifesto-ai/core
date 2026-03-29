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
| [Governed Composition](./governed-composition) | You want to assemble lineage, governance, and the World facade explicitly |
| [Debugging](./debugging) | A dispatch does not do what you expected |
| [Re-entry Safety](./reentry-safe-flows) | An action or effect runs more than once |
| [Typed Patch Ops](./typed-patch-ops) | You want safer patch creation in TypeScript |
| [Code Generation](./code-generation) | You want generated TypeScript or Zod artifacts from a schema |
| [Performance Report](./performance-report) | You want benchmark numbers and reproduction steps |
| [Legacy App Migration](./migrate-app-to-sdk) | You still have old `@manifesto-ai/app` code |

---

## Recommended Order After the Tutorial

1. Read [Effect Handlers](./effect-handlers)
2. Read [Governed Composition](./governed-composition) if you need explicit lineage or authority
3. Read [Debugging](./debugging)
4. Read [Codex Skills Setup](./codex-skills) if you work with Codex
5. Read [Re-entry Safety](./reentry-safe-flows)
6. Read [Typed Patch Ops](./typed-patch-ops)

That sequence matches the problems most teams hit first.

---

## What These Guides Assume

- You use `createManifesto()` for direct-dispatch apps, or `createWorld()` for governed composition
- You create intents with `createIntent()` or `createIntentInstance()`
- You observe outcomes through `subscribe()`, `on()`, `dispatchAsync()`, or explicit World sealing APIs
- You treat Snapshot as the single source of truth

---

## See Also

- [Tutorial](/tutorial/) for the step-by-step learning path
- [Integration](/integration/) for React and AI-agent patterns
- [Architecture](/architecture/) for the system-level model

