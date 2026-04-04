# How-to Guides

> Solve one concrete problem at a time.

If you are still learning the basics, start with [Start Here](/start-here) and then the [Tutorial](/tutorial/). These guides assume you already know how to dispatch intents and read Snapshots.

---

## Available Guides

| Guide | When to Read It |
|-------|-----------------|
| [Developer Tooling](./developer-tooling) | You want the current CLI, MEL editor, AI skills, or Studio inspection workflow |
| [When You Need Approval or History](./approval-and-history) | The project now needs review, branch continuity, sealed history, or auditability |
| [Bundler Setup](./bundler-setup) | You need to configure Vite, Next.js, Webpack, or another bundler for `.mel` files |
| [Effect Handlers](./effect-handlers) | You need to connect Manifesto to an API, database, or other IO |
| [Advanced Runtime Assembly](./governed-composition) | You already know you need Lineage and Governance decorators and want the assembly steps |
| [Debugging](./debugging) | A dispatch does not do what you expected |
| [Release Hardening](./release-hardening) | You need the current release gate, known limitations, or operator checks |
| [Upgrade to Next Major](./upgrade-next-major) | You are moving app/runtime code onto the hard-cut next-major surface |
| [Re-entry Safety](./reentry-safe-flows) | An action or effect runs more than once |
| [Code Generation](./code-generation) | You want generated TypeScript or Zod artifacts from a schema |

---

## Recommended Order After the Tutorial

1. Read [Developer Tooling](./developer-tooling) if you are setting up repo bootstrap, editor support, agent context, or Studio analysis surfaces
2. Read [Effect Handlers](./effect-handlers)
3. Read [Debugging](./debugging)
4. Read [When You Need Approval or History](./approval-and-history) only if the project now needs review, auditability, or sealed history
5. Read [Release Hardening](./release-hardening) when you are preparing an advanced runtime for release
6. Read [Re-entry Safety](./reentry-safe-flows)
That sequence matches the problems most teams hit first.

---

## What These Guides Assume

- You use `createManifesto()` and `activate()` for base runtime apps
- You add `withLineage()` and `withGovernance()` only when the app needs the advanced runtime
- You create intents through an activated runtime or low-level governance helpers
- You observe outcomes through subscriptions, runtime events, governed proposals, and lineage/governance query APIs
- You treat `getSnapshot()` as the default runtime read model and escalate to canonical reads only when needed

---

## See Also

- [Tutorial](/tutorial/) for the step-by-step learning path
- [Integration](/integration/) for React and AI-agent patterns
- [API Reference](/api/) for package-level CLI, LSP, Studio, and runtime docs
- [Architecture](/architecture/) for the system-level model
