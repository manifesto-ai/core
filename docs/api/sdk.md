# @manifesto-ai/sdk

> Public developer API layer for the Manifesto protocol stack

> **Canonical Entry:** SDK is the official public package for new integrations.

---

## Overview

`@manifesto-ai/sdk` is the thin public composition layer introduced by ADR-010.

- `createManifesto()` is the sole SDK-owned factory
- `defineOps()` provides typed data-path patch helpers
- Selected protocol types are re-exported from Core, Host, and World
- World re-exports are additive in Phase 5: `createMemoryWorldStore()` remains, and `createWorld()` / `createInMemoryWorldStore()` are available for explicit governed composition
- `@manifesto-ai/runtime` is retired; its responsibilities are absorbed into `createManifesto()`

---

## Main Exports

### createManifesto()

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: domainSchema,
  effects: {
    "api.save": async (params) => [
      {
        op: "set",
        path: [{ kind: "prop", name: "savedAt" }],
        value: (params as { timestamp: string }).timestamp,
      },
    ],
  },
});
```

`schema` accepts either a compiled `DomainSchema` or MEL source text. The returned instance is immediately ready; there is no `ready()` phase.

`createManifesto()` does not implicitly assemble a governed World. If you need explicit governance + lineage wiring, use `@manifesto-ai/world` or `@manifesto-ai/world/facade` directly.

### ManifestoInstance

```typescript
interface ManifestoInstance {
  dispatch(intent: Intent): void;
  subscribe(selector, listener): Unsubscribe;
  on(event, handler): Unsubscribe;
  getSnapshot(): Snapshot;
  dispose(): void;
}
```

`dispatch()` is fire-and-forget. Use `subscribe()` to observe terminal snapshot changes and `on()` to correlate lifecycle events per intent.

### Lifecycle Events

```typescript
type ManifestoEvent =
  | "dispatch:completed"
  | "dispatch:rejected"
  | "dispatch:failed";
```

All event payloads include `intentId`. `dispatch:completed` includes the terminal `snapshot`; `dispatch:rejected` includes `reason`; `dispatch:failed` includes `error`.

---

## Effect Handler Guidance (ADR-009)

```typescript
type EffectHandler = (
  params: unknown,
  ctx: { readonly snapshot: Readonly<Snapshot> }
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
| [@manifesto-ai/world](./world) | Governance and lineage, including additive governed composition helpers |

---

## Legacy App-Era Surface

App-era factory, readiness, handle, and plugin abstractions are retired in ADR-010. New code should use `createManifesto()`, `createIntent()`, `dispatch()`, `subscribe()`, and `on()` directly.

For migration details, see:

- [Migrate App to SDK](/guides/migrate-app-to-sdk)
- [SDK SPEC v1.0.1](../../packages/sdk/docs/sdk-SPEC-v1.0.1.md)
- [ADR-010](/internals/adr/010-major-hard-cut)
