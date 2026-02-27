# ADR-010: Protocol-First SDK Reconstruction

> **Status:** Proposed
> **Date:** 2026-02-27
> **Deciders:** 정성우, Manifesto Architecture Team
> **Scope:** Global (SDK, Runtime, Core, Host, World, MEL/Compiler)
> **Supersedes:** ADR-007 (SDK/Runtime Split Kickoff), ADR-008 (SDK-First Transition), SDK-SPEC v0.1.0, Runtime-SPEC v0.1.0
> **Related:** ADR-001 (Layer Separation), ADR-006 (PUB/CHAN/CAN)

---

## 1. Context

### 1.1 The Layering Problem

ADR-007 and ADR-008 decomposed `@manifesto-ai/app` into SDK + Runtime, treating the split as a structural improvement. In practice, this introduced two new layers (SDK, Runtime), each generating its own concepts:

| SDK-originated concept | Runtime-originated concept |
|----------------------|--------------------------|
| ActionHandle | ExecutionPipeline |
| Session | HostExecutor |
| Hook system | PolicyService |
| Plugin system | MemoryHub |
| SystemFacade | BranchManager |
| MemoryFacade | SchemaRegistry |
| AppRef | ActionQueue |
| AppStatus lifecycle | SubscriptionStore |

These concepts exist only in the "binding layer" — they are not present in Core, Host, World, or MEL/Compiler. Every time we add a binding layer (App → SDK+Runtime → next), the layer invents concepts to justify its existence, increasing the surface area users must learn.

### 1.2 The Identity Question

During v3 pre-planning, a foundational question emerged: what _is_ Manifesto?

The answer is not "a state management library" or "an agent framework" — these are applications _of_ the protocol. Manifesto's essential value is:

> **모든 참여자(인간, AI, 시스템)가 하나의 세계를 공유하고, 그 위에서 행동할 수 있도록 하는 프로토콜.**

This means Manifesto is closer to HTTP than Redux. State management, agent frameworks, and web applications are built _on top of_ the protocol — they are not the protocol itself.

### 1.3 Protocol Axis Audit

An audit of the four protocol packages revealed:

| Package | Protocol Essence | Status |
|---------|-----------------|--------|
| **Core** | Snapshot + Patch + compute/apply | Clean — no contamination |
| **Host** | (Snapshot, Intent) → terminal Snapshot | Clean — mailbox/runner are implementation detail |
| **MEL/Compiler** | World expression language + Schema compilation | Clean — v0.5.0 features are pure expressiveness |
| **World** | Snapshot lineage (history) | Governance mixed in — but addressable separately |

The four protocol axes are architecturally sound. The problem is exclusively in the layer that _binds them together_ — the former App, now SDK+Runtime.

### 1.4 Prior Art

Research into how other frameworks solve the "binding layer" problem reveals a spectrum:

| Pattern | Example | How it binds | Manifesto fit |
|---------|---------|-------------|---------------|
| Thin function + middleware | Zustand | `create()` — no binding concepts | Minimal but no structure |
| setup/provide/createActor | XState v5 | Declaration → injection → instance | Strong fit (FSM-based, typed) |
| Plugin encapsulation | Fastify | Scoped plugin tree | Too heavyweight |
| Web Standard interface | Hono | fetch API is the interface | Not applicable |

Manifesto's situation — multiple internal layers, FSM-based state, implementation-swappable components — maps most closely to **XState v5's 3-stage pattern** (setup → provide → createActor), combined with **Zustand's minimalist API surface**.

---

## 2. Decision

### 2.1 Manifesto Is a Protocol

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

### 2.2 SDK Becomes a Thin Composition Layer

`@manifesto-ai/sdk` is reconstructed as a **re-export hub + single composition function**:

```typescript
// User installs one package:
// npm i @manifesto-ai/sdk

import {
  createManifesto,   // sole composition function (SDK-owned)
  compileMel,        // re-export from @manifesto-ai/mel
  createWorldStore,  // re-export from @manifesto-ai/world
  createGuard,       // re-export from @manifesto-ai/world
  // ... type re-exports from core, host, world, mel
} from '@manifesto-ai/sdk'
```

Internal structure:

