# ADR-017: Capability Decorator Pattern — Semantic Transformation of SDK Surface

> **Status:** Proposed
> **Date:** 2026-04-01 (v2 — cross-model review consensus)
> **Deciders:** 정성우 (Architect)
> **Scope:** SDK, Lineage, Governance
> **Supersedes:** SDK SPEC v1.0.0 `ManifestoInstance` interface shape (§6)
> **Preserves:** All protocol packages (Core, Host, Lineage, Governance, Compiler) — zero changes

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

**P4: Semantic identity of actions is lost.** `dispatchAsync` means different things depending on whether lineage is present. In a lineage world, dispatch without seal is a meaningless operation — but the API does not express this.

### 1.3 Root Cause

`ManifestoInstance` is a **static shape** that cannot vary with configuration. The same interface is returned regardless of world type. TypeScript's type system can express configuration-dependent return types, but v1.0.0's design does not use this capability.

### 1.4 Design Origin

This ADR originates from hands-on consumer testing by the framework architect. The key insight — **"each layer does not add features but transforms the world's operating law, and this transformation must be expressed as verb replacement at the type level"** — derives from Manifesto's specific ontology and cannot be produced by pattern recombination from existing frameworks.

---

## 2. Core Insight: Verb Promotion

The central design principle of this ADR:

> Each architectural layer does not add a verb. It **promotes** the previous layer's verb into a richer one, and the previous verb ceases to exist.

```
Base world     → dispatchAsync   (execute intent, get terminal snapshot)
                    ↓ replaced
Lineage world  → commitAsync     (execute intent + seal into lineage DAG — dispatchAsync ceases to exist)
                    ↓ replaced
Governed world → proposeAsync    (submit proposal for authority judgment — commitAsync ceases to exist)
```

**Why the previous verb disappears and the name changes:**

- In a lineage world, "dispatch" is a lie. The word means "send," but the actual operation is "send + seal + record permanently." Calling it `dispatchAsync` hides the commitment semantics. `commitAsync` makes the irreversible nature of the action visible in the name. The base `dispatchAsync` is removed from the type — not renamed, not hidden, **gone**.
- In a governed world, direct commitment is constitutionally illegitimate. Therefore, `commitAsync` must be replaced by `proposeAsync`. The pattern is symmetric: **every layer replaces the previous verb with a new name that accurately describes the new semantics.**

This is not feature toggling. This is **semantic transformation of the world's operating law**.

---

## 3. Ontological Interpretation

This design must be understood as world-law composition, not feature addition.

### 3.1 Base World — Only the Present Exists

`createManifesto()` produces a world with current state only. There is no history, no continuity, no governance. The world exists as a point-in-time snapshot. The fundamental action is: execute an intent now.

### 3.2 Lineage World — Time and Continuity

`withLineage()` grants the world time. Snapshots are promoted to sealed Worlds. An immutable DAG, branches, restore, and replay become possible. The fundamental action transforms: execute an intent and **commit** it into the permanent history of this world. The verb changes from `dispatchAsync` to `commitAsync` because the action is no longer a dispatch — it is an irreversible commitment.

### 3.3 Governed World — Legitimacy

`withGovernance()` grants the world legitimacy. Changes can no longer be directly committed. They must pass through proposal and authority judgment before they can be recorded. The fundamental action transforms again: propose a change for judgment. The verb changes from `commitAsync` to `proposeAsync` because direct commitment is no longer legitimate.

### 3.4 One-Line Summary

```
createManifesto  creates a world with only the present.     → dispatchAsync
withLineage      gives that world time and continuity.      → commitAsync (dispatch disappears)
withGovernance   gives that world legitimacy and law.       → proposeAsync (commit disappears)
```

This aligns with ADR-001's layer separation ("Core computes meaning, Host executes reality, World governs legitimacy") and ADR-014's lineage/governance split.

---

## 4. Decision

### 4.1 Capability Decorator Pattern

Each `with*` function is a **Capability Decorator** — it accepts the previous tier's instance, transforms its capability surface, and returns an enriched (and potentially reduced) instance.

