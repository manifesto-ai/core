# Changelog

## [2.6.0](https://github.com/manifesto-ai/core/compare/app-v2.5.0...app-v2.6.0) (2026-02-17)


### Features

* **app:** add @manifesto-ai/app to release-please for npm publish ([9d69380](https://github.com/manifesto-ai/core/commit/9d693806ad1c5d7493a9a8c6b1e7c781f52e8ae2))
* **app:** add schema compatibility check on fork (Phase 12) ([ed6276e](https://github.com/manifesto-ai/core/commit/ed6276ec3e4f655f682ae5fc70a9bba15eb4a564))
* **app:** add Snapshot DX aliases (App SPEC v2.3.2) ([#142](https://github.com/manifesto-ai/core/issues/142)) ([9bde2eb](https://github.com/manifesto-ai/core/commit/9bde2eb008d151574ac48e440d2fa6c93bac2e7b))
* **app:** add v2 supporting modules ([a97e211](https://github.com/manifesto-ai/core/commit/a97e2117c47017cd2640965997a329efe86ef234))
* **app:** implement @manifesto-ai/app package with Memory Maintenance (v0.4.9) ([86e7c8a](https://github.com/manifesto-ai/core/commit/86e7c8a697e62bd42b7c333b9fe089117dcb3ee8))
* **app:** implement getDomainSchema() API (v0.4.10) ([0528294](https://github.com/manifesto-ai/core/commit/0528294b8a122e9b70cf0663fcf01d613113416d))
* **app:** implement getDomainSchema() API (v0.4.10) ([3435819](https://github.com/manifesto-ai/core/commit/343581986d3be5645611937c42c92df9cdc35494))
* **app:** implement Memory Maintenance system (v0.4.9) ([6c65e10](https://github.com/manifesto-ai/core/commit/6c65e1049f556355e8e776244d194c5b8f21a7cf))
* **app:** implement v2 FDR compliance (delta-gen, publish-tick, liveness) ([0d4d20b](https://github.com/manifesto-ai/core/commit/0d4d20b2ae280591a10f48746f702cea7a076678))
* **app:** integrate Host with FIFO serialization ([475e953](https://github.com/manifesto-ai/core/commit/475e953e6b56a946fca8eb0e8715c213ecc17df0))
* **app:** integrate v2 components into ManifestoApp (Phase 11) ([43ca611](https://github.com/manifesto-ai/core/commit/43ca6119b5ae35f83582045b74ae27a0b5dea7ec))
* **app:** mark DomainExecutor as deprecated ([3ea17f8](https://github.com/manifesto-ai/core/commit/3ea17f8c1368e10b41f04d56a11691f725c30264))
* **intent-ir:** implement Chomskyan LF-based Intent IR package (v0.1.0) ([000f1ba](https://github.com/manifesto-ai/core/commit/000f1ba64a09817e43ec746aeef030763dd734d9))
* **platform:** add  namespace and semantic schema hashing ([b7038a5](https://github.com/manifesto-ai/core/commit/b7038a57c4f4989ebda80589af57f08ec50c7fc7))
* sync updates from mind-protocol experimental branch ([85bf298](https://github.com/manifesto-ai/core/commit/85bf29860d5c35d5b7df442d75709fe09b544080))


### Bug Fixes

* **app-tests:** remove timing-based flake in sync createApp spec ([c1c0644](https://github.com/manifesto-ai/core/commit/c1c0644ae347faef8b4b212d8224999f70770260))
* **app,translator:** align snapshot handling types ([7448aa4](https://github.com/manifesto-ai/core/commit/7448aa4e25173d2732a5f54176fbfb187ae8179f))
* **app:** add state:publish hook and fix scope validation ([34f2a17](https://github.com/manifesto-ai/core/commit/34f2a173dae26b8ded735f7330363e90e3522498))
* **app:** align WorldStore delta scope with World SPEC v2.0.3 ([#83](https://github.com/manifesto-ai/core/issues/83)) ([02636ef](https://github.com/manifesto-ai/core/commit/02636efa7880edc9df87df00d83834b32730ecb3))
* **core,app:** ensure deterministic trace timestamps and prevent memory leak ([#86](https://github.com/manifesto-ai/core/issues/86)) ([64d20a2](https://github.com/manifesto-ai/core/commit/64d20a2def88eb2aae981ba696d6b9dc685f2607))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))

## [2.4.0](https://github.com/manifesto-ai/core/compare/app-v2.3.0...app-v2.4.0) (2026-02-11)


### Features

* **app:** add Snapshot DX aliases (App SPEC v2.3.2) ([#142](https://github.com/manifesto-ai/core/issues/142)) ([9bde2eb](https://github.com/manifesto-ai/core/commit/9bde2eb008d151574ac48e440d2fa6c93bac2e7b))

## [2.3.0](https://github.com/manifesto-ai/core/compare/app-v2.2.0...app-v2.3.0) (2026-02-09)


### Features

* **app:** add @manifesto-ai/app to release-please for npm publish ([9d69380](https://github.com/manifesto-ai/core/commit/9d693806ad1c5d7493a9a8c6b1e7c781f52e8ae2))
* **app:** add schema compatibility check on fork (Phase 12) ([ed6276e](https://github.com/manifesto-ai/core/commit/ed6276ec3e4f655f682ae5fc70a9bba15eb4a564))
* **app:** add v2 supporting modules ([a97e211](https://github.com/manifesto-ai/core/commit/a97e2117c47017cd2640965997a329efe86ef234))
* **app:** implement @manifesto-ai/app package with Memory Maintenance (v0.4.9) ([86e7c8a](https://github.com/manifesto-ai/core/commit/86e7c8a697e62bd42b7c333b9fe089117dcb3ee8))
* **app:** implement getDomainSchema() API (v0.4.10) ([0528294](https://github.com/manifesto-ai/core/commit/0528294b8a122e9b70cf0663fcf01d613113416d))
* **app:** implement getDomainSchema() API (v0.4.10) ([3435819](https://github.com/manifesto-ai/core/commit/343581986d3be5645611937c42c92df9cdc35494))
* **app:** implement Memory Maintenance system (v0.4.9) ([6c65e10](https://github.com/manifesto-ai/core/commit/6c65e1049f556355e8e776244d194c5b8f21a7cf))
* **app:** implement v2 FDR compliance (delta-gen, publish-tick, liveness) ([0d4d20b](https://github.com/manifesto-ai/core/commit/0d4d20b2ae280591a10f48746f702cea7a076678))
* **app:** integrate Host with FIFO serialization ([475e953](https://github.com/manifesto-ai/core/commit/475e953e6b56a946fca8eb0e8715c213ecc17df0))
* **app:** integrate v2 components into ManifestoApp (Phase 11) ([43ca611](https://github.com/manifesto-ai/core/commit/43ca6119b5ae35f83582045b74ae27a0b5dea7ec))
* **app:** mark DomainExecutor as deprecated ([3ea17f8](https://github.com/manifesto-ai/core/commit/3ea17f8c1368e10b41f04d56a11691f725c30264))
* **intent-ir:** implement Chomskyan LF-based Intent IR package (v0.1.0) ([000f1ba](https://github.com/manifesto-ai/core/commit/000f1ba64a09817e43ec746aeef030763dd734d9))
* **platform:** add  namespace and semantic schema hashing ([b7038a5](https://github.com/manifesto-ai/core/commit/b7038a57c4f4989ebda80589af57f08ec50c7fc7))
* sync updates from mind-protocol experimental branch ([85bf298](https://github.com/manifesto-ai/core/commit/85bf29860d5c35d5b7df442d75709fe09b544080))


### Bug Fixes

* **app,translator:** align snapshot handling types ([7448aa4](https://github.com/manifesto-ai/core/commit/7448aa4e25173d2732a5f54176fbfb187ae8179f))
* **app:** add state:publish hook and fix scope validation ([34f2a17](https://github.com/manifesto-ai/core/commit/34f2a173dae26b8ded735f7330363e90e3522498))
* **app:** align WorldStore delta scope with World SPEC v2.0.3 ([#83](https://github.com/manifesto-ai/core/issues/83)) ([02636ef](https://github.com/manifesto-ai/core/commit/02636efa7880edc9df87df00d83834b32730ecb3))
* **core,app:** ensure deterministic trace timestamps and prevent memory leak ([#86](https://github.com/manifesto-ai/core/issues/86)) ([64d20a2](https://github.com/manifesto-ai/core/commit/64d20a2def88eb2aae981ba696d6b9dc685f2607))

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
