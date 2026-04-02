# ADR-017: Capability Decorator Pattern — Semantic Transformation of SDK Surface

> **Status:** Implemented
> **Date:** 2026-04-01 (v3.1 — activate() one-shot + config precedence rules)
> **Deciders:** 정성우 (Architect)
> **Scope:** SDK, Lineage, Governance
> **Supersedes:** SDK SPEC v1.0.0 `ManifestoInstance` interface shape (§6)
> **Preserves:** All protocol packages (Core, Host, Lineage, Governance, Compiler) — zero changes
> **Historical Draft:** [ADR-017 v2](./archive/017-capability-decorator-pattern-v2-cross-model-review-consensus.md) (cross-model review consensus, preserved for traceability)

> **Current Contract Authority:** When this ADR differs from the current runtime surface, follow the package-level current specs and version indexes for `@manifesto-ai/sdk`, `@manifesto-ai/lineage`, and `@manifesto-ai/governance`. This ADR is retained as the architectural decision record and activation-first rationale.
>
> **Known Current Divergences:** Parts of this ADR still describe an earlier decorator variant in which lineage kept a lineage-aware `dispatchAsync` and governance could auto-ensure lineage from a base composable. The current implemented contract instead uses `dispatchAsync -> commitAsync -> proposeAsync`, requires explicit `withLineage()` before `withGovernance()`, and is normatively defined by the package specs.

---

## Revision History

| Version | Date | Change | Document |
|---------|------|--------|----------|
| v2 | 2026-04-01 | Cross-model review consensus draft; lineage verb was still `commitAsync`; activation boundary not yet adopted | [Archived draft](./archive/017-capability-decorator-pattern-v2-cross-model-review-consensus.md) |
| v3.0 | 2026-04-01 | Activation boundary introduced; `createManifesto()` returns a composable manifesto and runtime verbs appear only after `activate()` | This document |
| v3.1 | 2026-04-01 | `activate()` one-shot enforcement and Governance/Lineage config precedence rules clarified | This document |

---

## 1. Context

### 1.1 The Problem SDK v1.0.0 Solved

ADR-010 removed 20+ binding-layer concepts (ActionHandle, Session, Hook, Plugin, Facade, Registry) and reduced the SDK to `createManifesto()` returning a 5-method `ManifestoInstance`. This was the correct hard cut — it created a clean surface to build on.

### 1.2 The Problem That Remains

The issue is not whether an instance exists. The issue is that **instance shape is static** — it cannot express capability differences between base, lineage, and governance configurations at the type level.

Four structural problems follow:

**P1: Type chain is severed.** The domain generic `<T>` exists on `createManifesto<T>` but does not propagate to `createIntent`, `subscribe` selectors, or `getAvailableActions` return types.

**P2: Lineage is invisible.** When a consumer adds `store` to config, `ManifestoInstance` returns the same 7 methods. No lineage API appears in autocomplete. This is the direct cause of Codex not using lineage (2026-04-01 evidence: `ManifestoInstance` autocomplete shows 7 methods, 0 lineage-related).

**P3: Governance cannot remove capabilities.** Under governance, `dispatch` should not exist — only `propose`. But `ManifestoInstance` always has `dispatch`. Governance constraints can only be enforced at runtime, not at the type level.

**P4: Semantic identity of actions is lost.** In the pre-activation static interface, a single execution verb had to stand in for materially different world laws. In a lineage world, execution without seal is a meaningless operation — but the API could not express that distinction.

### 1.3 Root Cause

`ManifestoInstance` is a **static shape** that cannot vary with configuration. The same interface is returned regardless of world type. TypeScript's type system can express configuration-dependent return types, but v1.0.0's design does not use this capability.

### 1.4 Design Origin

This ADR originates from hands-on consumer testing by the framework architect. The key insight — **"each layer does not add features but transforms the world's operating law, and this transformation must be expressed as verb replacement at the type level"** — derives from Manifesto's specific ontology and cannot be produced by pattern recombination from existing frameworks.

---

## 2. Core Insight: Two-Phase Composition

This ADR introduces two distinct phases in the lifecycle of a Manifesto world:

### 2.1 Phase 1: Law Composition (Pre-Activation)

`createManifesto()` and every `with*` function produce a **composable manifesto** — an object that accumulates world laws but does not yet have a running world. No runtime verbs (`dispatchAsync`, `commitAsync`, `proposeAsync`) exist in this phase.

### 2.2 Phase 2: Runtime Execution (Post-Activation)

`activate()` converts the composable manifesto into a **runtime world instance** — the final, executable world whose capability surface is determined by the laws composed in Phase 1.

### 2.3 Verb Promotion

The central design principle:

> Each architectural layer does not add a verb. It **promotes** the previous layer's verb into a richer one, and the previous verb ceases to exist.

```
Base world     → dispatchAsync   (execute intent, get terminal snapshot)
                    ↓ promoted
Lineage world  → commitAsync     (execute intent + seal into lineage DAG)
                    ↓ promoted
Governed world → proposeAsync    (submit proposal for authority judgment;
                                  full lawful path: propose → approve/reject → sealed execution)
```

**Why the previous verb disappears:**

- In a lineage world, base dispatch without seal is meaningless. An unrecorded state transition does not exist in a world with history. Therefore, the base `dispatchAsync` must be replaced by `commitAsync`.
- In a governed world, direct execution is constitutionally illegitimate. Therefore, `commitAsync` must be replaced by `proposeAsync`.

This is not feature toggling. This is **semantic transformation of the world's operating law**.

### 2.4 Why Two Phases Solve the Backdoor Problem

In v2.x of this ADR, `with*` functions consumed runtime instances — objects that already had `dispatchAsync`. This created an unsolvable reference-escape problem:

```typescript
// v2.x design flaw — impossible to prevent
const base = createManifesto(...);       // base has dispatchAsync
const lineage = withLineage(base, ...);  // lineage absorbs it, but...
await base.dispatchAsync(...);           // caller still holds the reference → unsealed backdoor
```

TypeScript's structural type system cannot revoke a reference. The two-phase model eliminates the problem by construction: `dispatchAsync` does not exist until `activate()`, so there is no reference to escape.

---

## 3. Ontological Interpretation

### 3.1 Base World — Only the Present Exists

`createManifesto()` produces a composable manifesto with no history and no governance. On activation, the world exists as a point-in-time snapshot. The fundamental action is: execute an intent now.

### 3.2 Lineage World — Time and Continuity

`withLineage()` adds time to the composable manifesto. On activation, snapshots are promoted to sealed Worlds. An immutable DAG, branches, restore, and replay become possible. The fundamental action transforms: execute an intent and record it into the permanent history of this world.

### 3.3 Governed World — Legitimacy

`withGovernance()` adds legitimacy to the composable manifesto. On activation, changes can no longer be directly executed. They must pass through proposal and authority judgment before they can be recorded. The fundamental action transforms again: propose a change for judgment.

### 3.4 One-Line Summary

```
createManifesto  defines a world with only the present.
withLineage      gives that world time and continuity.
withGovernance   gives that world legitimacy and law.
activate()       opens the world — from this point, only execution under its law.
```

---

## 4. Decision

### 4.1 Capability Decorator Pattern with Activation Boundary

Each `with*` function is a **Capability Decorator** — it accepts a composable manifesto, adds a world law, and returns an enriched composable manifesto. No runtime verbs exist until `activate()` is called.

`activate()` is the **irreversible boundary** between law composition and runtime execution. After activation:

- The composable manifesto is consumed. Further `with*` composition is not possible.
- Runtime verbs become available, shaped by the composed laws.
- No path back to the composable phase exists.

### 4.2 Pre-Activation Composable Types

```typescript
// Phase 1: Law Composition — no runtime verbs

type ComposableManifesto<T, Laws extends LawSet = BaseLaws> = {
  readonly _laws: Laws;    // phantom type — encodes composed laws
  readonly schema: DomainSchema;
  activate(): ActivatedInstance<T, Laws>;
};
```

`Laws` is a phantom type parameter that tracks which laws have been composed. It determines the shape of the runtime instance returned by `activate()`.

### 4.3 Post-Activation Runtime Types