This is structurally the Decorator Pattern (GoF), with one key extension: decorators can be **subtractive**. `withLineage` removes `dispatchAsync` and replaces it with `commitAsync`. `withGovernance` removes `commitAsync` and replaces it with `proposeAsync`. This is made possible by TypeScript's `Omit` utility type and is the type-level expression of "each layer changes the world's operating law."

### 4.2 Canonical Surface is Object

The canonical public surface remains an **object with methods**. Destructuring is optional ergonomics, not mandatory.

```typescript
// Object access (canonical)
const manifesto = createManifesto<CounterDomain>({ schema, effects: {} });
await manifesto.dispatchAsync(intent);
manifesto.subscribe(sel, fn);

// Destructuring (optional ergonomics)
const { dispatchAsync, subscribe, MEL } = manifesto;
await dispatchAsync(intent);
```

Multiple instances work naturally:

```typescript
const counter = createManifesto<CounterDomain>({ schema: counterMel, effects: {} });
const todo = createManifesto<TodoDomain>({ schema: todoMel, effects: {} });

await counter.dispatchAsync(counterIntent);
await todo.dispatchAsync(todoIntent);

// Destructuring with alias when needed
const { dispatchAsync: todoDispatch } = todo;
```

### 4.3 Type Definitions

#### ManifestoBase — The Present-Only World

```typescript
type ManifestoBase<T> = {
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

#### LineageCapable — The World With Time

```typescript
type LineageCapable<T> =
  Omit<ManifestoBase<T>, 'dispatchAsync'> & {
    // --- Verb promotion: dispatch → commit (name changes, dispatch disappears) ---
    commitAsync: TypedCommitAsync<T>;
    // resolve = terminal snapshot + seal commit complete
    // reject = computation failure OR seal failure

    // --- Lineage capabilities ---
    restore: (worldId: WorldId) => Promise<void>;
    getLatestHead: () => WorldHead | null;
    getActiveBranch: () => BranchInfo;
    getBranches: () => readonly BranchInfo[];
    createBranch: (name: string, headWorldId: WorldId) => BranchId;
    switchBranch: (branchId: BranchId) => BranchSwitchResult;
    getWorld: (worldId: WorldId) => World | null;
  };
```

**Critical design rule:** `LineageCapable.commitAsync` resolves **only when both the terminal snapshot and the lineage seal commit have succeeded**. If computation succeeds but seal fails, the Promise rejects. This ensures `getSnapshot()` and the lineage head are never out of sync.

#### GovernanceCapable — The World With Law

```typescript
type GovernanceCapable<T> =
  Omit<LineageCapable<T>, 'commitAsync'> & {
    // --- Verb promotion: commit → propose (name changes, commit disappears) ---
    proposeAsync: TypedProposeAsync<T>;
    approve: (proposalId: ProposalId) => Promise<Decision>;
    reject: (proposalId: ProposalId, reason?: string) => Promise<Decision>;
    getProposal: (proposalId: ProposalId) => Proposal;
    getProposals: () => readonly Proposal[];
  };
```

### 4.4 Wrapper Functions

```typescript
// @manifesto-ai/sdk — base
function createManifesto<T>(config: ManifestoConfig<T>): ManifestoBase<T>;

// @manifesto-ai/sdk — base
function createManifesto<T>(config: ManifestoConfig<T>): ManifestoBase<T>;

// @manifesto-ai/lineage — separate install
function withLineage<T>(
  base: ManifestoBase<T>,
  config: LineageConfig
): LineageCapable<T>;

// @manifesto-ai/governance — separate install
function withGovernance<T>(
  base: LineageCapable<T>,              // lineage required — ADR-014 D4
  config: GovernanceConfig<T>
): GovernanceCapable<T>;
```

#### 4.4.1 Package Install Progression

```bash
# Base — just SDK
npm install @manifesto-ai/sdk

# + Lineage
npm install @manifesto-ai/lineage

# + Governance
npm install @manifesto-ai/governance
```

Each package adds a single `with*` function. No re-exports, no subpath imports, no version coupling between SDK and lineage/governance.

### 4.5 Composition Examples

#### Base — Counter App

```typescript
import { createManifesto } from '@manifesto-ai/sdk';

