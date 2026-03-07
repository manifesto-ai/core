# @manifesto-ai/sdk

> Thin public composition layer for the Manifesto protocol stack.

---

## Overview

`@manifesto-ai/sdk` is the canonical entry point for new Manifesto integrations.

```text
Application Code
      |
      v
SDK (createManifesto, defineOps, re-exports)
      |
      v
Compiler / Host / Core
      +
optional World integration
```

The SDK owns exactly one concept: `createManifesto()`. Everything else is either a small SDK utility (`defineOps`) or a re-export from protocol packages. Legacy app-package facade APIs are retired in v1.0.0. Governance and lineage remain explicit integrations through `@manifesto-ai/world`.

---

## Installation

```bash
pnpm add @manifesto-ai/sdk
```

---

## Quick Example

```typescript
import { createManifesto, createIntent } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: counterSchema,
  effects: {},
});

manifesto.on("dispatch:completed", ({ snapshot }) => {
  console.log(snapshot?.data.count);
});

manifesto.dispatch(createIntent("increment", "intent-1"));
```

---

## Main Exports

### SDK-Owned

```typescript
function createManifesto(config: ManifestoConfig): ManifestoInstance;
function defineOps<TData>(): TypedOps<TData>;
```

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

### Event Channel

```typescript
type ManifestoEvent =
  | "dispatch:completed"
  | "dispatch:rejected"
  | "dispatch:failed";
```

`dispatch()` is enqueue-only. Observe results through `subscribe()` for state changes or `on()` for per-intent telemetry.

### Re-Exported Protocol Surface

SDK re-exports selected protocol types and factories from:

- `@manifesto-ai/core`
- `@manifesto-ai/world`
- `@manifesto-ai/host` (types)

---

## Relationship with Other Packages

| Relationship | Package | How |
|--------------|---------|-----|
| Uses | `@manifesto-ai/core` | Schema and expression types |
| Uses | `@manifesto-ai/host` | Effect execution and compute loop |
| Re-exports | `@manifesto-ai/world` | World protocol types and store factory for explicit governance integration |
| Uses | `@manifesto-ai/compiler` | MEL → DomainSchema compilation |
| Retired predecessor | `@manifesto-ai/runtime` | Absorbed into `createManifesto()` per ADR-010 |

---

## Migration Notes

Older app-package code usually maps to three current patterns:

- use `createManifesto({ schema, effects })` as the public entry point
- create intents explicitly with `createIntent(...)`
- treat `dispatch()` as enqueue-only and observe completion through `dispatch:*` events or a small `dispatchAsync()` helper

For migration details, see:
- [Migrate App to SDK](../../docs/guides/migrate-app-to-sdk.md)
- [sdk-SPEC-v1.0.0.md](docs/sdk-SPEC-v1.0.0.md)
- [ADR-010](../../docs/internals/adr/010-major-hard-cut.md)

---

## Documentation

- [sdk-SPEC-v1.0.0.md](docs/sdk-SPEC-v1.0.0.md)
- [VERSION-INDEX.md](docs/VERSION-INDEX.md)
- [ADR-010](../../docs/internals/adr/010-major-hard-cut.md)

---

## License

[MIT](../../LICENSE)