```
@manifesto-ai/sdk
  ├─ re-exports from @manifesto-ai/core    (Snapshot, Patch, compute, apply, ...)
  ├─ re-exports from @manifesto-ai/host    (Host types, createHost, ...)
  ├─ re-exports from @manifesto-ai/world   (WorldStore, createWorldStore, ...)
  ├─ re-exports from @manifesto-ai/mel     (compileMel, DomainSchema, ...)
  └─ createManifesto()                      (sole SDK-owned export)
```

**SDK ownership rule:** `@manifesto-ai/sdk` owns exactly one concept — `createManifesto`. All other exports are re-exports from protocol packages. The SDK MUST NOT invent new concepts (no ActionHandle, Session, Hook, Plugin, Facade, Registry, or equivalent).

### 2.3 createManifesto API

```typescript
interface ManifestoConfig<T = unknown> {
  // Required
  schema: DomainSchema;
  effects: Record<string, EffectHandler>;

  // Optional — swappable implementations
  store?: WorldStore;          // default: in-memory
  guard?: Guard;               // default: schema-derived

  // Optional — restore from persisted state
  snapshot?: Snapshot<T>;
}

interface ManifestoInstance<T = unknown> {
  dispatch(intent: Intent): void;
  subscribe(selector: Selector<T, R>, listener: (value: R) => void): Unsubscribe;
  on(event: ManifestoEvent, handler: EventHandler): Unsubscribe;
  getSnapshot(): Snapshot<T>;
  dispose(): void;
}

function createManifesto<T>(config: ManifestoConfig<T>): ManifestoInstance<T>;
```

### 2.4 createManifesto Internal Wiring

`createManifesto` connects the four protocol axes and fulfills inherited protocol invariants (§2.10):

```typescript
function createManifesto<T>(config: ManifestoConfig<T>): ManifestoInstance<T> {
  const { schema, effects, store, guard, snapshot } = config;

  // INV-3: Platform namespace injection
  const enrichedSchema = withPlatformNamespaces(schema);

  // INV-4: Reserved effect protection + merge
  const mergedEffects = mergeWithReservedEffects(effects);

  // INV-3: Snapshot normalization (ensures $mel.guards.intent.* exists)
  const initialSnapshot = normalizeSnapshot(
    snapshot ?? Core.createSnapshot(enrichedSchema)
  );

  // Assemble protocol components
  const host = createHost({
    schema: enrichedSchema,
    effects: mergedEffects,
    compute: Core.compute,
    apply: Core.apply,
  });
  const world = createWorld({
    store: store ?? createMemoryStore(),
    initial: initialSnapshot,
  });
  const guardFn = guard ?? createSchemaGuard(enrichedSchema);

  // Mutable state
  let current = initialSnapshot;
  let processing = false;
  const intentQueue: EnrichedIntent[] = [];  // INV-5
  const stateListeners = new Set();
  const eventListeners = new Map();

  async function processNext() {
    if (processing || intentQueue.length === 0) return;
    processing = true;
    const enriched = intentQueue.shift()!;

    // INV-5: Guard evaluates at dequeue time against current snapshot
    const verdict = guardFn(current, enriched);
    if (!verdict.ok) {
      emit('dispatch:rejected', {
        intentId: enriched.intentId, intent: enriched, reason: verdict.reason,
      });
      processing = false;
      processNext();
      return;
    }

    try {
      const result = await host.process(current, enriched);
      // INV-1: Only terminal snapshot published (1 publish per intent)
      world.append(result.snapshot, { intent: enriched, patches: result.patches });
      current = result.snapshot;
      notifyListeners(stateListeners, current);  // exactly 1 publish
      emit('dispatch:completed', {
        intentId: enriched.intentId, intent: enriched, snapshot: current,
      });
    } catch (error) {
      emit('dispatch:failed', {
        intentId: enriched.intentId, intent: enriched, error,
      });
    }

    processing = false;
    processNext();
  }

  return {
    dispatch(intent) {
      // INV-6: Enrich with intentId, timestamp, randomSeed
      const enriched = enrichIntent(intent);
      intentQueue.push(enriched);
      processNext();
    },
    subscribe(selector, listener) { /* INV-2: state channel only */ },
    on(event, handler) { /* INV-2: telemetry channel only */ },
    getSnapshot() { return current; },
    dispose() { /* cleanup */ },
  };
}
```

This function is the **sole integration point**. It is ~150–250 lines, not a framework. All `INV-*` annotations reference §2.10 for traceability.

### 2.5 Runtime Package Retirement