const counter = createManifesto<CounterDomain>({
  schema: CounterMel,
  effects: {},
});

await counter.dispatchAsync(counter.createIntent(counter.MEL.actions.increment));
console.log(counter.getSnapshot().data.count); // 1
```

#### Lineage — Persistent Counter

```typescript
import { createManifesto } from '@manifesto-ai/sdk';
import { withLineage } from '@manifesto-ai/lineage';

const counter = withLineage(
  createManifesto<CounterDomain>({ schema: CounterMel, effects: {} }),
  { store: sqliteStore }
);

// commitAsync = execute + seal — one await, permanently committed
await counter.commitAsync(counter.createIntent(counter.MEL.actions.increment));
// counter.dispatchAsync → compile error (does not exist)

// resume from last session
const head = counter.getLatestHead();
if (head) await counter.restore(head.worldId);
```

#### Governance — Approved Counter

```typescript
import { createManifesto } from '@manifesto-ai/sdk';
import { withLineage } from '@manifesto-ai/lineage';
import { withGovernance } from '@manifesto-ai/governance';

const counter = withGovernance(
  withLineage(
    createManifesto<CounterDomain>({ schema: CounterMel, effects: {} }),
    { store }
  ),
  { actors, authorities }
);

// counter.dispatchAsync → compile error (gone since withLineage)
// counter.commitAsync → compile error (gone since withGovernance)
const proposal = await counter.proposeAsync(
  counter.createIntent(counter.MEL.actions.increment)
);
await counter.approve(proposal.id);
```

### 4.6 Domain Generic Propagation

When `<T>` is provided to `createManifesto<T>`, all returned functions carry `T` through:

| Function | Type Derived From |
|----------|-------------------|
| `createIntent(MEL.actions.x)` | `keyof T['actions']` — typo is compile error |
| `dispatchAsync(intent)` | Intent constrained to `T['actions']` (base only) |
| `commitAsync(intent)` | Intent constrained to `T['actions']` (lineage — dispatch replaced) |
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

### DECO-1: No Backdoor in Lineage World (MUST NOT)

`withLineage` MUST NOT expose the base `dispatchAsync` in any form. A lineage world with an unsealed execution path is a world with a broken history. The only execution verb is `commitAsync`. There is no escape hatch.

### DECO-2: Lineage commitAsync Resolves on Seal (MUST)

`LineageCapable.commitAsync` MUST resolve only when both the terminal snapshot and the lineage seal commit have succeeded. If computation succeeds but seal fails, the Promise MUST reject. This guarantees `getSnapshot()` and lineage head are always in sync.

### DECO-2a: Publication Boundary Rule (MUST)

`withLineage` MUST NOT publish a new externally visible terminal snapshot, fire `subscribe()` listeners, or emit completion events until seal commit has succeeded. If seal fails, the unsealed terminal snapshot MUST NOT become externally observable.

**Why this rule exists separately from DECO-2:** DECO-2 governs the Promise resolve/reject timing of `commitAsync`. But a naive implementation could satisfy DECO-2 (delay the Promise) while still publishing the unsealed snapshot through `subscribe()` or `commit:completed` events before seal completes. This creates a window where `getSnapshot()` returns a state that lineage does not recognize.

**Implementation consequence:** `withLineage` cannot be a simple post-hoc wrapper (`await base.dispatchAsync(); await seal()`). It must control the **publication boundary** — the point at which the new terminal snapshot becomes externally visible. The decorator must intercept or defer the base publication mechanism, execute seal, and only then release the snapshot to subscribers and event listeners. This makes `withLineage` a **semantic decorator**, not a sequential wrapper.

### DECO-3: No Backdoor in Governed World (MUST NOT)

`withGovernance` MUST NOT expose `commitAsync` or `dispatchAsync` in any form. Direct execution or commitment in a governed world is constitutionally illegitimate. The only path to state change is `proposeAsync → approve/reject`. There is no escape hatch.

### DECO-4: Governance Requires Lineage (MUST)

`withGovernance` MUST require `LineageCapable<T>` as input. This enforces ADR-014 D4 ("governance → lineage only") at the function signature level. Governance without lineage does not compile.

### DECO-5: Layers are Semantic Transformations (MUST)

Each `with*` MUST NOT be understood or documented as "feature addition." Each layer transforms the world's operating law:

| Layer | Transformation | Verb |
|-------|---------------|------|
| Base | Execution only — the present exists | `dispatchAsync` |
| Lineage | Commitment + sealed continuity — time exists | `commitAsync` (dispatch gone) |
| Governance | Proposal-mediated legitimacy — law exists | `proposeAsync` (commit gone) |

### DECO-6: Verb Promotion is Total — Including Name (MUST)

When a `with*` promotes a verb, the previous verb MUST be fully absorbed **and renamed**. The new name MUST accurately describe the new semantics. No partial promotion (e.g., "commit that sometimes doesn't seal") is permitted. No name reuse (e.g., calling lineage's verb "dispatchAsync") is permitted — reusing the name hides the semantic change.

---

## 6. SDK Ownership and Package Boundaries

### 6.1 Ownership Rule Preserved

`@manifesto-ai/sdk` still owns exactly one concept: `createManifesto`. This is unchanged from ADR-010 SDK-ROLE-1.

**SDK = Core + Host + Compiler + Codegen.** The SDK package integrates the base protocol packages into a single install. Lineage and governance are separate installs that depend on SDK, not the other way around.

```
@manifesto-ai/sdk              ← Core + Host + Compiler + Codegen
  └─ createManifesto()         (sole SDK-owned concept)
  └─ ManifestoBase<T>          (canonical base type)
  └─ re-exports from Core, Host, Compiler

