# @manifesto-ai/sdk

> **SDK** is the canonical public developer API for Manifesto applications.

---

## Overview

SDK owns the public contract for app creation and interaction.
It provides `createApp()`, `createTestApp()`, `ManifestoApp`, and the hook primitives while delegating orchestration to Runtime.

```text
Application Code
      |
      v
SDK (createApp, App, Hooks)
      |
      v
Runtime (orchestration)
      |
      v
Core / Host / World
```

---

## Installation

```bash
pnpm add @manifesto-ai/sdk
```

---

## Quick Example

```typescript
import { createApp } from "@manifesto-ai/sdk";

const app = createApp({
  schema: counterSchema,
  effects: {
    "api.save": async (params) => [
      { op: "set", path: "data.savedAt", value: params.timestamp },
    ],
  },
});

await app.ready();
await app.act("increment").done();
console.log(app.getState().data.count);
```

---

## Main Exports

### Factory

```typescript
function createApp(config: AppConfig): App;
function createTestApp(domain: DomainSchema | string, opts?: Partial<AppConfig>): App;
```

### Class

```typescript
class ManifestoApp implements App { /* ... */ }
```

### Runtime-Reexported Public Types/Errors

SDK re-exports public contract types and errors (for example `AppConfig`, `AppState`, `ActionHandle`, `AppNotReadyError`).

---

## Relationship with Other Packages

| Relationship | Package | How |
|--------------|---------|-----|
| Delegates to | `@manifesto-ai/runtime` | All orchestration via runtime pipeline |
| Uses | `@manifesto-ai/core` | Schema and expression types |
| Uses | `@manifesto-ai/world` | World protocol types |
| Legacy predecessor | `@manifesto-ai/app` | Deprecated compatibility facade (R1), scheduled for removal in R2 |

---

## Migration from @manifesto-ai/app

`@manifesto-ai/app` imports should be replaced with `@manifesto-ai/sdk`.

```typescript
// Before
import { createApp } from "@manifesto-ai/app";

// After
import { createApp } from "@manifesto-ai/sdk";
```

For automated rewrite guidance, see:
- [docs/guides/migrate-app-to-sdk.md](../../docs/guides/migrate-app-to-sdk.md)

---

## Documentation

- [sdk-SPEC-v0.1.0.md](docs/sdk-SPEC-v0.1.0.md)
- [VERSION-INDEX.md](docs/VERSION-INDEX.md)
- [ADR-008](../../docs/internals/adr/008-sdk-first-transition-and-app-retirement.md)

---

## License

[MIT](../../LICENSE)