#### ManifestoBaseInstance — The Present-Only World

```typescript
type ManifestoBaseInstance<T> = {
  createIntent: TypedCreateIntent<T>;
  dispatchAsync: TypedDispatchAsync<T>;   // terminal snapshot only
  subscribe: TypedSubscribe<T>;
  on: TypedOn;
  getSnapshot: () => Snapshot<T>;
  getAvailableActions: () => (keyof T['actions'])[];
  isActionAvailable: (name: keyof T['actions']) => boolean;
  MEL: TypedMEL<T>;
  schema: DomainSchema;
  dispose: () => void;
};
```

#### LineageInstance — The World With Time

```typescript
type LineageInstance<T> =
  Omit<ManifestoBaseInstance<T>, 'dispatchAsync'> & {
    // --- Verb promotion: dispatch → commit ---
    commitAsync: TypedCommitAsync<T>;
    // resolve = terminal snapshot + seal commit complete
    // reject = dispatch failure OR seal failure

    // --- Lineage capabilities ---
    restore: (worldId: WorldId) => Promise<void>;
    getLatestHead: () => Promise<WorldHead | null>;
    getActiveBranch: () => Promise<BranchInfo>;
    getBranches: () => Promise<readonly BranchInfo[]>;
    createBranch: (name: string, fromWorldId?: WorldId) => Promise<BranchId>;
    switchActiveBranch: (branchId: BranchId) => Promise<BranchSwitchResult>;
    getWorld: (worldId: WorldId) => Promise<World | null>;
    getWorldSnapshot: (worldId: WorldId) => Promise<Snapshot<T['state']> | null>;
  };
```

#### GovernanceInstance — The World With Law

```typescript
type GovernanceInstance<T> =
  Omit<LineageInstance<T>, 'commitAsync'> & {
    // --- Verb promotion: commit → propose ---
    proposeAsync: TypedProposeAsync<T>;
    approve: (proposalId: ProposalId, approvedScope?: IntentScope | null) => Promise<Proposal>;
    reject: (proposalId: ProposalId, reason?: string) => Promise<Proposal>;
    getProposal: (proposalId: ProposalId) => Promise<Proposal | null>;
    getProposals: (branchId?: BranchId) => Promise<readonly Proposal[]>;
  };
```

### 4.4 Composition API

```typescript
// @manifesto-ai/sdk
function createManifesto<T>(
  schema: DomainSchema,
  effects: Record<string, EffectHandler>
): ComposableManifesto<T, BaseLaws>;

// @manifesto-ai/lineage
function withLineage<T, L extends LawSet>(
  manifesto: ComposableManifesto<T, L>,
  config: LineageConfig
): ComposableManifesto<T, L & LineageLaws>;

// @manifesto-ai/governance
function withGovernance<T>(
  manifesto: LineageComposableManifestoInput<T>,
  config: GovernanceConfig<T>
): ComposableManifesto<T, LineageLaws & GovernanceLaws>;
```

**Current implemented governance config:**

```typescript
type GovernanceConfig<T> = {
  bindings: readonly ActorAuthorityBinding[];
  governanceStore?: GovernanceStore;
  evaluator?: AuthorityEvaluator;
  eventSink?: GovernanceEventSink;
  now?: () => number;
  execution: {
    projectionId: string;
    deriveActor(intent: TypedIntent<T>): ActorRef;
    deriveSource(intent: TypedIntent<T>): SourceRef;
  };
};
```

The current contract does not include `GovernanceConfig.lineage`. Governance composition starts from an explicitly lineage-composed manifesto.

### 4.5 Current Governance Prerequisite

`@manifesto-ai/governance` depends on `@manifesto-ai/lineage` at the package level (ADR-014 D4). A governed world without lineage is ontologically impossible — policy cannot exist without a recording substrate.

The current implemented contract expresses that precondition explicitly:

```typescript
const m = withGovernance(
  withLineage(createManifesto<T>(mel, effects), { store: sqliteStore }),
  govConfig
).activate();
```

The earlier design branch in this ADR considered governance-side lineage guarantee and `GovernanceConfig.lineage` conditionality. That is not the current package contract. Follow the package governance spec for the implemented rule: `withGovernance()` requires explicit `withLineage()` composition.

