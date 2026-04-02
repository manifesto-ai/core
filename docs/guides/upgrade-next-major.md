# Upgrade to the Next Major

> Moving onto the hard-cut governed runtime surface.

This guide captures the practical changes needed to move onto the current next-major surface after the hard-cut align work.

## Runtime Choice

Use one of these two public entry paths:

- `@manifesto-ai/sdk` with `createManifesto()` and `activate()` for base runtime
- `@manifesto-ai/lineage` + `@manifesto-ai/governance` for governed composition

Do not mix them into a single bootstrap story.

## Hard-Cut Changes

If you are moving old governed code forward, align to these surfaces:

- use `createManifesto(schema, effects)` instead of config-style runtime factories
- use `withLineage(...)` and `withGovernance(...)` before `activate()`
- use `createIntent(...)` on the activated instance, then call the runtime verb for the surface you activated. Base runtimes use `dispatchAsync(intent)`. Lineage runtimes use `commitAsync(intent)`. Governance runtimes use `proposeAsync(intent)`.
- use package-owned stores and services from Lineage and Governance directly
- treat the old world facade, adapter subpaths, and facade-owned coordinator/runtime as removed

## Governed Bootstrap

The current governed path is:

1. Create the composable manifesto
2. Add Lineage
3. Add Governance
4. Activate
5. Call `proposeAsync()`
6. Read history through Lineage queries such as `getLatestHead()` and `restore()`

Use `getWorldSnapshot(worldId)` when you need the stored sealed snapshot substrate. Use `restore(worldId)` when you need the normalized runtime resume path.

## What Not to Carry Forward

Do not reintroduce the removed transition surfaces from earlier drafts:

- `createWorld`
- world adapter subpaths
- facade-owned coordinator/runtime types
- facade-owned execution seams
- config-first `createManifesto(...)` bootstraps

## See Also

- [Governed Composition](./governed-composition)
- [Release Hardening](./release-hardening)
- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Governance API](/api/governance)
