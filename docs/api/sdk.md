# @manifesto-ai/sdk

> Public developer API layer for the Manifesto protocol stack

> **Canonical Entry:** SDK is the official public package for new integrations.

---

## Overview

`@manifesto-ai/sdk` is the primary developer-facing API.

- `createRuntime()` as canonical hard-cut entry
- App/runtime facade APIs for actions, state, branches, hooks
- ADR-009-aligned patch guidance for effect handlers

---

## Main Exports

### createRuntime()

```typescript
import { createRuntime } from "@manifesto-ai/sdk";

const runtime = createRuntime({
  schema: domainSchema,
  effects: {
    "api.save": async (params, ctx) => [
      {
        op: "set",
        path: [{ kind: "prop", name: "savedAt" }],
        value: params.timestamp,
      },
    ],
  },
});
```

---

## Effect Handler Guidance (ADR-009)

```typescript
type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext
) => Promise<readonly Patch[]>;
```

Rules:
- Return `Patch[]` with structured `PatchPath` segments.
- Patch root is `snapshot.data`.
- Do not patch `system.*` directly.
- Return error information through domain paths or `$host` namespace.

---

## Typed Patch Operations

`defineOps<TData>()` remains data-path focused.

- `set(path, value)`
- `unset(path)`
- `merge(path, value)`

`system.*` convenience mutation APIs are intentionally excluded from typed data patch ops (`ops.error()` is not provided).

```typescript
const ops = defineOps<MyState>();
return [
  ops.set("syncStatus", "error"),
  ops.set("errorMessage", "API timeout"),
  ops.raw.set("$host.lastError", { code: "SYNC_TIMEOUT" }),
];
```

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Pure computation |
| [@manifesto-ai/host](./host) | Effect execution |
| [@manifesto-ai/world](./world) | Governance and lineage |
