# Typed Patch Ops

> Historical note for the retired SDK v2 `defineOps()` helper.

::: warning Historical Guide
`defineOps()` was removed from the current SDK during the ADR-017 hard cut. This page remains only for repositories pinned to older SDK generations or for decision history.
:::

The current SDK contract does not expose `defineOps()`.

For current code:

- return raw `Patch[]` objects from effect handlers
- use the activation-first SDK runtime via `createManifesto(schema, effects).activate()`
- treat this page as a retired reference, not as current onboarding guidance

## Current Replacements

- Read [Effect Handlers](./effect-handlers) for current handler patterns
- Read [SDK API](/api/sdk) for the current runtime surface
- Read [SDK VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/VERSION-INDEX.md) if you need the historical v2/v1 contract boundary