@manifesto-ai/lineage          ← depends on @manifesto-ai/sdk
  └─ withLineage()
  └─ LineageCapable<T>

@manifesto-ai/governance       ← depends on @manifesto-ai/lineage
  └─ withGovernance()
  └─ GovernanceCapable<T>
```

Consumer imports:

```typescript
import { createManifesto } from '@manifesto-ai/sdk';
import { withLineage } from '@manifesto-ai/lineage';
import { withGovernance } from '@manifesto-ai/governance';
```

### 6.2 Dependency Direction — Strictly Unidirectional

```
@manifesto-ai/sdk
       ↑ (depends on)
@manifesto-ai/lineage
       ↑ (depends on)
@manifesto-ai/governance
```

- SDK has **zero** dependency on lineage or governance.
- Lineage depends on SDK for `ManifestoBase<T>` type.
- Governance depends on lineage for `LineageCapable<T>` type.

No circular dependency is possible. No subpath imports needed. No `pnpm overrides` needed.

This resolves the version entanglement discovered during hands-on testing (2026-04-01: `pnpm overrides` required for lineage/governance/world version alignment). Under this structure, SDK publishes independently. Lineage/governance pin to an SDK version range. Version conflict is structurally impossible.

---

## 7. Future Extensibility

New capabilities follow the same pattern. SDK never changes — each protocol package provides its own `with*` decorator.

```typescript
// Future capabilities — same pattern, each its own package
import { withMemory } from '@manifesto-ai/memory';
import { withDevtools } from '@manifesto-ai/devtools';
import { withReplication } from '@manifesto-ai/replication';
import { withMind } from '@manifesto-ai/mind';
```

Each `with*` can declare its prerequisites at the type level:

```typescript
// memory works on base
withMemory(base: ManifestoBase<T>): ManifestoBase<T> & MemoryCapable<T>;

// replication requires lineage
withReplication(base: LineageCapable<T>): LineageCapable<T> & ReplicationCapable<T>;

