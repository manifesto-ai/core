# @manifesto-ai/sdk

> Thin direct-dispatch entry point for Manifesto applications.

`@manifesto-ai/sdk` is the default package for applications that start with `createManifesto()`. It stays thin and only re-exports the governed world assembly surface needed for explicit composition.

> **Current Contract Note:** The current public package contract is documented in [docs/sdk-SPEC-v2.0.0.md](docs/sdk-SPEC-v2.0.0.md). The projected ADR-015 + ADR-016 rewrite lives in [docs/sdk-SPEC-v3.0.0-draft.md](docs/sdk-SPEC-v3.0.0-draft.md) as draft only.

## What This Package Owns

- `createManifesto()`
- `dispatchAsync()`
- `defineOps()`
- typed operation helpers
- thin world re-exports for `createWorld()` and `createInMemoryWorldStore()`

## When to Use It

Use the SDK when you want:

- the shortest path to direct-dispatch execution
- subscriptions and snapshot reads without manual governed wiring
- thin access to the governed world assembler, while keeping full governance and lineage APIs in `@manifesto-ai/world`

## Direct Dispatch

```typescript
import { createIntent, createManifesto, dispatchAsync } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: counterSchema,
  effects: {},
});

await dispatchAsync(manifesto, createIntent("increment", "intent-1"));
```

## Governed Composition

```typescript
import {
  createWorld,
} from "@manifesto-ai/sdk";
```

These are thin re-exports from top-level `@manifesto-ai/world`. The canonical governed bootstrap, including durable store selection and `WorldRuntime.executeApprovedProposal()`, lives on `@manifesto-ai/world` directly.

For the full governed surface, including `createSqliteWorldStore()`, `createGovernanceService()`, `createLineageService()`, and `createGovernanceEventDispatcher()`, import `@manifesto-ai/world` directly.

## Docs

- [SDK Guide](docs/GUIDE.md)
- [SDK Specification](docs/sdk-SPEC-v2.0.0.md)
- [SDK Specification v3 Draft](docs/sdk-SPEC-v3.0.0-draft.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