### 4.6 Canonical Surface is Object

The canonical public surface remains an **object with methods**. Destructuring is optional ergonomics, not mandatory.

```typescript
// Object access (canonical)
const counter = createManifesto<CounterDomain>(schema, effects);
const world = counter.activate();
await world.dispatchAsync(intent);

// Destructuring (optional ergonomics)
const { dispatchAsync, subscribe, MEL } = world;
await dispatchAsync(intent);
```

Multiple instances work naturally:

```typescript
const counterWorld = createManifesto<CounterDomain>(counterMel, {}).activate();
const todoWorld = createManifesto<TodoDomain>(todoMel, {}).activate();

await counterWorld.dispatchAsync(counterIntent);
await todoWorld.dispatchAsync(todoIntent);
```

### 4.7 Domain Generic Propagation

When `<T>` is provided to `createManifesto<T>`, `activate()` carries `T` through to all returned functions:

| Function | Type Derived From |
|----------|-------------------|
| `createIntent(MEL.actions.x)` | `keyof T['actions']` — typo is compile error |
| `dispatchAsync(intent)` | Intent constrained to `T['actions']` |
| `subscribe(sel, fn)` | Selector operates on `T['state']` |
| `getAvailableActions()` | Returns `(keyof T['actions'])[]` |
| `isActionAvailable(name)` | Argument is `keyof T['actions']` |
| `MEL.actions` | Typed reference object from `T['actions']` |
| `MEL.state` | Typed reference object from `T['state']` |
| `MEL.computed` | Typed reference object from `T['computed']` |

Codegen generates one interface per domain. TypeScript infers everything else.

---

## 5. Inviolable Design Principles

These rules are constitutional. They protect the semantic integrity of each world type.

### DECO-1: No Runtime Verbs Before Activation (MUST NOT)

Pre-activation composable manifesto objects MUST NOT expose runtime verbs (`dispatchAsync`, `commitAsync`, `proposeAsync`, `subscribe`, `on`, or any verb that interacts with live world state). The composable phase is for law composition only.

**Rationale:** This structurally eliminates the reference-escape backdoor (§2.4). No verb exists to call, therefore no unsealed execution path exists.

### DECO-1a: Activation Boundary Rule (MUST)

A Manifesto object is composable only before activation.

- `createManifesto(...)` and every `with*` result MUST remain in a pre-activation composable state.
- `activate()` is the only boundary that converts a composable manifesto into a final runtime world instance.
- `activate()` is **one-shot**. A second call on the same composable manifesto MUST throw `AlreadyActivatedError`. One composable → one world. A world is opened exactly once.
- After activation, further `with*` composition MUST NOT be allowed.
- No path from runtime instance back to composable state MUST exist (no `deactivate()`, `toComposable()`, or equivalent).

**One-line summary:** World laws can only be composed before `activate()`. After `activate()`, only execution under those laws is possible. A world is opened exactly once.

### DECO-2: Lineage commitAsync Resolves on Seal (MUST)

`LineageInstance.commitAsync` MUST resolve only when both the terminal snapshot and the lineage seal commit have succeeded. If execution succeeds but seal fails, the Promise MUST reject. This guarantees `getSnapshot()` and lineage head are always in sync.

### DECO-2a: Publication Boundary Rule (MUST)

A lineage-activated world MUST NOT publish a new externally visible terminal snapshot, fire `subscribe()` listeners, or emit completion events until seal commit has succeeded. If seal fails, the unsealed terminal snapshot MUST NOT become externally observable.

**Why this rule exists separately from DECO-2:** DECO-2 governs the Promise resolve/reject timing of `commitAsync`. But an implementation could satisfy DECO-2 (delay the Promise) while still publishing the unsealed snapshot through `subscribe()` or `dispatch:completed` events before seal completes. This creates a window where `getSnapshot()` returns a state that lineage does not recognize.

**Implementation consequence under activate() model:** Because the publication mechanism is assembled at `activate()` time (not inherited from a pre-existing base instance), the lineage-activated world constructs its publication pipeline with seal-awareness from the start. There is no "base publication to intercept" — the publication boundary is built correctly from day one. This is dramatically simpler than the v2.x approach of retrofitting a running base instance.

