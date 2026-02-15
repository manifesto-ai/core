# @manifesto-ai/runtime

> **Runtime** is the internal execution orchestration engine for the Manifesto protocol stack. It bridges Core, Host, and World through a 5-stage action pipeline.

> **Internal Package:** This package is NOT intended for direct consumption. Use `@manifesto-ai/app` or `@manifesto-ai/sdk` instead.

---

## What is Runtime?

Runtime is the orchestration layer that sits between the SDK (public API) and the protocol layers (Core, Host, World). It implements the execution pipeline, policy system, memory coordination, and branch management.

```
SDK (public API)
    |
    v
  RUNTIME (orchestration)               <-- you are here
    |         |         |
    v         v         v
  Core      Host      World
  (compute) (execute) (govern)
```

---

## What Runtime Does

| Responsibility | Description |
|----------------|-------------|
| Action pipeline | 5-stage execution: prepare, authorize, execute, persist, finalize |
| Type definitions | All shared types (AppConfig, AppState, ActionHandle, etc.) |
| Error hierarchy | 25 error classes extending ManifestoAppError |
| Policy system | ExecutionKey derivation, Authority routing, Scope enforcement |
| Memory coordination | Provider fan-out, context freezing for determinism |
| Branch management | Named pointers over World lineage |
| State subscriptions | Selector-based change detection with batching |
| System runtime | Separate runtime for `system.*` meta-operations |
| Bootstrap | App assembly sequence (schema → state → world → executor) |

---

## What Runtime Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Public API shape | SDK |
| Pure state computation | Core |
| Effect execution (IO) | Host |
| Governance and lineage | World |
| Lifecycle presentation | SDK |

---

## Installation

> **Do not install this package directly.** It is consumed internally by `@manifesto-ai/sdk`.

```bash
# Use the App facade instead:
pnpm add @manifesto-ai/app
```

---

## Internal Architecture

### 5-Stage Action Pipeline

```
1. Prepare    → Validate action type, create Proposal
2. Authorize  → Derive ExecutionKey, get Authority approval, validate scope
3. Execute    → Restore snapshot, recall memory, freeze context, run Host
4. Persist    → Seal World, store delta, advance branch head
5. Finalize   → Create ActionResult, emit hooks, clean up
```

### Main Components

| Component | Responsibility |
|-----------|---------------|
| `AppRuntime` | Assembled runtime holding all dependencies post-bootstrap |
| `AppBootstrap` | Handles `created → ready` transition |
| `AppExecutor` | Orchestrates the 5-stage pipeline |
| `AppHostExecutor` | Bridges Host execution with World persistence |
| `BranchManager` | Manages branches as named pointers |
| `MemoryHub` | Memory provider fan-out and context freezing |
| `DefaultPolicyService` | ExecutionKey and Authority policies |
| `SystemRuntime` | Separate runtime for system meta-operations |
| `SubscriptionStore` | State change notifications with selectors |

---

## Relationship with Other Packages

```
App (facade) -> SDK -> Runtime -> Core / Host / World
```

| Relationship | Package | How |
|--------------|---------|-----|
| Consumed by | `@manifesto-ai/sdk` | SDK delegates all orchestration to Runtime |
| Re-exported by | `@manifesto-ai/app` | App re-exports Runtime types and errors |
| Depends on | `@manifesto-ai/core` | Pure computation |
| Depends on | `@manifesto-ai/host` | Effect execution |
| Depends on | `@manifesto-ai/world` | Governance and lineage |
| Depends on | `@manifesto-ai/compiler` | MEL compilation |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [runtime-SPEC-v0.1.0.md](docs/runtime-SPEC-v0.1.0.md) | Complete specification |
| [VERSION-INDEX.md](docs/VERSION-INDEX.md) | Version history and reading guide |
| [ADR-007](../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) | Split rationale |

---

## License

[MIT](../../LICENSE)
