# How-to Guides

> Solve one concrete problem at a time.

If you are still learning the basics, start with [Quick Start](/guide/quick-start)
and then the [Tutorial](/tutorial/). These guides assume you already know how
to submit actions and read snapshots.

## Build And Debug

| Guide | Read It When |
|-------|--------------|
| [Bundler Setup](./bundler-setup) | You need to configure Vite, Next.js, Webpack, or another bundler for `.mel` files |
| [Code Generation](./code-generation) | You want generated app-facing TypeScript from a MEL domain |
| [Debugging](./debugging) | A submit does not do what you expected |
| [Effect Handlers](./effect-handlers) | You need to connect Manifesto to an API, database, or other IO |
| [Re-entry Safety](./reentry-safe-flows) | An action or effect runs more than once |

## Tooling Around An App

| Guide | Read It When |
|-------|--------------|
| [Developer Tooling](./developer-tooling) | You want CLI checks, MEL editor support, or AI skill setup |
| [Runtime Tooling Surface](./runtime-tooling-surface) | You are building Studio, agent, or adapter tooling on public runtime contracts |

## Add The Advanced Runtime Later

| Guide | Read It When |
|-------|--------------|
| [When You Need Approval or History](./approval-and-history) | The project now needs review, durable history, or auditability |
| [Advanced Runtime Assembly](./governed-composition) | You already know you need the approval/history runtime and want the compact setup path |

## Maintainers And Operators

| Guide | Read It When |
|-------|--------------|
| [Release Hardening](./release-hardening) | You need the current release gate, known limitations, or operator checks |
| [Upgrade to Next Major](./upgrade-next-major) | You are moving app or runtime code onto the hard-cut next-major surface |

## What These Guides Assume

- You use `createManifesto()` and `activate()` for base runtime apps.
- You submit typed actions through `app.action.<name>.submit(...)`.
- You observe outcomes through `snapshot()`, `observe.state()`, and runtime events.
- You treat `snapshot()` as the default app read model.

The advanced runtime guides add one more assumption: add approval/history
packages only after the app needs review, durable history, or audit queries.

## See Also

- [Tutorial](/tutorial/) for the step-by-step learning path
- [Integration](/integration/) for React and AI-agent patterns
- [API Reference](/api/) for package-level CLI, LSP, Studio, and runtime docs
- [Architecture](/architecture/) for the system-level model