### DECO-3: No Backdoor in Governed World (MUST NOT)

A governance-activated world MUST NOT expose `dispatchAsync` in any form. Direct execution in a governed world is constitutionally illegitimate. The only path to state change is `proposeAsync → approve/reject`. There is no escape hatch.

### DECO-4: Governed Runtime Requires Lineage Semantics (MUST)

A governance-activated world MUST include lineage semantics at runtime. In the current contract this is enforced by requiring `withGovernance()` to receive a manifesto already composed with `withLineage()`. This preserves ADR-014 D4 ("governance → lineage only — policy cannot exist without a recording substrate") as a runtime ontological invariant.

### DECO-5: Layers are Semantic Transformations (MUST)

Each `with*` MUST NOT be understood or documented as "feature addition." Each layer transforms the world's operating law:

| Layer | Transformation |
|-------|---------------|
| Base | Execution only — the present exists |
| Lineage | Execution + sealed continuity — time exists |
| Governance | Proposal-mediated legitimacy — law exists |

### DECO-6: Verb Promotion is Total (MUST)

When a `with*` promotes a verb, the previous verb MUST be fully absorbed. No partial promotion (e.g., "lineage dispatch that sometimes doesn't seal") is permitted.

---

## 6. SDK Ownership and Package Boundaries

### 6.1 Ownership Rule Preserved

`@manifesto-ai/sdk` still owns exactly one concept: `createManifesto`. This is unchanged from ADR-010 SDK-ROLE-1.

**SDK = Core + Host + Compiler + Codegen.** The SDK package integrates the base protocol packages into a single install. Lineage and governance are separate installs.

```
@manifesto-ai/sdk              ← Core + Host + Compiler + Codegen
  └─ createManifesto()         (sole SDK-owned concept)
  └─ ComposableManifesto<T>    (pre-activation type)
  └─ ManifestoBaseInstance<T>  (post-activation base type)
  └─ re-exports from Core, Host, Compiler

@manifesto-ai/lineage          ← depends on @manifesto-ai/sdk
  └─ withLineage()
  └─ LineageInstance<T>

@manifesto-ai/governance       ← layered over @manifesto-ai/lineage and currently imports SDK + lineage seams
  └─ withGovernance()
  └─ GovernanceInstance<T>
```

Consumer imports:

```typescript
import { createManifesto } from '@manifesto-ai/sdk';
import { withLineage } from '@manifesto-ai/lineage';
import { withGovernance } from '@manifesto-ai/governance';
```

### 6.2 Dependency Direction — Architectural Layering

```
@manifesto-ai/sdk
       ↑ (depends on)
@manifesto-ai/lineage
       ↑ (depends on)
@manifesto-ai/governance
```

- SDK has **zero** dependency on lineage or governance.
- Lineage depends on SDK for `ComposableManifesto<T>` and `ManifestoBaseInstance<T>` types.
- Governance is layered on lineage for the governed runtime contract, but the current implementation also imports SDK shared types and runtime seams directly.

No circular dependency is possible. No `pnpm overrides` are required. Treat the clean `SDK -> lineage -> governance` ladder as architectural intent, not a stronger statement than the current package manifests.

---

## 7. Composition Examples

### 7.1 Base — Counter App

```typescript
import { createManifesto } from '@manifesto-ai/sdk';

const counter = createManifesto<CounterDomain>(CounterMel, {}).activate();

// counter: ManifestoBaseInstance<CounterDomain>
await counter.dispatchAsync(counter.createIntent(counter.MEL.actions.increment));
console.log(counter.getSnapshot().data.count); // 1
```

### 7.2 Lineage — Persistent Counter

```typescript
import { createManifesto } from '@manifesto-ai/sdk';
import { withLineage } from '@manifesto-ai/lineage';

const counter = withLineage(
  createManifesto<CounterDomain>(CounterMel, {}),
  { store: sqliteStore }
).activate();

// counter: LineageInstance<CounterDomain>
// commitAsync now includes seal — one await, fully committed
await counter.commitAsync(counter.createIntent(counter.MEL.actions.increment));

// Resume from last session
const head = counter.getLatestHead();
if (head) await counter.restore(head.worldId);
```

