# @manifesto-ai/sdk

> **SDK** is the public developer API layer for Manifesto applications. It presents ergonomic factory functions, lifecycle management, and hook systems while delegating all execution to the Runtime.

> **Phase 1 Notice:** During the current phase, most users should install `@manifesto-ai/app`, which re-exports all SDK APIs. See [ADR-007](../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) for details.

---

## What is SDK?

SDK owns the public contract shape that developers interact with. It provides `createApp()`, the `App` interface, and the hook system — but delegates all orchestration to `@manifesto-ai/runtime`.

```
Application Code
      |
      v
    SDK (createApp, App, Hooks)       <-- you are here
      |
      v
    Runtime (orchestration, execution)
      |
      v
    Core / Host / World
```

---

## What SDK Does

| Responsibility | Description |
|----------------|-------------|
| App factory | `createApp(config)` — single entry point for creating apps |
| App interface | `ManifestoApp` — thin facade over Runtime |
| Lifecycle | `ready()` / `dispose()` with status tracking |
| Hook system | Observable lifecycle with re-entrancy guards |
| AppRef | Read-only facade for safe hook access |
| Job queue | Deferred execution for hook-triggered actions |
| Test helper | `createTestApp()` — minimal app for testing |

---

## What SDK Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execution orchestration | Runtime |
| Effect execution | Host (via Runtime) |
| Pure state computation | Core (via Runtime) |
| Governance and lineage | World (via Runtime) |
| Type/error definitions | Runtime |

---

## Installation

During **Phase 1**, use `@manifesto-ai/app` as the canonical entry point:

```bash
pnpm add @manifesto-ai/app
```

For direct SDK access (preview):

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
    "api.save": async (params, ctx) => [
      { op: "set", path: "data.savedAt", value: params.timestamp },
    ],
  },
});

await app.ready();

const handle = app.act("increment");
await handle.completed();

console.log(app.getState().data.count); // 1
```

---

## Core API

### Factory Functions

```typescript
function createApp(config: AppConfig): App;
function createTestApp(domain: DomainSchema | string, opts?: Partial<AppConfig>): App;
```

### App Interface

```typescript
interface App {
  // Lifecycle
  ready(): Promise<void>;
  dispose(opts?): Promise<void>;
  readonly status: AppStatus;
  readonly hooks: Hookable<AppHooks>;

  // Schema
  getDomainSchema(): DomainSchema;

  // Actions
  act(type: string, input?: unknown, opts?): ActionHandle;
  submitProposal(proposal): Promise<ProposalResult>;

  // State
  getState<T>(): AppState<T>;
  subscribe(selector, listener, opts?): () => void;
  getSnapshot(): Snapshot;

  // Session
  session(actorId: string, opts?): Session;

  // Branch
  currentBranch(): Branch;
  listBranches(): Branch[];
  switchBranch(branchId): Promise<void>;
  fork(opts?): Promise<Branch>;

  // World Query
  getCurrentHead(): WorldId;
  getWorld(worldId?): World;
}
```

> See [sdk-SPEC-v0.1.0.md](docs/sdk-SPEC-v0.1.0.md) for the complete specification.

---

## Relationship with Other Packages

```
App (facade) -> SDK -> Runtime -> Core / Host / World
```

| Relationship | Package | How |
|--------------|---------|-----|
| Re-exported by | `@manifesto-ai/app` | App re-exports createApp, createTestApp, hooks |
| Delegates to | `@manifesto-ai/runtime` | All orchestration via AppRuntime |
| Depends on | `@manifesto-ai/core` | Schema types |
| Depends on | `@manifesto-ai/world` | World types |

---

## When to Use SDK Directly

**Most users should use `@manifesto-ai/app` during Phase 1.**

Use SDK directly when:
- Building custom integrations that need only the public API surface
- Creating framework-specific wrappers (React, Vue, etc.)
- After Phase 2 transition when SDK becomes the primary entry point

---

## Documentation

| Document | Purpose |
|----------|---------|
| [sdk-SPEC-v0.1.0.md](docs/sdk-SPEC-v0.1.0.md) | Complete specification |
| [VERSION-INDEX.md](docs/VERSION-INDEX.md) | Version history and reading guide |
| [ADR-007](../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) | Split rationale |

---

## License

[MIT](../../LICENSE)
