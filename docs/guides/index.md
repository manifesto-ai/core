# How-to Guides

> Solve one concrete problem at a time.

If you are still learning the basics, start with the [Tutorial](/tutorial/). These guides assume you already know what a `ManifestoInstance` is and how to dispatch intents.

---

## Available Guides

| Guide | When to Read It |
|-------|-----------------|
| [Effect Handlers](./effect-handlers) | You need to connect Manifesto to an API, database, or other IO |
| [Debugging](./debugging) | A dispatch does not do what you expected |
| [Re-entry Safety](./reentry-safe-flows) | An action or effect runs more than once |
| [Typed Patch Ops](./typed-patch-ops) | You want safer patch creation in TypeScript |
| [Code Generation](./code-generation) | You want generated TypeScript or Zod artifacts from a schema |
| [Performance Report](./performance-report) | You want benchmark numbers and reproduction steps |
| [Legacy App Migration](./migrate-app-to-sdk) | You still have old `@manifesto-ai/app` code |

---

## Recommended Order After the Tutorial

1. Read [Effect Handlers](./effect-handlers)
2. Read [Debugging](./debugging)
3. Read [Re-entry Safety](./reentry-safe-flows)
4. Read [Typed Patch Ops](./typed-patch-ops)

That sequence matches the problems most teams hit first.

---

## What These Guides Assume

- You use `createManifesto()` as the public SDK entry
- You create intents with `createIntent()`
- You observe outcomes through `subscribe()`, `on()`, or a small `dispatchAsync()` helper
- You treat Snapshot as the single source of truth

---

## See Also

- [Tutorial](/tutorial/) for the step-by-step learning path
- [Integration](/integration/) for React and AI-agent patterns
- [Architecture](/architecture/) for the system-level model