### 7.3 Governance — Approved Counter (Explicit Lineage)

```typescript
import { createManifesto } from '@manifesto-ai/sdk';
import { withLineage } from '@manifesto-ai/lineage';
import { withGovernance } from '@manifesto-ai/governance';

const counter = withGovernance(
  withLineage(
    createManifesto<CounterDomain>(CounterMel, {}),
    { store: sqliteStore }
  ),
  { actors, authorities }
).activate();

// counter: GovernanceInstance<CounterDomain>
// counter.dispatchAsync → compile error (does not exist)
const proposal = await counter.proposeAsync(
  counter.createIntent(counter.MEL.actions.increment)
);
await counter.approve(proposal.proposalId);
```

### 7.4 Pre-Activation Backdoor — Structurally Impossible

```typescript
const composable = createManifesto<CounterDomain>(CounterMel, {});

// composable.dispatchAsync → compile error (does not exist on ComposableManifesto)
// composable.subscribe     → compile error
// composable.getSnapshot   → compile error

// Only activate() or with*() are possible
const world = composable.activate();
// Now dispatchAsync exists on world
```

---

## 8. Future Extensibility

New capabilities follow the same pattern. SDK never changes — each protocol package provides its own `with*` decorator on the composable manifesto.

```typescript
// Future capabilities — same pattern, each its own package
import { withMemory } from '@manifesto-ai/memory';
import { withDevtools } from '@manifesto-ai/devtools';
import { withReplication } from '@manifesto-ai/replication';
import { withMind } from '@manifesto-ai/mind';
```

Each `with*` transforms the composable manifesto, and `activate()` produces the appropriate runtime instance:

```typescript
const world = withMind(
  withMemory(
    withLineage(
      createManifesto<AgentDomain>(mel, effects),
      { store }
    ),
    { memoryConfig }
  ),
  { mindConfig }
).activate();
// world: LineageInstance<T> & MemoryCapable<T> & MindCapable<T>
```

The dependency graph is enforced by function signatures and package dependencies, not by documentation.

---

## 9. Codegen Scope Reduction

Under this design, codegen generates one interface per MEL domain:

```typescript
// codegen output
export interface CounterDomain {
  actions: {
    increment: () => void;
    decrement: () => void;
  };
  state: {
    count: number;
  };
  computed: {
    doubled: number;
  };
}
```

All downstream type inference — `createIntent` argument types, `subscribe` selector types, `getAvailableActions` return types, `MEL` object shape — is handled by TypeScript generic propagation from `createManifesto<CounterDomain>`. Codegen does not generate dispatch helpers, selector types, or action creators.

---

## 10. Migration from v1.0.0

### 10.1 Breaking Surface

| Change | v1.0.0 | v2.0.0 | Migration |
|--------|--------|--------|-----------|
| Factory return | `ManifestoInstance<T>` (runtime) | `ComposableManifesto<T>` (pre-activation) | Add `.activate()` |
| Instance shape | Fixed 5 methods | Phase-dependent | `ManifestoBaseInstance<T>` after activate |
| Intent creation | `createIntent("name", id)` | `world.createIntent(world.MEL.actions.name)` | Use MEL reference |
| Lineage access | Not visible | `withLineage()` before activate | Add import + compose |
| Governance | Not expressible | `withGovernance()` before activate | Add import + compose |
| Package imports | `@manifesto-ai/sdk` only | `+ @manifesto-ai/lineage`, `+ @manifesto-ai/governance` | Direct package imports |

### 10.2 Protocol Package Impact

| Package | Change | Reason |
|---------|--------|--------|
| Core | **None** | `compute()` unchanged |
| Host | **None** | Effect execution unchanged |
| Lineage | **Additive** | Exports `withLineage()` function |
| Governance | **Additive** | Exports `withGovernance()` function |
| Compiler | **None** | MEL → DomainSchema unchanged |
| Codegen | **Scope reduction** | Generates domain interface only |
| SDK | **Major** | `createManifesto` returns composable, not runtime instance |