`@manifesto-ai/runtime` is **retired**. Its responsibilities are redistributed:

| Runtime responsibility | New home |
|-----------------------|----------|
| Execution pipeline (prepare→authorize→execute→persist→finalize) | Absorbed into `createManifesto` dispatch path |
| HostExecutor bridge | Absorbed into `createManifesto` internal wiring |
| PolicyService (ExecutionKey derivation) | Moved to `@manifesto-ai/world` (governance) |
| SubscriptionStore | Absorbed into `createManifesto` subscribe implementation |
| MemoryHub | Deferred — not in v3 scope (host-delegated per prior decision) |
| BranchManager | Deferred — future `@manifesto-ai/branches` or World extension |
| SchemaRegistry | Not needed — single schema per instance |
| ActionQueue / System Runtime | Absorbed into `createManifesto` dispatch serialization |

### 2.6 SDK-SPEC v0.1.0 Concepts Disposition

| SDK v0.1.0 Concept | v3 Disposition | Rationale |
|--------------------|---------------|-----------|
| `createApp()` | → `createManifesto()` | Renamed to reflect protocol identity |
| `App` interface | → `ManifestoInstance` | Thinner — dispatch/subscribe/on/getSnapshot/dispose only |
| `ActionHandle` | **Removed** | dispatch is fire-and-forget; results come via subscribe/on |
| `Session` | **Removed** | Actor-scoping is not protocol-level; can be built on top |
| Hook system | **Removed** | Use `on()` event channel; richer hooks are ecosystem packages |
| Plugin system | **Removed** | Composition via wrapping, not plugin registration |
| `MemoryFacade` | **Removed** | Host-delegated per prior decision |
| `SystemFacade` | **Removed** | No system.* meta-operations in protocol core |
| `AppRef` | **Removed** | No hook system = no AppRef |
| `AppStatus` lifecycle | **Simplified** | No `ready()` step; createManifesto returns ready instance |
| `ActionPhase` (10 phases) | **Removed** | Replaced by event channel (dispatch:rejected, dispatch:failed, dispatch:completed) |
| Branch API | **Deferred** | Not protocol core; future extension package |
| World Query API | **Simplified** | `getSnapshot()` is the query; World lineage via store |

### 2.7 Extension Pattern

Extensions are built **outside** the SDK, not inside it:

```typescript
// React binding — separate package @manifesto-ai/react
function useManifesto<T, R>(m: ManifestoInstance<T>, selector: Selector<T, R>): R {
  const [value, setValue] = useState(selector(m.getSnapshot()));
  useEffect(() => m.subscribe(selector, setValue), [m, selector]);
  return value;
}

// Middleware — wrapping pattern (no plugin system needed)
function withLogging<T>(m: ManifestoInstance<T>): ManifestoInstance<T> {
  const original = m.dispatch;
  return { ...m, dispatch: (intent) => { console.log('→', intent); original(intent); } };
}

// AI agent — just dispatch
async function aiAgent<T>(m: ManifestoInstance<T>, llm: LLM) {
  const snapshot = m.getSnapshot();
  const intent = await llm.decide(snapshot);
  m.dispatch(intent);
}

// DevTools — separate package @manifesto-ai/devtools
function connectDevtools<T>(m: ManifestoInstance<T>) {
  m.on('dispatch:completed', ({ intent, snapshot }) => { /* send to devtools */ });
}
```

### 2.8 Event Channel (Telemetry Only)

The `on()` method is a **telemetry channel** — it carries Intent lifecycle events, not state changes. State observation is exclusively via `subscribe()` (see INV-2 for rationale).

```typescript
type ManifestoEvent =
  | 'dispatch:completed'   // intent processed successfully
  | 'dispatch:rejected'    // guard rejected the intent
  | 'dispatch:failed'      // effect execution failed

type ManifestoEventPayload = {
  intentId: string;        // always present for correlation (INV-6)
  intent: Intent;
  snapshot?: Snapshot;     // present on completed
  reason?: string;         // present on rejected
  error?: Error;           // present on failed
}
```

This is intentionally minimal. The number of events may grow in future versions, but the pattern (string event + typed payload with intentId) is stable. State change notification is NOT an event — it is a subscription (ADR-006 CHAN-1 compliance).

### 2.9 Protocol Package Stability

The four protocol packages (Core, Host, World, MEL/Compiler) undergo **no breaking changes** in this reconstruction:

| Package | Breaking changes | Notes |
|---------|-----------------|-------|
| Core | None | Snapshot, Patch, compute, apply unchanged |
| Host | None | processIntent contract unchanged |
| World | Minor additive | May add `append()` convenience if not present |
| MEL/Compiler | None | compileMel, DomainSchema unchanged |

All disruption is confined to the SDK surface and the retired Runtime.

### 2.10 Implementation Invariants (MUST)

The following invariants are inherited from existing ADRs/SPECs and MUST be preserved in the `createManifesto` internal wiring. These do not introduce new concepts — they are protocol obligations that the retired Runtime previously fulfilled.

#### INV-1: Publish Boundary (from ADR-006 PUB rules)

`subscribe()` listeners MUST fire **at most once per Intent processing**, and only after the Intent has reached a **terminal snapshot** (completed, rejected, or failed). Intermediate snapshots produced during Host-internal micro-steps (multiple apply cycles) MUST NOT be published.

```
dispatch(intent)
  → guard(current, intent)
  → host.process(current, intent)     // may apply() multiple times internally
  → world.append(terminalSnapshot)
  → current = terminalSnapshot
  → notifyListeners(current)           // exactly 1 publish per intent
```

#### INV-2: Channel Separation (from ADR-006 CHAN-1)

Two distinct channels exist:

| Channel | API | Content | Rule |
|---------|-----|---------|------|
| **State** | `subscribe(selector, listener)` | Snapshot data changes | Fires on terminal snapshot only |
| **Telemetry** | `on(event, handler)` | dispatch:completed, dispatch:rejected, dispatch:failed | Intent lifecycle events |

The `snapshot:changed` event is **removed** from the `on()` channel. State observation is exclusively via `subscribe()`. This prevents channel semantics from mixing.

```typescript
type ManifestoEvent =
  | 'dispatch:completed'   // intent processed successfully
  | 'dispatch:rejected'    // guard rejected the intent
  | 'dispatch:failed'      // effect execution failed
```

#### INV-3: Platform Namespace Injection (from ADR-002)

`createManifesto` MUST inject `$host` and `$mel` namespaces into the schema and normalize the initial snapshot before use:

```typescript
// Inside createManifesto — mandatory preprocessing
const enrichedSchema = withPlatformNamespaces(schema);   // inject $host, $mel
const normalizedSnapshot = normalizeSnapshot(
  snapshot ?? Core.createSnapshot(enrichedSchema)
);   // ensure $mel.guards.intent.* structure exists for onceIntent
```

This ensures `onceIntent` guards and deep path patches against `$mel.guards.intent.*` do not fail on missing structure.

#### INV-4: Reserved Effect Protection (from Compiler/Runtime contract)

`createManifesto` MUST provide built-in effects for reserved system types and MUST reject user `effects` that attempt to override them:

```typescript
const RESERVED_EFFECTS = {
  'system.get': builtinSystemGet,
  // ... other reserved effect types
};

// Inside createManifesto
for (const key of Object.keys(config.effects)) {
  if (key in RESERVED_EFFECTS) {
    throw new ManifestoError(`Effect "${key}" is reserved and cannot be overridden`);
  }
}
const mergedEffects = { ...RESERVED_EFFECTS, ...config.effects };
```

#### INV-5: Intent Serialization and Guard Freshness

`createManifesto` MUST serialize Intent processing internally. When multiple `dispatch()` calls occur in rapid succession:

1. Intents are enqueued (internal queue — not an exposed concept).
2. Guard evaluation occurs at **dequeue time** against the **current** snapshot (not the snapshot at enqueue time).
3. Host processing is sequential — no concurrent Intent execution.
4. Terminal snapshot publish occurs after each Intent completes.

This prevents stale-snapshot guard evaluation and race conditions without exposing queue semantics to the user.

#### INV-6: Intent Identity (from Host/MEL contract)

`dispatch()` MUST accept a user-provided Intent and internally enrich it with:

- `intentId`: Auto-generated unique identifier (if not provided by caller).
- `meta.timestamp`: Processing timestamp.
- `meta.randomSeed`: Deterministic seed derived from intentId (per Core SPEC).

All telemetry events (`dispatch:completed`, `dispatch:rejected`, `dispatch:failed`) MUST include `intentId` in their payload for correlation.

