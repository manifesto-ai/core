# Manifesto Runtime Specification v0.1.0

> **Status:** Draft
> **Scope:** Manifesto Runtime Layer — Internal Execution Orchestration
> **Compatible with:** Core SPEC v2.0.0, Host Contract v2.0.2, World Protocol v2.0.3, APP-SPEC v2.3.0
> **Derived from:** APP-SPEC v2.3.0 §8–§13, §15; FDR-APP-PUB-001, FDR-APP-RUNTIME-001, FDR-APP-INTEGRATION-001, FDR-APP-POLICY-001, FDR-APP-EXT-001
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - **v0.1.0 (2026-02-11):** Initial draft — extracted from APP-SPEC v2.3.0

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Layering Model & Boundary](#4-layering-model--boundary)
5. [Execution Pipeline](#5-execution-pipeline)
6. [Host Integration](#6-host-integration)
7. [Policy System](#7-policy-system)
8. [External Memory](#8-external-memory)
9. [Branch Management](#9-branch-management)
10. [Schema Registry](#10-schema-registry)
11. [System Runtime](#11-system-runtime)
12. [Subscription Store](#12-subscription-store)
13. [Action Queue](#13-action-queue)
14. [Lifecycle Management](#14-lifecycle-management)
15. [Publish Boundary](#15-publish-boundary)
16. [Invariants](#16-invariants)
17. [Compliance](#17-compliance)
18. [References](#18-references)

---

## 1. Purpose

This document defines the **Manifesto Runtime Specification v0.1.0**.

The Runtime layer is the **internal execution orchestration engine** that:

- Executes the action pipeline (prepare → authorize → execute → persist → finalize)
- Bridges Host (effect execution) and World (governance/persistence) via HostExecutor
- Implements policy decisions (ExecutionKey derivation, Authority routing, Scope enforcement)
- Manages state subscriptions with change detection and batching
- Coordinates external memory with Context Freezing for determinism
- Manages branches as named pointers over World lineage
- Maintains a schema registry for multi-schema support
- Provides a separate System Runtime for `system.*` meta-operations
- Enforces the Publish Boundary (one state:publish per Proposal Tick)

**Relationship to SDK:** The SDK layer (see sdk-SPEC) provides the public developer API (`createApp`, `App`, `ActionHandle`, `Session`). The SDK delegates all internal orchestration to the Runtime. The Runtime MUST NOT be directly accessible to end-users.

**Relationship to App:** This specification, together with the SDK Specification, represents a decomposition of APP-SPEC v2.3.0. The combined contract of Runtime + SDK MUST be equivalent to the App layer's responsibilities as defined in APP-SPEC v2.3.0.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Execution Pipeline | Action preparation, authorization, execution, persistence, finalization |
| Host Integration | HostExecutor implementation bridging World and Host |
| Policy System | ExecutionKey derivation, Authority routing, ApprovedScope enforcement |
| External Memory | MemoryHub, MemoryFacade, Context Freezing |
| Branch Management | BranchManager, head tracking, fork operations |
| Schema Registry | DomainSchema caching, MEL compilation delegation, multi-schema |
| System Runtime | Separate execution context for `system.*` actions |
| Subscription Store | Reactive state subscriptions with selector-based change detection |
| Action Queue | FIFO queuing with ExecutionKey-based routing |
| Lifecycle Management | Bootstrap assembly, ready sequence, graceful disposal |
| Publish Boundary | Proposal Tick definition, state:publish timing |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Public developer API | SDK SPEC responsibility |
| ActionHandle semantics | SDK SPEC responsibility |
| Session interface | SDK SPEC responsibility |
| Hook/Plugin system (public contract) | SDK SPEC responsibility |
| `createApp()` factory | SDK SPEC responsibility |
| Core computation internals | Core SPEC responsibility |
| Host execution internals | Host Contract responsibility |
| World governance rules | World Protocol responsibility |

---

## 4. Layering Model & Boundary

### 4.1 Runtime's Position

```
┌──────────────────────────────────────────────────┐
│  SDK Layer (Public API)                          │
│  createApp, App, ActionHandle, Session, Hooks    │
└──────────────────────┬───────────────────────────┘
                       │ delegates to
                       ▼
┌──────────────────────────────────────────────────┐
│  Runtime Layer (Internal Orchestration)           │  ← This SPEC
│  Pipeline, Policy, Memory, Branches, Subscriptions│
└──────────┬────────────────────────┬──────────────┘
           │                        │
           ▼                        ▼
    ┌──────────────┐         ┌──────────────┐
    │    Host      │         │    World     │
    │ (Execution)  │         │ (Governance) │
    └──────┬───────┘         └──────┬───────┘
           │                        │
           └────────────┬───────────┘
                        ▼
              ┌──────────────────┐
              │      Core        │
              │ (Pure Computation)│
              └──────────────────┘
```

### 4.2 Runtime's Constitutional Role

Per **ADR-001** and **ARCHITECTURE v2.0**:

```
Core computes meaning.     (pure, deterministic)
Host executes reality.     (IO, effects, mailbox)
World governs legitimacy.  (governance, lineage, audit)
Runtime orchestrates.      (pipeline, policy, memory, branches)
SDK presents.              (public API, DX, facades)
```

### 4.3 Runtime's "Does NOT Know" Boundary

| Runtime Does NOT Know | Reason | Rule ID |
|-----------------------|--------|---------|
| SDK's public API shape | Decoupled via delegation | RT-BOUNDARY-1 |
| Core computation internals | Layer separation | RT-BOUNDARY-2 |
| Host mailbox/runner internals | Opaque execution | RT-BOUNDARY-3 |
| World constitution/governance rules | Governance is World's | RT-BOUNDARY-4 |
| How effects are implemented | Host's responsibility | RT-BOUNDARY-5 |

### 4.4 Boundary Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-BOUNDARY-1 | MUST NOT | Runtime MUST NOT expose public developer APIs; that is SDK's responsibility |
| RT-BOUNDARY-2 | MUST NOT | Runtime MUST NOT depend on Core internal implementation |
| RT-BOUNDARY-3 | MUST NOT | Runtime MUST NOT depend on Host mailbox/runner internals |
| RT-BOUNDARY-4 | MUST NOT | Runtime MUST NOT modify World governance rules |
| RT-BOUNDARY-5 | MUST | Runtime MUST interact with Host only through HostExecutor interface |
| RT-BOUNDARY-6 | MUST | Runtime MUST interact with World only through World Protocol interface |

---

## 5. Execution Pipeline

### 5.1 Overview

The execution pipeline is the core orchestration sequence that transforms an action request into a World outcome. It consists of five sequential stages.

```
┌─────────┐   ┌───────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐
│ Prepare  │──▶│ Authorize │──▶│ Execute │──▶│ Persist │──▶│ Finalize │
└─────────┘   └───────────┘   └─────────┘   └─────────┘   └──────────┘
```

### 5.2 Pipeline Input

```typescript
type PipelineInput = {
  readonly type: string;
  readonly input: unknown;
  readonly actorId: ActorId;
  readonly branchId: BranchId;
  readonly baseWorld?: WorldId;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};
```

### 5.3 Stage 1: Prepare

**Purpose:** Validate the action and create a Proposal.

**Steps:**

1. Look up the action type in the current branch's DomainSchema
2. If action not found, MUST return `preparation_failed` result immediately
3. Resolve `baseWorld` (default: current branch head)
4. Create a `Proposal` with pre-allocated `proposalId`
5. Emit `action:preparing` hook

**Output:**

```typescript
type PrepareOutput = {
  readonly proposal: Proposal;
  readonly schema: DomainSchema;
  readonly schemaHash: SchemaHash;
};
```

**Early Exit:**

```typescript
// If action type not found in schema
type PreparationFailedResult = {
  readonly status: 'preparation_failed';
  readonly reason: string;
  readonly error?: ErrorValue;
};
```

### 5.4 Stage 2: Authorize

**Purpose:** Derive ExecutionKey and obtain Authority approval.

**Steps:**

1. Derive `ExecutionKey` via `PolicyService.deriveExecutionKey(proposal)`
2. Request Authority approval via `PolicyService.requestApproval(proposal)`
3. If rejected, MUST return rejected result (no World created)
4. Validate `ApprovedScope` via `PolicyService.validateScope(proposal, scope)`
5. If scope validation fails, MUST return rejected result
6. Emit `action:submitted` hook with derived ExecutionKey

**Output:**

```typescript
type AuthorizeOutput = {
  readonly executionKey: ExecutionKey;
  readonly decision: AuthorityDecision;
  readonly scope: ApprovedScope;
};
```

### 5.5 Stage 3: Execute

**Purpose:** Execute the intent via HostExecutor.

**Steps:**

1. Restore `baseSnapshot` from WorldStore via `worldStore.restore(proposal.baseWorld)`
2. Recall memory context (if memory enabled) with timeout and graceful degradation
3. Freeze memory context into Snapshot at `input.$app.memoryContext` (Context Freezing)
4. Execute via `HostExecutor.execute(key, frozenSnapshot, intent, opts)`
5. Optionally validate result scope via `PolicyService.validateResultScope()`
6. If post-execution scope violation, override outcome to `'failed'`

**Output:**

```typescript
type ExecuteOutput = {
  readonly terminalSnapshot: Snapshot;
  readonly outcome: 'completed' | 'failed';
  readonly error?: ErrorValue;
  readonly traceRef?: ArtifactRef;
};
```

### 5.6 Stage 4: Persist

**Purpose:** Seal the World and persist results.

**Steps:**

1. Submit execution result to World for sealing
2. World creates new World node with `terminalSnapshot`
3. Store World and delta in WorldStore
4. If outcome is `'completed'`, advance branch head to new World
5. If outcome is `'failed'`, World is created but branch head MUST NOT advance (BRANCH-7)
6. Update current state in SubscriptionStore
7. Emit `state:publish` hook (exactly once per Proposal Tick — INV-9)
8. Emit `world:created` hook
9. Ingest World into MemoryHub (if memory enabled)

**Output:**

```typescript
type PersistOutput = {
  readonly world: World;
  readonly worldId: WorldId;
  readonly snapshot: Snapshot;
};
```

### 5.7 Stage 5: Finalize

**Purpose:** Create terminal ActionResult and clean up.

**Steps:**

1. Construct `ActionResult` from pipeline context (completed, failed, or rejected)
2. If failed, update `system.lastError` in Snapshot
3. Emit `action:completed` hook
4. Set result on ActionHandle (resolves `completed()` promise)
5. Clean up proposal tracking

### 5.8 Pipeline Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PIPE-1 | MUST | Pipeline stages MUST execute in order: prepare → authorize → execute → persist → finalize |
| PIPE-2 | MUST | Pipeline MUST halt at `prepare` if action type not found (no World) |
| PIPE-3 | MUST | Pipeline MUST halt at `authorize` if Authority rejects (no World) |
| PIPE-4 | MUST | Pipeline MUST continue through `persist` and `finalize` even on execution failure (failed World) |
| PIPE-5 | MUST | `proposalId` MUST be pre-allocated in `prepare` stage before any validation |
| PIPE-6 | MUST | Pipeline runs that reach `persist` stage MUST emit `state:publish` exactly once. Runs halted at `prepare` or `authorize` do NOT emit `state:publish` (no World is created, so no state to publish). |
| PIPE-7 | MUST NOT | Pipeline stages MUST NOT be reordered or skipped |
| PIPE-8 | MUST | Pipeline MUST be re-entrant safe; concurrent pipelines MUST NOT interfere |

---

## 6. Host Integration

### 6.1 HostExecutor Interface

```typescript
/**
 * HostExecutor: Runtime's adapter for Host execution.
 * World interacts with execution ONLY through this interface.
 * Defined by World SPEC; Runtime MUST implement without redefining semantics.
 */
interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;

  abort?(key: ExecutionKey): void;
}
```

### 6.2 HostExecutionOptions

```typescript
/**
 * Defined by World SPEC. Runtime MUST NOT extend this type.
 * approvedScope is `unknown` at World boundary;
 * Runtime/Policy layer interprets and validates the actual ApprovedScope structure.
 */
type HostExecutionOptions = {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};
```

### 6.3 HostExecutionResult

```typescript
/**
 * Trace data is referenced via opaque ArtifactRef, not embedded.
 * This preserves World's ignorance of Host internal types (TraceEvent).
 */
type HostExecutionResult = {
  readonly outcome: 'completed' | 'failed';
  readonly terminalSnapshot: Snapshot;
  readonly error?: ErrorValue;
  readonly traceRef?: ArtifactRef;
};
```

### 6.4 Internal Host Wiring

Runtime MUST internally create and configure Host:

1. Convert SDK-level `EffectHandler` (2 params: `params, ctx`) to Host-level `EffectHandler` (3 params: `type, params, ctx`)
2. Register `system.get` as reserved effect type (compiler lowering)
3. Register all user-provided effects from `AppConfig.effects`

```typescript
/**
 * SDK-level EffectHandler (simplified):
 *   (params: unknown, ctx: AppEffectContext) => Promise<readonly Patch[]>
 *
 * Host-level EffectHandler:
 *   (type: string, params: unknown, ctx: EffectContext) => Promise<readonly Patch[]>
 *
 * Runtime bridges this gap internally.
 */
```

### 6.5 HostExecutor Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-HEXEC-1 | MUST | Runtime MUST implement HostExecutor interface |
| RT-HEXEC-2 | MUST NOT | HostExecutor MUST NOT leak Host internals to World |
| RT-HEXEC-3 | MUST | `execute()` MUST return HostExecutionResult (not throw) for execution failures |
| RT-HEXEC-4 | MUST | `execute()` MUST route to correct ExecutionKey mailbox |
| RT-HEXEC-5 | MUST NOT | HostExecutionResult MUST NOT contain Host internal types; use opaque ArtifactRef |
| RT-HEXEC-6 | MUST | Runtime MUST adapt SDK-level EffectHandler to Host-level EffectHandler internally |
| RT-HEXEC-7 | MUST | Runtime MUST register `system.get` as reserved effect type |

---

## 7. Policy System

### 7.1 PolicyService Interface

```typescript
interface PolicyService {
  /** Derive ExecutionKey for a Proposal */
  deriveExecutionKey(proposal: Proposal): ExecutionKey;

  /** Route Proposal to Authority and get decision */
  requestApproval(proposal: Proposal): Promise<AuthorityDecision>;

  /** Validate Proposal against ApprovedScope (pre-execution) */
  validateScope(proposal: Proposal, scope: ApprovedScope): ValidationResult;

  /** Validate execution result against ApprovedScope (post-execution) */
  validateResultScope?(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ValidationResult;
}
```

### 7.2 ExecutionKey Policy

```typescript
type ExecutionKeyPolicy = (proposal: Proposal) => ExecutionKey;
```

**Built-in Policies:**

| Policy | Key Format | Serialization | Use Case |
|--------|-----------|---------------|----------|
| `defaultPolicy` | `proposal:${proposalId}` | None (max parallelism) | Independent tasks |
| `actorSerialPolicy` | `actor:${actorId}` | Per actor | User action ordering |
| `baseSerialPolicy` | `base:${baseWorld}` | Per branch | Conflict prevention |
| `globalSerialPolicy` | `global` | Full | Strict ordering |
| `branchSerialPolicy` | `branch:${branchId}` | Per branch | Branch isolation |
| `intentTypePolicy` | `intent:${intentType}` | Per action type | Type-based ordering |

### 7.3 Authority Decision

```typescript
type AuthorityDecision = {
  readonly approved: boolean;
  readonly reason?: string;
  readonly scope?: ApprovedScope;
  readonly timestamp: number;
};
```

### 7.4 ApprovedScope

```typescript
type ApprovedScope = {
  readonly allowedPaths: readonly string[];
  readonly maxPatchCount?: number;
  readonly constraints?: Record<string, unknown>;
};
```

### 7.5 DefaultPolicyService

The default implementation provides:

- `deriveExecutionKey()`: Delegates to configured `ExecutionKeyPolicy` (default: `defaultPolicy`)
- `requestApproval()`: Delegates to configured `AuthorityHandler` (default: auto-approve with full scope)
- `validateScope()`: Delegates to configured `ScopeValidator` (default: always valid)
- `validateResultScope()`: Delegates to configured `ResultScopeValidator` (default: skip)

```typescript
type DefaultPolicyServiceOptions = {
  readonly executionKeyPolicy?: ExecutionKeyPolicy;
  readonly authorityHandler?: AuthorityHandler;
  readonly scopeValidator?: ScopeValidator;
  readonly resultScopeValidator?: ResultScopeValidator;
};

type AuthorityHandler = (proposal: Proposal) => Promise<AuthorityDecision>;
type ScopeValidator = (proposal: Proposal, scope: ApprovedScope) => ValidationResult;
type ResultScopeValidator = (
  baseSnapshot: Snapshot,
  terminalSnapshot: Snapshot,
  scope: ApprovedScope
) => ValidationResult;
```

### 7.6 Scope Path Rules

`allowedPaths` applies only to **World-owned data paths**:

| Included | Excluded |
|----------|----------|
| `data.*` (excluding platform namespaces) | `data.$host` (Host-owned) |
| | `data.$mel` (Compiler-owned) |
| | `system.*` (system state) |

### 7.7 Post-Execution Scope Violation

If post-execution scope validation fails:
- The World MUST still be created (execution already completed)
- The outcome MUST be overridden to `'failed'`
- The World is sealed as a failed World

**Rationale:** Reverting an already-completed execution would break World's execution-stage invariants.

### 7.8 Policy Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-POLICY-1 | MUST | Runtime MUST derive ExecutionKey via PolicyService |
| RT-POLICY-2 | MUST | Runtime MUST request Authority approval before execution |
| RT-POLICY-3 | MUST | Runtime MUST validate Proposal against scope before execution |
| RT-POLICY-4 | SHOULD | Runtime SHOULD validate result scope after execution |
| RT-POLICY-5 | MUST | Rejected Proposal MUST NOT create World |
| RT-POLICY-6 | MUST | ExecutionKey MUST be deterministic for same Proposal |
| RT-POLICY-7 | MUST | ExecutionKey MUST be fixed before execution starts |
| RT-POLICY-8 | MUST | Post-execution scope violation MUST result in failed World (not rollback) |
| RT-POLICY-9 | MUST | PolicyService MUST be injectable for testability |

---

## 8. External Memory

### 8.1 MemoryHub

MemoryHub manages multiple memory providers with fan-out:

```typescript
interface MemoryHub {
  /** Fan-out World events to all configured providers */
  ingest(world: World, snapshot: Snapshot): Promise<void>;

  /** Query providers for relevant context */
  recall(request: RecallRequest): Promise<RecallResult>;

  /** Execute maintenance operations across providers */
  maintain(ops: readonly MemoryMaintenanceOp[]): Promise<void>;
}
```

### 8.2 MemoryFacade

Two implementations:

```typescript
interface MemoryFacade {
  /** Whether memory is enabled */
  enabled(): boolean;

  /** Recall context from memory providers */
  recall(query: string, opts?: RecallOptions): Promise<RecallResult>;

  /** List available memory providers */
  providers(): readonly string[];

  /** Load historical worlds into providers */
  backfill(opts: BackfillOptions): Promise<void>;

  /** Execute maintenance (forget) operations */
  maintain(ops: readonly MemoryMaintenanceOp[]): Promise<void>;
}
```

**EnabledMemoryFacade:**
- `enabled()` returns `true`
- `recall()` delegates to MemoryHub with branch/actor validation
- All operations functional

**DisabledMemoryFacade:**
- `enabled()` returns `false`
- `recall()` MUST throw `MemoryDisabledError`
- `providers()` MUST return empty array
- `backfill()` and `maintain()` MUST throw `MemoryDisabledError`

### 8.3 Context Freezing

To preserve **determinism** across replays, recalled memory MUST be frozen as a value into the Snapshot:

```typescript
type AppExecutionContext = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
};

/**
 * Freeze memory context into Snapshot.
 * MUST be value copy (structuredClone), NOT reference.
 * Uses `$app` namespace to avoid collision with domain input fields.
 */
function freezeMemoryContext<T>(
  snapshot: Snapshot,
  context: T
): Snapshot {
  return {
    ...snapshot,
    input: {
      ...snapshot.input,
      $app: {
        ...(snapshot.input.$app ?? {}),
        memoryContext: structuredClone(context),
      },
    },
  };
}
```

### 8.4 Memory Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-MEM-1 | MUST | Recalled context MUST be frozen as value into `input.$app.memoryContext` |
| RT-MEM-2 | MUST | Replay MUST use frozen context from `input.$app`, NOT re-query MemoryStore |
| RT-MEM-3 | MUST NOT | memoryContext MUST NOT be passed via HostExecutionOptions |
| RT-MEM-4 | MUST NOT | MemoryStore failure MUST NOT block World execution |
| RT-MEM-5 | SHOULD | Recall SHOULD have timeout with graceful degradation |
| RT-MEM-6 | MUST | If memory disabled, `MemoryFacade.recall()` MUST throw `MemoryDisabledError` |
| RT-MEM-7 | MUST | If memory disabled, `MemoryFacade.enabled()` MUST return `false` |
| RT-MEM-8 | MUST | MemoryHub ingest MUST be called after World is created (persist stage) |
| RT-MEM-9 | MUST NOT | App MUST NOT extend `SnapshotMeta` (Core SPEC defines exactly 4 fields) |
| RT-MEM-10 | MUST | App reserved namespace is `input.$app` |
| RT-MEM-11 | MUST NOT | Domain schemas MUST NOT use `$app` prefix in input field names |

---

## 9. Branch Management

### 9.1 Overview

Branches are **named pointers** over the World DAG. Each branch tracks a head WorldId and a schemaHash.

### 9.2 BranchManager Interface

```typescript
interface BranchManager {
  /** Get current branch */
  current(): Branch;

  /** List all branches */
  list(): readonly Branch[];

  /** Get branch by ID */
  get(branchId: BranchId): Branch | undefined;

  /** Create a new branch (fork) */
  create(opts: CreateBranchOptions): Promise<Branch>;

  /** Switch to a branch */
  switch(branchId: BranchId): Promise<Branch>;

  /** Update branch head after successful execution */
  updateHead(branchId: BranchId, worldId: WorldId): void;
}

type Branch = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
  readonly parentBranch?: BranchId;
};

type CreateBranchOptions = {
  readonly name?: string;
  readonly from: WorldId;
  readonly schemaHash: SchemaHash;
  readonly switchTo?: boolean;
};
```

### 9.3 Head Advancement

Branch head advancement follows strict rules:

| Execution Outcome | Head Advances | World Created |
|-------------------|---------------|---------------|
| `completed` | Yes | Yes |
| `failed` | **No** | Yes (in lineage only) |
| `rejected` | No | No |
| `preparation_failed` | No | No |

### 9.4 Schema-Changing Fork

When `fork({ domain })` is invoked with a new DomainSchema:

1. Runtime MUST statically extract all effect types declared by the schema's actions
2. Runtime MUST verify that every required effect type is provided by the effects registry
3. If any required effect type is missing, the fork MUST fail without World creation
4. If compatible, create a new branch with the new `schemaHash`

```typescript
type SchemaCompatibilityResult =
  | { readonly compatible: true }
  | { readonly compatible: false; readonly missingEffects: readonly string[] };
```

### 9.5 Branch Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-BRANCH-1 | MUST | Runtime MUST have at least one branch ('main' by default) |
| RT-BRANCH-2 | MUST | Branch head MUST advance only on completed execution |
| RT-BRANCH-3 | MUST NOT | Branch head MUST NOT advance to failed World |
| RT-BRANCH-4 | MUST | `fork()` MUST create a new branch pointing to specified World |
| RT-BRANCH-5 | MUST | `switchBranch()` MUST update current branch pointer and state |
| RT-BRANCH-6 | MUST | Schema-changing fork MUST verify effect handler compatibility |
| RT-BRANCH-7 | MUST | Missing effect handler MUST cause fork to fail without World creation |
| RT-BRANCH-8 | SHOULD | `fork({ domain })` with new schema SHOULD create new internal Host |

---

## 10. Schema Registry

### 10.1 Overview

The Schema Registry manages DomainSchema instances, supporting MEL compilation, multiple schemas (schema-changing forks), and referential identity per schemaHash.

### 10.2 SchemaRegistry Interface

```typescript
interface SchemaRegistry {
  /** Register a compiled schema. Returns schemaHash. */
  register(schema: DomainSchema): SchemaHash;

  /** Get schema by hash */
  get(schemaHash: SchemaHash): DomainSchema | undefined;

  /** Get current branch's schema */
  getCurrent(): DomainSchema;

  /** Compile MEL text and register */
  compile(melText: string): Promise<DomainSchema>;
}
```

### 10.3 Schema Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-SCHEMA-1 | MUST | Repeated calls to `get()` with same schemaHash MUST return same cached instance |
| RT-SCHEMA-2 | MUST | After `switchBranch()` with different schemaHash, `getCurrent()` MUST return new schema |
| RT-SCHEMA-3 | MUST | If domain is MEL text, Runtime MUST compile it during `ready()` |
| RT-SCHEMA-4 | MUST | DomainSchema MUST be resolved and cached BEFORE plugins execute |
| RT-SCHEMA-5 | MUST | `schema.hash` MUST be the Core semantic hash (exclude `$`-prefixed platform fields) |

---

## 11. System Runtime

### 11.1 Overview

System Runtime handles **meta-operations** in the `system.*` namespace. It maintains a **separate execution context** from domain actions, with independent World lineage.

### 11.2 SystemRuntime

```typescript
type SystemActionType = `system.${string}`;

/**
 * Execution context for system actions.
 * Required for audit trail construction.
 */
type SystemExecutionContext = {
  readonly actorId: string;
  readonly proposalId: string;
  readonly timestamp: number;
};

interface SystemRuntime {
  /** Execute a system action */
  execute(
    type: SystemActionType,
    input: Record<string, unknown>,
    ctx: SystemExecutionContext
  ): Promise<ActionResult>;

  /** Check if action type is a system action */
  isSystemAction(type: string): boolean;

  /** Get current system world head */
  head(): WorldId;

  /** Query system world lineage */
  lineage(): Promise<readonly WorldId[]>;

  /** Get system runtime state */
  getState(): SystemRuntimeState;
}

type SystemRuntimeState = {
  readonly auditLog: readonly AuditEntry[];
};
```

### 11.3 System Schema

System Runtime uses a **fixed, internally-defined** schema (not user-defined). This schema defines system actions like `system.memory.maintain`.

### 11.4 Reserved System Actions

| Action Type | Description |
|-------------|-------------|
| `system.memory.maintain` | Memory maintenance (forget operations) |

### 11.5 `system.get` Distinction

`system.get` is **NOT** a System Runtime action. It is a **reserved effect type** used by compiler lowering (`$system.*` → `effect system.get(...)`) and is handled in the Host/effect execution path.

### 11.6 System Runtime Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-SYS-1 | MUST | System actions MUST use `system.*` namespace |
| RT-SYS-2 | MUST | System Runtime MUST be separate from Domain Runtime |
| RT-SYS-3 | MUST | System actions MUST NOT modify domain state |
| RT-SYS-4 | MUST | System Runtime schema MUST be fixed (not user-defined) |
| RT-SYS-5 | MUST NOT | `system.get` MUST NOT route through System Runtime |
| RT-SYS-6 | MUST | `system.get` MUST be treated as reserved effect type for compiler lowering only |
| RT-SYS-7 | MUST | Rejected system action MUST NOT create World |
| RT-SYS-8 | MUST | Failed system action MUST create World with `outcome: 'failed'` |
| RT-SYS-9 | MUST | System Runtime MUST maintain its own World lineage |
| RT-SYS-10 | MUST | Domain schema MUST NOT contain `system.*` action types |

---

## 12. Subscription Store

### 12.1 Overview

The Subscription Store manages reactive state subscriptions with selector-based change detection and configurable batching.

### 12.2 SubscriptionStore Interface

```typescript
interface SubscriptionStore {
  /** Update current state and notify subscribers */
  setState(state: AppState): void;

  /** Get current state */
  getState(): AppState;

  /** Register a subscriber with selector-based change detection */
  subscribe<TSelected>(
    selector: (state: AppState) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;

  /** Start a transaction (defer notifications) */
  startTransaction(): void;

  /** End a transaction (flush deferred notifications) */
  endTransaction(): void;

  /** Notify all subscribers of current state */
  notify(): void;

  /** Remove all subscribers */
  clear(): void;
}
```

### 12.3 SubscribeOptions

```typescript
type SubscribeOptions<T> = {
  /** Equality function for change detection (default: Object.is) */
  readonly equalityFn?: (a: T, b: T) => boolean;

  /** Fire listener immediately with current state */
  readonly fireImmediately?: boolean;

  /** Batch mode for notification timing */
  readonly batch?: BatchMode;
};

type BatchMode =
  | 'immediate'                    // Fire on every state change
  | 'transaction'                  // Defer until transaction completes
  | { readonly debounce: number }; // Debounced notifications (ms)
```

### 12.4 Subscription Store Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-SUB-1 | MUST | `subscribe()` MUST support selector-based change detection |
| RT-SUB-2 | MUST | Listener MUST NOT fire if selector output has not changed (per equalityFn) |
| RT-SUB-3 | MUST | `startTransaction()` MUST defer notifications until `endTransaction()` |
| RT-SUB-4 | SHOULD | Default equality function SHOULD be `Object.is` |
| RT-SUB-5 | MUST | `clear()` MUST remove all subscribers |
| RT-SUB-6 | MUST | Unsubscribe function MUST remove only the specific subscriber |

---

## 13. Action Queue

### 13.1 Overview

The Action Queue manages FIFO ordering for action execution within the same ExecutionKey. Actions with different ExecutionKeys MAY execute concurrently.

### 13.2 Queuing Semantics

| Scenario | Behavior |
|----------|----------|
| Different ExecutionKeys | Concurrent execution |
| Same ExecutionKey | FIFO serial execution |
| Queue overflow | Implementation-defined backpressure |

### 13.3 Action Queue Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-QUEUE-1 | MUST | Actions with same ExecutionKey MUST execute in FIFO order |
| RT-QUEUE-2 | MAY | Actions with different ExecutionKeys MAY execute concurrently |
| RT-QUEUE-3 | MUST | Each Proposal MUST get its own Proposal Tick (even if sharing ExecutionKey) |
| RT-QUEUE-4 | MUST NOT | Multiple proposals on same ExecutionKey MUST NOT merge into single Proposal Tick |

---

## 14. Lifecycle Management

### 14.1 Bootstrap Assembly

The `ready()` sequence MUST:

1. Compile domain if provided as MEL text
2. Validate that DomainSchema contains no `system.*` action types
3. Cache the resolved DomainSchema in SchemaRegistry
4. Emit `domain:resolved` hook
5. Create genesis snapshot with schema field defaults applied
6. Evaluate computed expressions on genesis snapshot
7. Create internal Host with user-provided effects (adapted to Host-level signatures)
8. Initialize Domain Runtime (HostExecutor, PolicyService, SubscriptionStore, BranchManager)
9. Initialize System Runtime with fixed system schema
10. Initialize MemoryHub/MemoryFacade (if memory configured)
11. Validate effects coverage if `validation.effects='strict'`
12. Initialize plugins in order
13. Emit `app:ready` hook

### 14.2 Genesis Snapshot

```typescript
// Genesis snapshot construction order:
// 1. Extract defaults from DomainSchema.state.fields[*].default
// 2. Override with config.initialData (initialData takes precedence)
// 3. Evaluate computed expressions on resulting data
// 4. Result is the genesis snapshot

const genesisSnapshot = createGenesisSnapshot(schema, initialData);
```

### 14.3 Disposal Sequence

The `dispose()` sequence MUST:

1. Transition status to `disposing`
2. Reject new ingress (new `act()` calls MUST throw)
3. Drain executing actions (graceful wait or abort per policy)
4. Clean up SubscriptionStore
5. Clean up MemoryHub
6. Clean up Host
7. Transition status to `disposed`

### 14.4 Lifecycle Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-LC-1 | MUST | Runtime MUST complete full bootstrap sequence before accepting actions |
| RT-LC-2 | MUST | DomainSchema MUST be resolved before plugin initialization |
| RT-LC-3 | MUST | Genesis snapshot MUST include schema defaults AND evaluated computed values |
| RT-LC-4 | MUST | `system.*` action types in DomainSchema MUST cause initialization failure |
| RT-LC-5 | MUST | Disposing Runtime MUST reject new ingress |
| RT-LC-6 | MUST | Disposing Runtime MUST drain executing actions before cleanup |
| RT-LC-7 | MUST | Runtime MUST validate effects coverage when `validation.effects='strict'` |

---

## 15. Publish Boundary

### 15.1 Tick Definition

This specification uses **Proposal Tick** as the authoritative tick boundary:

```
Proposal Tick = startExecution(proposal) → ... → terminalSnapshot reached
```

| Term | Scope | Description |
|------|-------|-------------|
| **Proposal Tick** | Runtime/World | One proposal execution cycle; publish boundary |
| **Mailbox Tick** | Host (internal) | Host's internal scheduling unit; NOT a publish boundary |

### 15.2 Publish Semantics

- `state:publish` MUST fire **exactly once** per Proposal Tick that reaches `persist` stage (at terminalSnapshot)
- `state:publish` MUST NOT fire for Proposal Ticks halted at `prepare` or `authorize` (no World created, no state change)
- `state:publish` MUST NOT fire per computed-node evaluation
- Multiple Proposals sharing the same ExecutionKey MUST NOT merge into a single publish boundary

### 15.3 Publish Boundary Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RT-PUB-1 | MUST | Runtime MUST publish state updates exactly once per Proposal Tick that reaches `persist` stage |
| RT-PUB-2 | MUST NOT | Runtime MUST NOT publish for Proposal Ticks halted before `persist` (`preparation_failed`, `rejected`) |
| RT-PUB-3 | MUST NOT | Runtime MUST NOT publish per computed-node evaluation |
| RT-PUB-4 | MUST NOT | Multiple Proposals on same ExecutionKey MUST NOT merge into single publish boundary |
| RT-PUB-5 | MUST | Tick boundary MUST be per-proposal, not per-mailbox |

---

## 16. Invariants

### 16.1 Execution Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| RT-INV-1 | Same input produces same output (Determinism) | Context Freezing |
| RT-INV-2 | Failed execution creates Failed World | Pipeline stage 4 |
| RT-INV-3 | Authority rejection creates no World | Pipeline stage 2 |
| RT-INV-4 | Preparation failure creates no World | Pipeline stage 1 |
| RT-INV-5 | One state:publish per Proposal Tick | Pipeline stage 4 |
| RT-INV-6 | Branch head advances only on completed | Pipeline stage 4 |
| RT-INV-7 | External Memory is separate from World history | Architecture |
| RT-INV-8 | Configuration error (missing effects) creates no World | Schema compatibility check |

### 16.2 Namespace Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| RT-INV-9 | `system.*` reserved for System Runtime | READY validation |
| RT-INV-10 | Domain schema MUST NOT contain `system.*` actions | READY validation |
| RT-INV-11 | `input.$app` reserved for Runtime | Namespace convention |
| RT-INV-12 | `data.$host` excluded from scope validation | Policy System |
| RT-INV-13 | `data.$mel` excluded from scope validation | Policy System |

---

## 17. Compliance

### 17.1 Compliance Checklist

- [ ] Implements five-stage execution pipeline (§5)
- [ ] Implements HostExecutor with effect handler adaptation (§6)
- [ ] Implements PolicyService with ExecutionKey derivation (§7)
- [ ] Implements MemoryFacade with Context Freezing (§8)
- [ ] Implements BranchManager with head advancement rules (§9)
- [ ] Implements SchemaRegistry with caching (§10)
- [ ] Implements System Runtime with separate lineage (§11)
- [ ] Implements SubscriptionStore with selector-based change detection (§12)
- [ ] Implements Action Queue with ExecutionKey-based routing (§13)
- [ ] Implements bootstrap/disposal lifecycle (§14)
- [ ] Enforces Publish Boundary (one state:publish per Proposal Tick) (§15)
- [ ] All invariants hold (§16)

---

## 18. References

### 18.1 Specifications

| Document | Version | Relevance |
|----------|---------|-----------|
| APP-SPEC | v2.3.0 | Parent specification (decomposed into Runtime + SDK) |
| Core SPEC | v2.0.0 | Snapshot, compute, apply, Patch |
| Host Contract | v2.0.2 | Execution model, mailbox, EffectHandler |
| World Protocol | v2.0.3 | Governance, lineage, HostExecutor |
| SDK SPEC | v0.1.0 | Public API layer (companion spec) |

### 18.2 Architecture Decision Records

| ADR | Scope |
|-----|-------|
| ADR-001 | Layer separation |
| ADR-APP-002 | createApp API simplification (effects-first) |
| ADR-003 | World owns persistence |

### 18.3 Foundational Design Rationales

| FDR | Scope |
|-----|-------|
| FDR-APP-PUB-001 | Tick definition, publish boundary |
| FDR-APP-RUNTIME-001 | Lifecycle, hooks, plugins |
| FDR-APP-INTEGRATION-001 | HostExecutor, WorldStore, maintenance |
| FDR-APP-POLICY-001 | ExecutionKey, authority, scope |
| FDR-APP-EXT-001 | MemoryStore, context freezing |

---

*End of Manifesto Runtime Specification v0.1.0*
