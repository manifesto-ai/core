# How-to Guides

> Solve one concrete problem at a time.

If you are still learning the basics, start with [Quick Start](/guide/quick-start) and then the [Tutorial](/tutorial/). These guides assume you already know how to dispatch intents and read Snapshots.

## Build And Debug

| Guide | Read It When |
|-------|--------------|
| [Bundler Setup](./bundler-setup) | You need to configure Vite, Next.js, Webpack, or another bundler for `.mel` files |
| [Effect Handlers](./effect-handlers) | You need to connect Manifesto to an API, database, or other IO |
| [Debugging](./debugging) | A dispatch does not do what you expected |
| [Code Generation](./code-generation) | You want generated TypeScript or Zod artifacts from a schema |
| [Developer Tooling](./developer-tooling) | You want the CLI, MEL editor support, AI skills, or Studio inspection workflow |
| [Runtime Tooling Surface](./runtime-tooling-surface) | You are building Studio, agent, or adapter tooling on public runtime contracts |
| [Re-entry Safety](./reentry-safe-flows) | An action or effect runs more than once |

## Add The Advanced Runtime Later

| Guide | Read It When |
|-------|--------------|
| [When You Need Approval or History](./approval-and-history) | The project now needs review, branch continuity, sealed history, or auditability |
| [Advanced Runtime Assembly](./governed-composition) | You already know you need Lineage and Governance decorators and want the compact setup path |

## Maintainers And Operators

| Guide | Read It When |
|-------|--------------|
| [Release Hardening](./release-hardening) | You need the current release gate, known limitations, or operator checks |
| [Upgrade to Next Major](./upgrade-next-major) | You are moving app or runtime code onto the hard-cut next-major surface |

## What These Guides Assume

- You use `createManifesto()` and `activate()` for base runtime apps.
- You add `withLineage()` and `withGovernance()` only when the app needs the advanced runtime.
- You create intents through an activated runtime or low-level governance helpers.
- You observe outcomes through subscriptions, runtime events, governed proposals, and lineage/governance query APIs.
- You treat `snapshot()` as the default runtime read model and escalate to canonical reads only when needed.

## See Also

- [Tutorial](/tutorial/) for the step-by-step learning path
- [Integration](/integration/) for React and AI-agent patterns
- [API Reference](/api/) for package-level CLI, LSP, Studio, and runtime docs
- [Architecture](/architecture/) for the system-level model