---

## 11. Consequences

### 11.1 Positive

1. **Backdoor is structurally impossible.** Runtime verbs do not exist before `activate()`. There is no reference to escape, no revocation needed, no TypeScript structural-type workaround required.

2. **Publication boundary is simple.** Because the publication mechanism is assembled at `activate()` time, lineage-aware publication is built from the start — no retrofit, no interception.

3. **Capability surface changes with world type.** Each `with*` transforms what runtime verbs will exist after activation. Agents and developers see exactly what is possible in their world configuration.

4. **Verb promotion enforces semantic correctness.** Governance removing direct execution verbs (`dispatchAsync`, `commitAsync`) is not a convention — it is a structural impossibility. The type system enforces the world's constitution.

5. **Dependency layering remains acyclic.** SDK owns the base surface, lineage depends on SDK, and governance is layered on lineage while the current implementation also imports shared SDK seams directly. The package graph remains non-circular.

6. **Codegen scope shrinks.** One domain interface → full type chain via generic propagation.

7. **Progressive complexity.** `createManifesto → withLineage → withGovernance → activate()` is a clear ontological progression: define → add time → add law → open the world.

8. **Future-proof.** New capabilities follow the same pre-activation decorator pattern.

### 11.2 Negative

1. **SDK SPEC major version bump.** v1.0.0 → v2.0.0.
2. **Composition order awareness.** `activate()` must be called last. `with*` after `activate()` does not compile. Intentional but must be documented.
3. **Extra `.activate()` call.** Every consumer adds one method call. The cost is minimal and the safety benefit is immense.
4. **Generic complexity.** Phantom type parameter `Laws` and conditional `ActivatedInstance<T, Laws>` mapping can produce inscrutable error messages. Mitigation: clear type aliases, documented error patterns.

### 11.3 Risks

1. **Phantom type ergonomics.** The `Laws` phantom type parameter must be invisible to typical consumers. If it leaks into autocomplete or error messages, the DX degrades. Mitigation: default type parameters, opaque branded types.
2. **`activate()` overhead perception.** Consumers might perceive `activate()` as ceremony. Mitigation: documentation must frame it as "opening the world" — a meaningful act, not boilerplate.

---

## 12. Alternatives Considered

### A1. Add lineage/governance methods to ManifestoInstance

Rejected. Static shape cannot express capability removal. Governance backdoor (dispatch alongside propose) is inevitable.

### A2. Config-driven conditional return types

Rejected. TypeScript overloads on config shape are fragile. 2^n overloads for n capabilities.

### A3. Mandatory destructuring (no object surface)

Rejected. Object surface is canonical. Destructuring is optional ergonomics.

### A4. Separate commitAsync as public step

Rejected. Two-step dispatch + commit exposes a window where snapshot truth and lineage truth diverge.

### A5. Base dispatchAsync available alongside lineage dispatchAsync

Rejected (DECO-1). A lineage world with an unsealed dispatch path is a world with a broken history.

### A6. Runtime instance consumption without activation boundary (v2.x design)

Rejected. `with*` consuming runtime instances creates the reference-escape backdoor (§2.4). TypeScript cannot revoke a reference. The activation boundary eliminates this entire problem class.

### A7. withGovernance requiring LineageComposable input only

This is the current implemented contract. The earlier governance-auto-lineage branch described in this ADR was not retained as the living package behavior.

### A8. Idempotent or factory-style activate()

Rejected. If `activate()` were idempotent (returning the same instance), the consumer could hold both the composable and the runtime object, creating confusing ownership. If `activate()` were a factory (returning a new world each time), the semantics would be "one composable → many worlds" — but a composable manifesto accumulates configuration state (stores, bindings), and multiple worlds sharing the same store instance creates concurrency hazards that are invisible at the API level. One-shot `activate()` makes the lifecycle unambiguous: one composable, one world, once.

---

## 13. Implementation Markers

