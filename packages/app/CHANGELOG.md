# Changelog

## [0.8.0](https://github.com/manifesto-ai/core/tree/main/packages/app) (2026-02-05)

### Changed

- **BREAKING**: `worldStore` removed from `AppConfig` public API
- Added `world?: ManifestoWorld` option (optional, default: internal World with InMemoryWorldStore)
- World now owns persistence per ADR-003

### Migration

```typescript
// Before (v0.7.0)
const app = createApp({
  schema,
  effects,
  worldStore: createInMemoryWorldStore(),  // ❌ Removed
});

// After (v0.8.0)
const app = createApp({
  schema,
  effects,
  // worldStore removed - World created internally
  // Or provide custom World:
  // world: createManifestoWorld({ store: customStore }),
});
```

## [0.7.0](https://github.com/manifesto-ai/core/tree/main/packages/app) (2026-02-05)

### Changed

- **BREAKING**: `host` removed from `AppConfig` public API (now created internally)
- `effects` is now **required** in `AppConfig`
- Host created internally via `createInternalHost()`
- Compiler internalized for MEL support

### Added

- `Effects` type export for effect handler definitions
- `AppEffectContext` type for effect handler context
- `EffectHandler` type (aliased as `AppEffectHandler` to avoid Host conflict)

### Deprecated

- Legacy `createApp(domain, opts)` signature (use `AppConfig` instead)
- `LegacyAppConfig` with `host`/`worldStore` (migrate to effects-first API)

### Migration

```typescript
// Before (v0.6.0 / v2.0.0)
const host = createHost(schema);
host.registerEffect('api.save', handler);

const app = createApp({
  schema,
  host,
  worldStore,
});

// After (v0.7.0 / v2.2.0)
const app = createApp({
  schema,
  effects: {
    'api.save': async (params, ctx) => [...],
  },
});
```

## [0.6.0](https://github.com/manifesto-ai/core/tree/main/packages/app) (2026-01-15)

Initial release of @manifesto-ai/app - Facade and orchestration layer over the Manifesto protocol stack.
