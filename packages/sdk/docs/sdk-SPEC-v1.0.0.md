# Manifesto SDK Specification v1.0.0

> **Status:** Normative
> **Scope:** Manifesto SDK Layer — Public Developer API
> **Compatible with:** Core SPEC v3.0.0, Host Contract v3.0.0, World Protocol v3.0.0, Compiler SPEC v0.6.0
> **Supersedes:** SDK SPEC v0.2.0, SDK SPEC v0.1.0, Runtime SPEC v0.2.0, Runtime SPEC v0.1.0
> **Implements:** ADR-010 (Protocol-First SDK Reconstruction)
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - **v1.0.0 (2026-03-02):** ADR-010 hard cut — Protocol-first reconstruction
>   - `createApp()` → `createManifesto()`
>   - `App` interface → `ManifestoInstance` (5 methods: dispatch, subscribe, on, getSnapshot, dispose)
>   - Removed: ActionHandle, Session, Hook system, Plugin system, MemoryFacade, SystemFacade, AppRef, AppStatus lifecycle, ActionPhase
>   - Runtime absorbed: `@manifesto-ai/runtime` retired, responsibilities absorbed into `createManifesto` internal wiring
>   - New rule ID namespace: SDK-FACTORY, SDK-DISPATCH, SDK-SUB, SDK-EVENT, SDK-INV, SDK-CONFIG, SDK-CHAN, SDK-EXT, SDK-REEXPORT, SDK-ERR

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Protocol Identity & SDK Role](#4-protocol-identity--sdk-role)
5. [createManifesto() Factory](#5-createmanifesto-factory)
6. [ManifestoInstance Interface](#6-manifestoinstance-interface)
7. [ManifestoConfig Interface](#7-manifestoconfig-interface)
8. [Event Channel](#8-event-channel)
9. [Extension Pattern](#9-extension-pattern)
10. [Re-export Hub](#10-re-export-hub)
11. [Invariants](#11-invariants)
12. [Error Types](#12-error-types)
13. [Compliance](#13-compliance)
14. [Migration from v0.2.0](#14-migration-from-v020)
15. [References](#15-references)

---

## 1. Purpose

This document defines the **Manifesto SDK Specification v1.0.0**.

The SDK layer is a **thin composition layer** that assembles the Manifesto protocol packages into a usable instance. The SDK:

- Provides `createManifesto()` as the **sole SDK-owned concept**
- Re-exports all necessary types from protocol packages (Core, Host, World, MEL/Compiler)
- Defines `ManifestoInstance` as the unified public interface (5 methods)
- Defines the event channel for intent lifecycle telemetry
- Describes the extension pattern (wrapping, not plugin registration)

The SDK does NOT invent new concepts. There is no ActionHandle, Session, Hook, Plugin, Facade, Registry, or equivalent. All orchestration is composed internally by `createManifesto()`.

**Relationship to Runtime:** The `@manifesto-ai/runtime` package is **retired** (ADR-010 §2.5). Runtime responsibilities are absorbed into `createManifesto()` internal wiring. There is no separate Runtime SPEC — this specification covers the full public contract.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| `createManifesto()` factory | Configuration, validation, protocol assembly |
| `ManifestoInstance` interface | dispatch, subscribe, on, getSnapshot, dispose |
| `ManifestoConfig` interface | Required and optional configuration types |
| Event channel | Intent lifecycle telemetry (dispatch:completed, dispatch:rejected, dispatch:failed) |
| Re-export hub | Type and function re-exports from protocol packages |
| Extension pattern | Guidance on wrapping-based extensibility |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Core computation internals | Core SPEC responsibility |
| Host execution internals | Host Contract responsibility |
| World governance rules | World Protocol responsibility |
| MEL/Compiler semantics | Compiler SPEC responsibility |
| React/Vue/framework bindings | Ecosystem packages (e.g., `@manifesto-ai/react`) |
| AI agent patterns | Built on top of dispatch/subscribe |
| Branch management | Deferred — future extension package |
| Memory/persistence strategies | Deferred — host-delegated |

---

## 4. Protocol Identity & SDK Role

### 4.1 Manifesto Is a Protocol

Manifesto is defined as a protocol with exactly four axes:

```
Protocol Core (Manifesto IS this):
├── World    — Snapshot + Schema + Snapshot lineage
├── Intent   — Action declaration against the World
├── MEL      — Language for expressing Worlds
├── Compiler — MEL → DomainSchema refinement
└── Host     — Contract between World and external effects
```

Everything else — guard, subscribe, memory, agent, branching, governance — is built _on_ the protocol, not part of it.

### 4.2 SDK Ownership Rule

`@manifesto-ai/sdk` owns exactly **one** concept — `createManifesto`. All other exports are re-exports from protocol packages. The SDK MUST NOT invent new concepts (no ActionHandle, Session, Hook, Plugin, Facade, Registry, or equivalent).

### 4.3 Architectural Position

```
┌────────────────────────────────────────────────────┐
│  User Code                                          │
│  const m = createManifesto({ schema, effects })     │
│  m.dispatch(intent)                                 │
│  m.subscribe(selector, listener)                    │
│  m.on('dispatch:rejected', handler)                 │
│  m.getSnapshot()                                    │
└────────────────────────┬───────────────────────────┘
                         │ (sole boundary)
┌────────────────────────▼───────────────────────────┐
│  @manifesto-ai/sdk                                  │
│  createManifesto() — ~100-200 lines composition fn  │
│  + re-exports from protocol packages                │
│  Concepts owned: 1 (createManifesto)                │
└────┬──────────┬────────────┬──────────┬────────────┘
     │          │            │          │
     ▼          ▼            ▼          ▼
  [Core]     [Host]      [World]    [MEL/Compiler]
  Protocol packages — unchanged, independently versioned
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ROLE-1 | MUST | SDK MUST own exactly one concept: `createManifesto` |
| SDK-ROLE-2 | MUST NOT | SDK MUST NOT invent new binding-layer concepts |
| SDK-ROLE-3 | MUST | SDK MUST serve as a re-export hub for protocol package types |

---

## 5. createManifesto() Factory

### 5.1 Signature

```typescript
function createManifesto<T>(config: ManifestoConfig<T>): ManifestoInstance<T>;
```

`createManifesto` returns a **ready-to-use** instance. There is no `ready()` step or asynchronous initialization.

### 5.2 Internal Wiring Obligations

`createManifesto` connects the four protocol axes and fulfills the following normative obligations:

1. **Platform namespace injection (INV-3):** Inject `$host` and `$mel` namespaces into the schema. Normalize the initial snapshot to ensure `$mel.guards.intent.*` structure exists.
2. **Reserved effect protection (INV-4):** Provide built-in effects for reserved system types (e.g., `system.get`). Reject user `effects` that attempt to override reserved types.
3. **Intent serialization (INV-5):** Internally serialize intent processing. Guard evaluation occurs at dequeue time against the current snapshot.
4. **Intent identity enrichment (INV-6):** Enrich each dispatched intent with `intentId`, `meta.timestamp`, and `meta.randomSeed`.

### 5.3 Factory Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-FACTORY-1 | MUST | `createManifesto` MUST return a ready-to-use instance (no `ready()` step) |
| SDK-FACTORY-2 | MUST | `createManifesto` MUST inject `$host` and `$mel` platform namespaces into the schema |
| SDK-FACTORY-3 | MUST | `createManifesto` MUST normalize the initial snapshot (ensure `$mel.guards.intent.*` exists) |
| SDK-FACTORY-4 | MUST | `createManifesto` MUST reject user effects that override reserved effect types with `ReservedEffectError` |
| SDK-FACTORY-5 | MUST | `createManifesto` MUST provide built-in effects for reserved system types (e.g., `system.get`) |

---

## 6. ManifestoInstance Interface

### 6.1 Interface Definition

```typescript
interface ManifestoInstance<T = unknown> {
  /** Fire-and-forget intent dispatch. */
  dispatch(intent: Intent): void;

  /** Subscribe to state changes via selector. Fires only at terminal snapshot. */
  subscribe<R>(selector: Selector<T, R>, listener: (value: R) => void): Unsubscribe;

  /** Listen to intent lifecycle events (telemetry channel). */
  on(event: ManifestoEvent, handler: (payload: ManifestoEventPayload) => void): Unsubscribe;

  /** Get the current snapshot synchronously. */
  getSnapshot(): Snapshot<T>;

  /** Dispose the instance and release resources. */
  dispose(): void;
}

type Selector<T, R> = (snapshot: Snapshot<T>) => R;
type Unsubscribe = () => void;
```

### 6.2 dispatch()

Enqueues an intent for processing. Dispatch is **synchronous** (enqueue only) and **fire-and-forget**. Results are observed via `subscribe()` (state changes) or `on()` (lifecycle events).

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-DISPATCH-1 | MUST | `dispatch` MUST enqueue the intent for serial processing |
| SDK-DISPATCH-2 | MUST | `dispatch` MUST enrich the intent with `intentId` if not provided (INV-6) |
| SDK-DISPATCH-3 | MUST | `dispatch` MUST be synchronous (returns immediately after enqueue) |
| SDK-DISPATCH-4 | MUST | `dispatch` on a disposed instance MUST throw `DisposedError` |

### 6.3 subscribe()

Subscribes to state changes with selector-based change detection. Listeners fire **only** at terminal snapshots (one notification per processed intent).

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SUB-1 | MUST | `subscribe` listeners MUST fire at most once per intent processing (INV-1) |
| SDK-SUB-2 | MUST | `subscribe` listeners MUST fire only after the intent reaches a terminal snapshot |
| SDK-SUB-3 | MUST NOT | `subscribe` MUST NOT fire for intermediate snapshots during Host-internal micro-steps |
| SDK-SUB-4 | MUST | `subscribe` MUST support selector-based change detection |

### 6.4 on()

Listens to intent lifecycle events on the **telemetry channel**. This channel carries intent lifecycle events, not state changes.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-EVENT-1 | MUST | `on` MUST support the three defined event types (§8) |
| SDK-EVENT-2 | MUST | All event payloads MUST include `intentId` for correlation (INV-6) |
| SDK-EVENT-3 | MUST NOT | `on` channel MUST NOT carry state change notifications (INV-2) |

### 6.5 getSnapshot()

Returns the current snapshot synchronously.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SNAP-1 | MUST | `getSnapshot` MUST return the current terminal snapshot synchronously |

### 6.6 dispose()

Disposes the instance and releases all resources.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-DISPOSE-1 | MUST | `dispose` MUST release all internal resources (subscriptions, event listeners, queue) |
| SDK-DISPOSE-2 | MUST | After `dispose`, `dispatch` calls MUST throw `DisposedError` |
| SDK-DISPOSE-3 | MUST | After `dispose`, `subscribe` and `on` calls MUST be no-ops (or throw `DisposedError`) |

### 6.7 Removed Concepts

The following concepts from SDK SPEC v0.2.0 are **removed** in v1.0.0:

| Removed Concept | Rationale | Alternative |
|-----------------|-----------|-------------|
| `ActionHandle` | Coupled to specific execution model | Use `on()` events for per-intent tracking |
| `Session` | Application-level, not protocol-level | Build on top: `withActor(m, actorId)` |
| Hook system | Plugin registration is not protocol concern | Use `on()` event channel |
| Plugin system | Composition via wrapping, not registration | Wrap `ManifestoInstance` |
| `MemoryFacade` | Host-delegated per prior decision | Deferred — not in v3 scope |
| `SystemFacade` | No system meta-operations in protocol core | Removed |
| `AppRef` | Required by hook system (removed) | Removed |
| `AppStatus` lifecycle | Over-engineered for protocol composition | `createManifesto` returns ready instance |
| `ActionPhase` (10 phases) | Over-specified execution model | 3 event types replace 10 phases |
| Branch API | Not protocol core | Deferred — future `@manifesto-ai/branches` |

---

## 7. ManifestoConfig Interface

### 7.1 Type Definition

```typescript
interface ManifestoConfig<T = unknown> {
  /** Required: Domain schema defining state, computed, actions. */
  schema: DomainSchema;

  /** Required: Effect handlers keyed by effect type. */
  effects: Record<string, EffectHandler>;

  /** Optional: World store implementation (default: in-memory). */
  store?: WorldStore;

  /** Optional: Guard function for intent validation (default: schema-derived). */
  guard?: Guard;

  /** Optional: Restore from persisted snapshot. */
  snapshot?: Snapshot<T>;
}
```

### 7.2 Config Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-CONFIG-1 | MUST | `schema` and `effects` MUST be provided |
| SDK-CONFIG-2 | MUST | If `snapshot` is provided, `createManifesto` MUST use it as the initial state (restore scenario) |
| SDK-CONFIG-3 | MUST | If `snapshot` is omitted, `createManifesto` MUST derive genesis snapshot from schema defaults |

---

## 8. Event Channel

### 8.1 Event Types

```typescript
type ManifestoEvent =
  | 'dispatch:completed'   // Intent processed successfully
  | 'dispatch:rejected'    // Guard rejected the intent
  | 'dispatch:failed';     // Effect execution failed
```

### 8.2 Event Payload

```typescript
type ManifestoEventPayload = {
  /** Always present for correlation (INV-6). */
  intentId: string;

  /** The original intent. */
  intent: Intent;

  /** Present on 'dispatch:completed'. */
  snapshot?: Snapshot;

  /** Present on 'dispatch:rejected'. */
  reason?: string;

  /** Present on 'dispatch:failed'. */
  error?: Error;
};
```

### 8.3 Channel Separation

The `on()` method is a **telemetry channel** — it carries intent lifecycle events, not state changes. State observation is exclusively via `subscribe()`.

There is no `snapshot:changed` event. State change notification is NOT an event — it is a subscription.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-CHAN-1 | MUST | `subscribe()` MUST be the sole channel for state change observation |
| SDK-CHAN-2 | MUST | `on()` MUST be the sole channel for intent lifecycle telemetry |
| SDK-CHAN-3 | MUST NOT | `on()` MUST NOT carry `snapshot:changed` or equivalent state change events |

---

## 9. Extension Pattern

### 9.1 Design Principle

Extensions are built **outside** the SDK, not inside it. The SDK MUST NOT provide a plugin registration API. Extensions use the wrapping pattern or compose on top of `dispatch`/`subscribe`/`on`.

### 9.2 Extension Examples

```typescript
// React binding — separate package @manifesto-ai/react
function useManifesto<T, R>(m: ManifestoInstance<T>, selector: Selector<T, R>): R {
  const [value, setValue] = useState(selector(m.getSnapshot()));
  useEffect(() => m.subscribe(selector, setValue), [m, selector]);
  return value;
}

// Middleware — wrapping pattern
function withLogging<T>(m: ManifestoInstance<T>): ManifestoInstance<T> {
  const original = m.dispatch;
  return {
    ...m,
    dispatch: (intent) => {
      console.log('dispatch:', intent);
      original(intent);
    },
  };
}

// AI agent — just dispatch
async function aiAgent<T>(m: ManifestoInstance<T>, llm: LLM) {
  const snapshot = m.getSnapshot();
  const intent = await llm.decide(snapshot);
  m.dispatch(intent);
}

// DevTools — separate package @manifesto-ai/devtools
function connectDevtools<T>(m: ManifestoInstance<T>) {
  m.on('dispatch:completed', ({ intent, snapshot }) => {
    /* send to devtools */
  });
}
```

### 9.3 Extension Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-EXT-1 | MUST NOT | SDK MUST NOT provide plugin registration, hook registration, or middleware pipeline APIs |
| SDK-EXT-2 | MUST | SDK MUST expose a sufficient public interface (`ManifestoInstance`) for external extensions via wrapping |

---

## 10. Re-export Hub

### 10.1 Re-export Structure

```
@manifesto-ai/sdk
  ├─ re-exports from @manifesto-ai/core    (Snapshot, Patch, compute, apply, ...)
  ├─ re-exports from @manifesto-ai/host    (Host types, createHost, ...)
  ├─ re-exports from @manifesto-ai/world   (WorldStore, createWorldStore, ...)
  ├─ re-exports from @manifesto-ai/mel     (compileMel, DomainSchema, ...)
  └─ createManifesto()                      (sole SDK-owned export)
```

### 10.2 Re-export Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-REEXPORT-1 | MUST | SDK MUST re-export all types necessary for users to work with Manifesto without direct protocol package imports |
| SDK-REEXPORT-2 | MUST NOT | SDK MUST NOT re-export internal implementation types from protocol packages |

---

## 11. Invariants

The following invariants are inherited from ADR-010 §2.10 and prior ADRs/SPECs. They MUST be preserved in the `createManifesto` internal wiring.

### 11.1 INV-1: Publish Boundary

`subscribe()` listeners MUST fire **at most once per Intent processing**, and only after the Intent has reached a **terminal snapshot** (completed, rejected, or failed). Intermediate snapshots produced during Host-internal micro-steps MUST NOT be published.

```
dispatch(intent)
  → guard(current, intent)
  → host.process(current, intent)     // may apply() multiple times internally
  → world.append(terminalSnapshot)
  → current = terminalSnapshot
  → notifyListeners(current)           // exactly 1 publish per intent
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INV-1 | MUST | `subscribe()` listeners MUST fire at most once per intent, only at terminal snapshot |

### 11.2 INV-2: Channel Separation

Two distinct channels exist:

| Channel | API | Content | Rule |
|---------|-----|---------|------|
| **State** | `subscribe(selector, listener)` | Snapshot data changes | Fires on terminal snapshot only |
| **Telemetry** | `on(event, handler)` | dispatch:completed, dispatch:rejected, dispatch:failed | Intent lifecycle events |

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INV-2 | MUST | State and telemetry channels MUST remain distinct; no crossover |

### 11.3 INV-3: Platform Namespace Injection

`createManifesto` MUST inject `$host` and `$mel` namespaces into the schema and normalize the initial snapshot before use.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INV-3 | MUST | `createManifesto` MUST inject platform namespaces and normalize snapshot |

### 11.4 INV-4: Reserved Effect Protection

`createManifesto` MUST provide built-in effects for reserved system types and MUST reject user effects that attempt to override them.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INV-4 | MUST | Reserved effects MUST be protected; user override MUST throw `ReservedEffectError` |

### 11.5 INV-5: Intent Serialization and Guard Freshness

`createManifesto` MUST serialize intent processing internally:

1. Intents are enqueued (internal queue — not an exposed concept).
2. Guard evaluation occurs at **dequeue time** against the **current** snapshot (not the snapshot at enqueue time).
3. Host processing is sequential — no concurrent intent execution.
4. Terminal snapshot publish occurs after each intent completes.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INV-5 | MUST | Intents MUST be processed serially; guard MUST evaluate against current snapshot at dequeue time |

### 11.6 INV-6: Intent Identity

`dispatch()` MUST internally enrich intents with:

- `intentId`: Auto-generated unique identifier (if not provided by caller).
- `meta.timestamp`: Processing timestamp.
- `meta.randomSeed`: Deterministic seed derived from intentId.

All telemetry events MUST include `intentId` in their payload for correlation.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INV-6 | MUST | All dispatched intents MUST have `intentId`; all event payloads MUST include `intentId` |

---

## 12. Error Types

### 12.1 Error Hierarchy

```typescript
/** Base error for all SDK errors. */
class ManifestoError extends Error {
  readonly code: string;
}

/** Thrown when user effects attempt to override reserved effect types. */
class ReservedEffectError extends ManifestoError {
  readonly code = 'RESERVED_EFFECT';
  readonly effectType: string;
}

/** Thrown when dispatch is called on a disposed instance. */
class DisposedError extends ManifestoError {
  readonly code = 'DISPOSED';
}
```

### 12.2 Error Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ERR-1 | MUST | All SDK errors MUST extend `ManifestoError` |
| SDK-ERR-2 | MUST | `ReservedEffectError` MUST include the attempted effect type |
| SDK-ERR-3 | MUST | `DisposedError` MUST be thrown on post-dispose dispatch |

---

## 13. Compliance

An implementation is compliant with SDK SPEC v1.0.0 when all of the following hold:

- [ ] `createManifesto()` returns a ready-to-use `ManifestoInstance` (SDK-FACTORY-1)
- [ ] Platform namespaces injected into schema (SDK-FACTORY-2, SDK-INV-3)
- [ ] Initial snapshot normalized (SDK-FACTORY-3)
- [ ] Reserved effects protected (SDK-FACTORY-4, SDK-FACTORY-5, SDK-INV-4)
- [ ] `dispatch()` enqueues intents with serial processing (SDK-DISPATCH-1, SDK-INV-5)
- [ ] `dispatch()` enriches intents with `intentId` (SDK-DISPATCH-2, SDK-INV-6)
- [ ] `subscribe()` fires only at terminal snapshot, at most once per intent (SDK-SUB-1, SDK-SUB-2, SDK-INV-1)
- [ ] `on()` carries only telemetry events, not state changes (SDK-EVENT-3, SDK-CHAN-3, SDK-INV-2)
- [ ] All event payloads include `intentId` (SDK-EVENT-2, SDK-INV-6)
- [ ] `dispose()` releases resources and rejects subsequent dispatches (SDK-DISPOSE-1, SDK-DISPOSE-2)
- [ ] SDK owns exactly one concept: `createManifesto` (SDK-ROLE-1)
- [ ] SDK re-exports necessary protocol package types (SDK-REEXPORT-1)
- [ ] No plugin, hook, or middleware registration APIs exist (SDK-EXT-1)

---

## 14. Migration from v0.2.0

### 14.1 API Migration Table

| v0.2.0 | v1.0.0 (ADR-010) |
|--------|-------------------|
| `createApp({ schema, effects })` | `createManifesto({ schema, effects })` |
| `app.act('type', input)` → ActionHandle | `m.dispatch({ type, ...input })` |
| `await handle.done()` | `m.on('dispatch:completed', handler)` or `await dispatchAsync(m, intent)` |
| `app.getState()` | `m.getSnapshot()` |
| `app.subscribe(selector, cb)` | `m.subscribe(selector, cb)` |
| `app.hooks.on('action:completed', ...)` | `m.on('dispatch:completed', handler)` |
| `app.session('actor-1').act(...)` | Build on top: `withActor(m, 'actor-1').dispatch(...)` |
| `app.use(plugin)` | Build on top: `withPlugin(m, plugin)` |
| `app.ready()` | Not needed — `createManifesto` returns ready instance |
| `app.dispose()` | `m.dispose()` |

### 14.2 Runtime Retirement

Runtime SPEC v0.2.0 is **superseded with no successor**. Runtime responsibilities are absorbed as follows:

| Runtime Responsibility | New Home |
|-----------------------|----------|
| Execution pipeline | `createManifesto` dispatch path |
| HostExecutor bridge | `createManifesto` internal wiring |
| PolicyService | `@manifesto-ai/world` (governance) |
| SubscriptionStore | `createManifesto` subscribe implementation |
| MemoryHub | Deferred — not in v3 scope |
| BranchManager | Deferred — future extension package |
| SchemaRegistry | Not needed — single schema per instance |
| ActionQueue / SystemRuntime | `createManifesto` dispatch serialization |

### 14.3 dispatchAsync Convenience (Non-Normative)

For users migrating from `await handle.done()`, a `dispatchAsync` utility can be built on top:

```typescript
function dispatchAsync<T>(m: ManifestoInstance<T>, intent: Intent): Promise<Snapshot<T>> {
  return new Promise((resolve, reject) => {
    const enriched = enrichIntent(intent);
    const unsub = m.on('dispatch:completed', (e) => {
      if (e.intentId === enriched.intentId) { unsub(); unsubFail(); resolve(e.snapshot!); }
    });
    const unsubFail = m.on('dispatch:failed', (e) => {
      if (e.intentId === enriched.intentId) { unsub(); unsubFail(); reject(e.error); }
    });
    m.dispatch(enriched);
  });
}
```

This is a convenience utility, not a protocol primitive. It can be added to SDK without violating the "one owned concept" rule because it is derived entirely from `dispatch` + `on`.

---

## 15. References

### 15.1 Specifications

| Document | Version | Relevance |
|----------|---------|-----------|
| Core SPEC | v3.0.0 (Living Document) | Snapshot, Patch, compute, apply, DomainSchema |
| Host Contract | v3.0.0 (Living Document) | Execution model, effect handlers, HostContext |
| World Protocol | v3.0.0 (Living Document) | Governance, lineage, WorldStore |
| Compiler SPEC | v0.6.0 | MEL → DomainSchema, IRPatchPath |

### 15.2 Architecture Decision Records

| ADR | Scope |
|-----|-------|
| ADR-010 | Protocol-First SDK Reconstruction (primary) |
| ADR-006 | Publish Boundary, Canonicalization, Channel Separation |
| ADR-001 | Layer Separation |
| ADR-009 | Structured PatchPath (Segments) |
| ADR-011 | Host Boundary Reset Completeness Policy |

### 15.3 Superseded Documents

| Document | Status |
|----------|--------|
| SDK SPEC v0.2.0 | Superseded by this document |
| SDK SPEC v0.1.0 | Superseded by this document |
| Runtime SPEC v0.2.0 | Superseded — no successor (absorbed into SDK) |
| Runtime SPEC v0.1.0 | Superseded — no successor (absorbed into SDK) |

---

*End of Manifesto SDK Specification v1.0.0*