```typescript
// Corrected dispatchAsync using intentId (not object identity)
function dispatchAsync<T>(m: ManifestoInstance<T>, intent: Intent): Promise<Snapshot<T>> {
  return new Promise((resolve, reject) => {
    const enriched = enrichIntent(intent);  // adds intentId
    const unsub = m.on('dispatch:completed', (e) => {
      if (e.intentId === enriched.intentId) { unsub(); resolve(e.snapshot); }
    });
    const unsubFail = m.on('dispatch:failed', (e) => {
      if (e.intentId === enriched.intentId) { unsubFail(); reject(e.error); }
    });
    m.dispatch(enriched);
  });
}
```

---

## 3. Architectural Diagram

### 3.1 Before (SDK-SPEC v0.1.0 + Runtime-SPEC v0.1.0)

```
┌──────────────────────────────────────────────┐
│  User Code                                    │
│  const app = createApp({ schema, effects })   │
│  const handle = app.act('todo:add', { ... })  │
│  app.session('user-1').act(...)               │
│  app.hooks.on('action:completed', ...)        │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│  SDK Layer — 17 sections of SPEC              │
│  ActionHandle, Session, Hook, Plugin,         │
│  MemoryFacade, SystemFacade, AppRef,          │
│  AppStatus, ActionPhase, Branch API...        │
└──────────────────┬───────────────────────────┘
                   │ delegates to
┌──────────────────▼───────────────────────────┐
│  Runtime Layer — 18 sections of SPEC          │
│  Pipeline, HostExecutor, PolicyService,       │
│  MemoryHub, BranchManager, SchemaRegistry,    │
│  ActionQueue, SubscriptionStore...            │
└──────────────────┬───────────────────────────┘
                   │ uses
         ┌─────────┼─────────┬─────────┐
         ▼         ▼         ▼         ▼
      [Core]    [Host]    [World]   [MEL]
```

**Problem:** Two intermediate layers with 35 combined SPEC sections, ~25 invented concepts.

### 3.2 After (ADR-010)

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

**Result:** One boundary, one composition function, zero invented concepts.

---

## 4. Consequences

### 4.1 Positive

1. **User learning curve drops radically.** From ~25 SDK+Runtime concepts to 5 methods (dispatch, subscribe, on, getSnapshot, dispose).
2. **Protocol identity is clear.** "Manifesto is a protocol. `createManifesto()` assembles it."
3. **No breaking changes to protocol packages.** Core, Host, World, MEL/Compiler are untouched.
4. **Extension is natural.** React bindings, devtools, AI agents — all built on top via wrapping/subscribing, not via plugin/hook registration.
5. **Testing is trivial.** `createManifesto` with in-memory defaults = test instance.
6. **The "framework treadmill" stops.** No more App → SDK+Runtime → next binding layer.

### 4.2 Trade-offs

1. **ActionHandle convenience is lost.** Users who want per-action tracking must build it from `on()` events. This is an intentional trade — ActionHandle was convenient but coupled to a specific execution model.
2. **Session is lost.** Actor-scoped contexts must be built on top. This is acceptable because Sessions are application-level, not protocol-level.
3. **Hook/Plugin ecosystems don't exist yet.** The wrapping pattern is more flexible but less discoverable than a plugin registry. Ecosystem packages (`@manifesto-ai/react`, `@manifesto-ai/devtools`) will fill this gap.
4. **Historical ADR/SPEC chain is disrupted.** SDK-SPEC v0.1.0 and Runtime-SPEC v0.1.0 become historical artifacts. New SDK-SPEC v1.0.0 will be dramatically smaller.

### 4.3 Risks

1. **"Too minimal" perception.** Developers accustomed to feature-rich frameworks may feel Manifesto lacks features. Mitigation: clear documentation showing extension patterns, and ecosystem packages for common needs.
2. **dispatch() is synchronous but effects are async.** The `dispatch → on('dispatch:completed')` pattern is less ergonomic than `await handle.done()`. Mitigation: consider `dispatchAsync()` as a convenience that returns a Promise, built on top of `dispatch` + `on`.

---

## 5. Non-Goals

This ADR does NOT:

- Change Core SPEC, Host Contract, or MEL/Compiler SPEC.
- Define the World governance separation (lineage vs. governance) — that is a separate concern for World SPEC evolution.
- Define React/Vue/Svelte bindings — these are ecosystem packages.
- Define AI agent patterns — these are built on top of dispatch/subscribe.
- Introduce new protocol primitives.