| Marker | Description | Gate |
|--------|-------------|------|
| SDK-V3-1 | `createManifesto<T>` returns `ComposableManifesto<T>` with no runtime verbs | Attempting `composable.dispatchAsync` → compile error |
| SDK-V3-2 | `ComposableManifesto.activate()` returns `ManifestoBaseInstance<T>` with generic propagation | Counter example compiles with full type safety |
| SDK-V3-3 | `MEL` object generated from `<T>` generic | `MEL.actions.x` autocompletes correctly |
| SDK-V3-4 | `withLineage` returns `ComposableManifesto<T, L & LineageLaws>` | `activate()` returns `LineageInstance<T>` |
| SDK-V3-5 | `withLineage` activated instance: `commitAsync` includes seal | commit → seal atomic; resolve only on commit success |
| SDK-V3-6 | `withLineage` activated instance: publication boundary (DECO-2a) | `subscribe()` and events fire only after seal success |
| SDK-V3-7 | `withGovernance` removes `dispatchAsync` and `commitAsync` from the activated instance | direct execution verbs → compile error after governance activation |
| SDK-V3-8 | `withGovernance` requires explicit lineage composition | `withGovernance(createManifesto(...), ...)` → compile error |
| SDK-V3-9 | `withGovernance(withLineage(...), ...)` preserves lineage capabilities | lineage query/restore APIs remain available after governance decoration |
| SDK-V3-10 | Dependency graph remains acyclic | `npm install` without overrides; no circular dependency |
| SDK-V3-11 | Codegen generates domain interface only | `CounterDomain` interface → full type chain propagation |
| SDK-V3-12 | `with*` after `activate()` → compile error | Composable-only composition enforced at type level |
| SDK-V3-13 | No reverse path from runtime to composable | No `deactivate()`, `toComposable()`, or equivalent exists |
| SDK-V3-14 | `activate()` is one-shot | Second `activate()` on same composable → `AlreadyActivatedError` |
| SDK-V3-15 | `withGovernance(base, config)` without prior `withLineage()` → compile error | explicit lineage prerequisite enforced |
| SDK-V3-16 | governed runtime keeps lineage read/restore capabilities | `getLatestHead()`, `getBranches()`, `restore()`, `getWorldSnapshot()` remain available |
| SDK-V3-17 | GovernanceConfig has no lineage field in the current contract | no governance-side implicit lineage config path exists |

---

## 14. Version Impact

| Package | Current | Target | Change Type |
|---------|---------|--------|-------------|
| SDK | v2.0.0 | v3.0.0 | **Major** — `createManifesto` returns composable, activation required |
| Lineage | v2.0.0 | v3.0.0 | **Major** — decorator runtime becomes the current package contract |
| Governance | v2.0.0 | v3.0.0 | **Major** — governed activation becomes the current package contract |
| Core | v4.0.0 | v4.0.0 | **None** |
| Host | v4.0.0 | v4.0.0 | **None** |
| Compiler | — | — | **None** |
| Codegen | — | — | **Scope reduction** (not breaking) |

---

## 15. ADR Dependency Chain

| ADR | Contribution to ADR-017 |
|-----|------------------------|
| ADR-010 | SDK-ROLE-1 (`createManifesto` sole owned concept), wrapping extension pattern |
| ADR-014 | Governance → lineage dependency direction (D4), ontological basis for the explicit `withLineage()` prerequisite in `withGovernance()` |
| ADR-015 | "Snapshot is point-in-time" principle → publication boundary justification |
| ADR-016 | Merkle Tree Lineage → seal identity semantics that underpin `commitAsync` and lineage publication rules |

---

## 16. References

| Document | Relevance |
|----------|-----------|
| SDK SPEC / VERSION-INDEX | Current package surface and version ownership |
| Lineage SPEC v3.0.0 Draft | Current `withLineage()`, `commitAsync`, restore, and lineage query contract |
| Governance SPEC v3.0.0 Draft | Current `withGovernance()`, explicit lineage prerequisite, and `proposeAsync` contract |
| SDK SPEC v1.0.0 §4.2 | Historical SDK ownership rule basis |
| SDK SPEC v1.0.0 §9.2 | Historical extension wrapping pattern (Capability Decorator is its formal evolution) |

---

*End of ADR-017 v3.1*