// mind requires lineage + memory
withMind(base: LineageCapable<T> & MemoryCapable<T>): ... & MindCapable<T>;
```

The dependency graph is enforced by function signatures, not by documentation.

---

## 8. Codegen Scope Reduction

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

## 9. Migration from v1.0.0

### 9.1 Breaking Surface

| Change | v1.0.0 | v2.0.0 | Migration |
|--------|--------|--------|-----------|
| Instance shape | Fixed `ManifestoInstance` | `ManifestoBase<T>` with generic propagation | Add `<T>` generic |
| Intent creation | `createIntent("name", id)` | `m.createIntent(m.MEL.actions.name)` | Use MEL reference |
| Lineage verb | Not visible | `withLineage()` → `commitAsync` replaces `dispatchAsync` | Add import + wrap; rename dispatch calls to commit |
| Governance verb | Not expressible | `withGovernance()` → `proposeAsync` replaces `commitAsync` | Add import + wrap; rename commit calls to propose |
| Package imports | `@manifesto-ai/sdk` only | `+ @manifesto-ai/lineage`, `+ @manifesto-ai/governance` | Add direct package imports |

### 9.2 Protocol Package Impact

| Package | Change | Reason |
|---------|--------|--------|
| Core | **None** | `compute()` unchanged |
| Host | **None** | Effect execution unchanged |
| Lineage | **Additive** | Exports `withLineage()` function |
| Governance | **Additive** | Exports `withGovernance()` function |
| Compiler | **None** | MEL → DomainSchema unchanged |
| Codegen | **Scope reduction** | Generates domain interface only |
| SDK | **Major** | Shape change + subpath exports |

---

## 10. Consequences

### 10.1 Positive

1. **Capability surface changes with world type.** Each `with*` transforms what actions are available, expressed at the type level. Agents and developers see exactly what is possible in their world configuration.

2. **Verb promotion enforces semantic correctness.** Each layer's verb has a distinct name that accurately describes its semantics: `dispatchAsync` → `commitAsync` → `proposeAsync`. The name change is not cosmetic — it makes the semantic transformation visible at the call site. Governance removing `commitAsync` and lineage removing `dispatchAsync` are not conventions — they are structural impossibilities. The type system enforces the world's constitution.

3. **Circular dependency structurally impossible.** SDK owns base types, lineage depends on SDK, governance depends on lineage. Strictly unidirectional. No re-exports, no version entanglement, no `pnpm overrides`.

4. **Codegen scope shrinks.** One domain interface → full type chain via generic propagation. Codegen stabilization becomes dramatically easier.

5. **Progressive complexity.** `createManifesto` → `withLineage` → `withGovernance` is a clear ontological progression: present → time → law. The verb chain `dispatch` → `commit` → `propose` mirrors this progression in the action vocabulary.

6. **Future-proof.** New capabilities follow the same decorator pattern. SDK never needs to change.

### 10.2 Negative

1. **SDK SPEC major version bump.** v1.0.0 → v2.0.0.
2. **Composition order matters.** `withGovernance(base)` does not compile — lineage is required. Intentional but must be documented.
3. **Generic complexity.** Deep TypeScript generics can produce inscrutable error messages. Mitigation: clear type aliases, documented error patterns.

### 10.3 Risks

1. **Publication boundary atomicity.** DECO-2 and DECO-2a together require that `withLineage` controls when subscribers and event listeners see the new snapshot. A naive post-hoc wrapper (`await base.dispatchAsync(); await seal()`) violates DECO-2a because base publication fires before seal. `commitAsync` must intercept the publication boundary. This is the single hardest implementation challenge in this ADR.
2. **Bundler compatibility.** Direct package imports (`@manifesto-ai/lineage`) require standard Node module resolution. No subpath export map compatibility concerns.

---

## 11. Alternatives Considered

### A1. Add lineage/governance methods to ManifestoInstance

Rejected. Static shape cannot express capability removal. Governance backdoor (dispatch alongside propose) is inevitable.

### A2. Config-driven conditional return types

Rejected. TypeScript overloads on config shape are fragile. 2^n overloads for n capabilities.

### A3. Mandatory destructuring (no object surface)

Rejected. Object surface is canonical. Destructuring is optional ergonomics. Multiple instances work naturally with object access. Mandatory destructuring adds ceremony without design benefit.

### A4. Two-step dispatchAsync + sealAsync in lineage world

Rejected. Exposing `dispatchAsync` (execution) and `sealAsync` (recording) as two separate public steps creates a window where the snapshot has changed but lineage has not recorded it. This divergence is the exact problem DECO-2 and DECO-2a prevent. The lineage verb `commitAsync` is atomic: compute + seal or reject. There is no public seal step.

**Note:** `commitAsync` is the **promoted verb**, not a "separate commit step alongside dispatch." The base `dispatchAsync` is removed from the type entirely. This is verb replacement, not verb addition.

### A5. Reuse `dispatchAsync` name in lineage world (same name, richer semantics)

Rejected (DECO-6). Calling the lineage verb `dispatchAsync` hides the semantic change. "Dispatch" means "send" — but the lineage operation is "send + seal + record permanently." Using the same name for a fundamentally different operation violates the principle that verb promotion must be visible in the name. `commitAsync` makes the irreversible nature explicit. Every layer gets a new verb name: `dispatchAsync` → `commitAsync` → `proposeAsync`. The symmetry is intentional.

### A6. Base dispatchAsync available alongside commitAsync

Rejected (DECO-1). A lineage world with an unsealed dispatch path is a world with a broken history. The base verb must be fully replaced, not supplemented.

---

## 12. Implementation Markers

| Marker | Description | Gate |
|--------|-------------|------|
| SDK-V2-1 | `createManifesto<T>` returns `ManifestoBase<T>` with generic propagation | Counter example compiles with full type safety |
| SDK-V2-2 | `MEL` object generated from `<T>` generic | `MEL.actions.x` autocompletes correctly |
| SDK-V2-3 | `withLineage` exported from `@manifesto-ai/lineage` | Import resolves; lineage APIs visible after wrapping |
| SDK-V2-4 | `withLineage` replaces `dispatchAsync` with `commitAsync` | `dispatchAsync` → compile error; `commitAsync` available and includes seal |
| SDK-V2-5 | `withLineage` publication boundary (DECO-2a) | `subscribe()` and events fire only after seal success; seal failure → no external observation |
| SDK-V2-6 | `withGovernance` removes `commitAsync` from return type | `commitAsync` → compile error after `withGovernance`; `proposeAsync` available |
| SDK-V2-7 | `withGovernance` requires `LineageCapable<T>` input | `withGovernance(base)` → compile error |
| SDK-V2-8 | Unidirectional dependency: SDK ← lineage ← governance | `npm install @manifesto-ai/sdk` without overrides; no circular dependency |
| SDK-V2-9 | Codegen generates domain interface only | `CounterDomain` interface → full type chain propagation |
| SDK-V2-10 | Verb name chain: dispatch → commit → propose | Each layer's verb has a distinct name; no name reuse across layers |

---

## 13. Version Impact

| Package | Current | Target | Change Type |
|---------|---------|--------|-------------|
| SDK | v2.0.0 | v3.0.0 | **Major** — shape change + subpath exports |
| Lineage | v2.0.0 | v2.1.0 | **Minor** — additive `withLineage` export |
| Governance | v2.0.0 | v2.1.0 | **Minor** — additive `withGovernance` export |
| Core | v4.0.0 | v4.0.0 | **None** |
| Host | v4.0.0 | v4.0.0 | **None** |
| Compiler | — | — | **None** |
| Codegen | — | — | **Scope reduction** (not breaking) |

---

## 14. References

| Document | Relevance |
|----------|-----------|
| ADR-010 | Established SDK-ROLE-1 and wrapping extension pattern |
| ADR-014 | Established governance → lineage dependency direction |
| ADR-015 | Snapshot ontological purification — "snapshot is point-in-time" |
| ADR-016 | Merkle Tree Lineage — positional world identity |
| SDK SPEC v1.0.0 §4.2 | SDK ownership rule |
| SDK SPEC v1.0.0 §9.2 | Extension wrapping pattern (Capability Decorator is its formal evolution) |
| SDK SPEC v1.0.0 §10.1 | Re-export structure (extended with subpath imports) |
| Lineage SPEC v1.0.1 §7 | Seal protocol (source of lineage-aware dispatch semantics) |
| Governance SPEC v1.0.0 | Proposal lifecycle (source of proposeAsync semantics) |
| Architecture docs | "Core computes, Host executes, World governs" — verb promotion is the SDK expression of this principle |

---

*End of ADR-017*