---

## 6. Migration

### 6.1 From SDK-SPEC v0.1.0

| v0.1.0 | v1.0.0 (ADR-010) |
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

### 6.2 From Runtime-SPEC v0.1.0

Runtime is fully absorbed. No migration path — internal consumers switch to `createManifesto` internals.

---

## 7. Implementation Markers

ADR-010 is considered implemented when:

### 7.1 Structural Gates

1. `@manifesto-ai/sdk` exports `createManifesto` as its sole owned concept.
2. `@manifesto-ai/sdk` re-exports all necessary types from Core, Host, World, MEL.
3. `@manifesto-ai/runtime` package is removed from workspace.
4. SDK-SPEC v0.1.0 is marked as superseded by SDK-SPEC v1.0.0.
5. Runtime-SPEC v0.1.0 is marked as superseded (no successor — absorbed).
6. User-facing documentation uses `createManifesto` as canonical entry point.
7. Protocol packages (Core, Host, World, MEL) have zero breaking changes.

### 7.2 Invariant Compliance (MUST)

| INV | Description | Verification |
|-----|-------------|--------------|
| INV-1 | Terminal snapshot only, 1 publish per intent | Test: multi-step effect produces exactly 1 subscriber notification |
| INV-2 | `subscribe()` = state, `on()` = telemetry, no crossover | Test: no `snapshot:changed` event exists; state changes only via subscribe |
| INV-3 | `$host`/`$mel` injected into schema, snapshot normalized on create/restore | Test: `onceIntent` guard works without user providing `$mel` structure |
| INV-4 | Reserved effects merged, user override throws | Test: `effects: { 'system.get': ... }` throws `ManifestoError` |
| INV-5 | Intent queue, guard at dequeue time, serial processing | Test: rapid `dispatch()` × 3, guard evaluates against post-previous-intent state |
| INV-6 | `intentId` auto-generated, present in all event payloads | Test: `on('dispatch:completed', e => e.intentId)` is always defined |

---

## 8. Future Considerations (Non-Normative)

### 8.1 dispatchAsync Convenience

```typescript
// Could live in @manifesto-ai/sdk as a utility, not a core concept
function dispatchAsync<T>(m: ManifestoInstance<T>, intent: Intent): Promise<Snapshot<T>> {
  return new Promise((resolve, reject) => {
    const enriched = enrichIntent(intent);  // adds intentId if missing
    const unsub = m.on('dispatch:completed', (e) => {
      if (e.intentId === enriched.intentId) { unsub(); unsubFail(); resolve(e.snapshot); }
    });
    const unsubFail = m.on('dispatch:failed', (e) => {
      if (e.intentId === enriched.intentId) { unsub(); unsubFail(); reject(e.error); }
    });
    m.dispatch(enriched);
  });
}
```

Note: correlation uses `intentId` (INV-6), not object identity. This is a convenience, not a protocol primitive. It can be added to SDK without violating the "one owned concept" rule because it is derived entirely from `dispatch` + `on`.

### 8.2 Ecosystem Packages

| Package | Purpose | Priority |
|---------|---------|----------|
| `@manifesto-ai/react` | React hooks for ManifestoInstance | High |
| `@manifesto-ai/devtools` | State inspection, time-travel | Medium |
| `@manifesto-ai/branches` | Branch management on top of World | Future |
| `@manifesto-ai/governance` | Authority, Policy, Guard composition | Future |
| `@manifesto-ai/agent` | AI agent patterns | Future |

### 8.3 XState Structural Correspondence (Non-Normative)

For developers familiar with XState v5, the correspondence is:

```
XState v5                              Manifesto v3
────────────────────────────────────────────────────
setup({ actors, actions, guards })     compileMel(source) → Schema
  └─ .createMachine({ states, on })      └─ DomainSchema (pure data)

machine.provide({ actions: custom })   createManifesto({ effects, guard, store })
  └─ implementation injection              └─ implementation injection

createActor(machine, { input })        createManifesto({ snapshot: saved })
  └─ instance creation + restore           └─ instance creation + restore

actor.send({ type })                   manifesto.dispatch(intent)
actor.subscribe(cb)                    manifesto.subscribe(selector, cb)
actor.getSnapshot()                    manifesto.getSnapshot()
actor.stop()                           manifesto.dispose()
```

---

*End of ADR-010*
