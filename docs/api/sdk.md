# @manifesto-ai/sdk

> Thin direct-dispatch entry point for Manifesto.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Use SDK when you want:

- the shortest path to a running app
- direct dispatch
- subscriptions and snapshot reads without governed assembly

If you need proposals, legitimacy, sealed lineage, or explicit runtime composition, move to top-level `@manifesto-ai/world`.

## SDK-Owned Surface

- `createManifesto()`
- `dispatchAsync()`
- `defineOps()`
- SDK error types

## Thin World Re-exports

SDK intentionally keeps only a narrow world escape hatch:

- `createWorld()`

This is not the full governed surface. SDK does not expose store adapter implementations or the split-native governance/lineage service factories needed for full governed bootstrap.

## Direct-Dispatch Example

```typescript
import { createIntent, createManifesto, dispatchAsync } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: domainSchema,
  effects: {},
});

await dispatchAsync(manifesto, createIntent("increment", "intent-1"));
```

## When To Leave SDK

Move to `@manifesto-ai/world` when:

- you need proposal approval before execution
- you need sealed world ids and lineage queries
- you need a durable governed store
- you need `WorldRuntime.executeApprovedProposal()`

## Related Docs

- [World API](./world.md)
- [Quickstart](/quickstart)
- [Governed Composition Guide](/guides/governed-composition)
