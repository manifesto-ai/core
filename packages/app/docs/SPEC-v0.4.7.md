# Manifesto App Public API Specification

**Version:** 0.4.7  
**Status:** Final  
**Date:** 2026-01-06  
**License:** MIT

## Abstract

This specification defines the public API for Manifesto App, a facade and orchestration layer over the Manifesto protocol stack (Core, Host, World Protocol, Memory). It provides developer-friendly interfaces for state management, action execution, memory integration, and system operations while maintaining full protocol compliance.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Conformance](#2-conformance)
3. [Terminology](#3-terminology)
4. [Architecture Overview](#4-architecture-overview)
5. [App Creation and Lifecycle](#5-app-creation-and-lifecycle)
6. [App Interface](#6-app-interface)
7. [State Model](#7-state-model)
8. [Action Execution](#8-action-execution)
9. [Branch Management](#9-branch-management)
10. [Session Management](#10-session-management)
11. [Hook System](#11-hook-system)
12. [Subscription API](#12-subscription-api)
13. [Services (Effect Handlers)](#13-services-effect-handlers)
14. [Memory Integration](#14-memory-integration)
15. [Plugin System](#15-plugin-system)
16. [System Runtime Model](#16-system-runtime-model)
17. [System Action Catalog](#17-system-action-catalog)
18. [Reserved Namespaces](#18-reserved-namespaces)
19. [Error Hierarchy](#19-error-hierarchy)
20. [Security Considerations](#20-security-considerations)
21. [References](#21-references)
22. [Appendix A: Type Definitions](#appendix-a-type-definitions)
23. [Appendix B: FDR Cross-Reference](#appendix-b-fdr-cross-reference)

---

## 1. Introduction

### 1.1 Purpose

Manifesto App provides a unified interface for building applications on the Manifesto protocol stack. It abstracts the complexity of coordinating Core, Host, World Protocol, and Memory components while exposing a clean, type-safe API.

### 1.2 Scope

This specification covers:

- App creation and lifecycle management
- Action execution with full lifecycle tracking
- Branch and session management
- Memory integration with the Memory SPEC v1.2
- System Runtime model for meta-operations
- System Actions for operational management
- Hook-based extensibility

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| Single Entry Point | `createApp(domain, opts)` as the sole factory |
| Explicit Initialization | `await app.ready()` MUST be called; no implicit lazy init |
| Observable Execution | ActionHandle for tracking proposal lifecycle |
| Safe Orchestration | Hook mutation guard with enqueue pattern |
| Protocol Compliance | No modification to underlying protocol semantics |
| Deterministic Audit | All operations traceable through worldlines |

### 1.4 Relationship to Other Specifications

This specification depends on:

- **Core SPEC v2.0.0**: Snapshot, patch, and computed semantics
- **Host SPEC v1.1**: Effect execution model
- **World Protocol SPEC v1.0**: DAG, Proposal, Decision, Authority model
- **Memory SPEC v1.2**: Selection, verification, and trace model
- **Compiler SPEC v0.4**: MEL compilation and `system.get` effect

---

## 2. Conformance

### 2.1 Conformance Keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119].

### 2.2 Conformance Classes

#### 2.2.1 Minimal Conformance

A conforming implementation MUST:

1. Implement all interfaces marked as REQUIRED
2. Enforce all rules marked as MUST
3. Throw specified errors for violation conditions
4. Maintain protocol compliance with dependent specifications
5. Implement System Runtime model for System Actions

#### 2.2.2 Full Conformance

A fully conforming implementation MUST additionally:

1. Implement all OPTIONAL interfaces
2. Support the complete System Action Catalog
3. Provide all hook events

### 2.3 Protocol Compliance

Implementations MUST NOT:

- Modify Core snapshot/patch/computed semantics
- Alter World Protocol DAG/Proposal/Decision model
- Change Host effect execution model
- Deviate from Memory SPEC v1.2 type definitions
- Use reserved namespaces for non-designated purposes

---

## 3. Terminology

| Term | Definition |
|------|------------|
| **Domain** | MEL text or compiled `DomainSchema` |
| **Domain Runtime** | Execution context for user domain, bound to user's `schemaHash` |
| **System Runtime** | Internal execution context for System Actions, with fixed schema |
| **Branch** | Pointer to current head worldId within a Domain Runtime |
| **Checkout** | Moving Branch head to a different worldId (same schema) |
| **Fork** | Creating a new Branch, optionally with schema change |
| **Session** | Execution context combining actorId and branchId |
| **ActionHandle** | Return value of `act()` for lifecycle observation |
| **MemoryHub** | Event collection and provider fan-out layer |
| **MigrationLink** | Audit record for schema-changing forks |
| **System Action** | Actions executed in System Runtime for operational management |
| **System World** | World in System Runtime's worldline, recording operational state |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Manifesto App                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Orchestration Layer                      │  │
│  │   (act/fork/hooks/ActionHandle/MemoryHub)                    │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┴──────────────────────────────────┐  │
│  │                       Dual Runtime Model                      │  │
│  │  ┌─────────────────────┐      ┌─────────────────────────┐   │  │
│  │  │   Domain Runtime    │      │    System Runtime       │   │  │
│  │  │  (user schemaHash)  │      │  (fixed system schema)  │   │  │
│  │  │                     │      │                         │   │  │
│  │  │  • Domain Actions   │      │  • System Actions       │   │  │
│  │  │  • User state       │      │  • Operational state    │   │  │
│  │  │  • Domain worldline │      │  • System worldline     │   │  │
│  │  └─────────────────────┘      └─────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ World Protocol│    │      Host       │    │     Memory      │
│ (DAG/Proposal)│    │ (Effect Exec)   │    │  (Selection)    │
└───────────────┘    └─────────────────┘    └─────────────────┘
```

### 4.1 Architectural Invariants

The following invariants are **constitutional** and MUST NOT be violated:

| ID | Invariant |
|----|-----------|
| **ARCH-1** | A Branch is a logical pointer to a worldId. A Branch is NOT a runtime, executor, thread, or scheduling context. Branch isolation refers to worldline separation, not execution engine separation. |
| **ARCH-2** | The Host is branch-agnostic and does not participate in scheduling. The Host executes exactly one Action atomically. Version checks in Host are safety guards, not concurrency resolution mechanisms. |
| **ARCH-3** | Single-writer (FIFO) execution within a branch is an App-level execution policy. This policy MUST NOT be implemented by Host or World. Violation of this policy MAY surface as version conflicts in Host. |
| **ARCH-4** | A version conflict during snapshot save indicates a violation of App execution policy, not a defect in Host or World semantics. |

**Interpretation guidance:**
- ARCH-1 prevents the misconception that "per-branch parallelism requires per-branch Host instances"
- ARCH-2 clarifies that Host is a stateless executor, not a scheduler
- ARCH-3 establishes that concurrency control belongs to App, not lower layers
- ARCH-4 ensures version conflicts are diagnosed as policy violations, not engine bugs

---

## 5. App Creation and Lifecycle

### 5.1 Factory Function

```typescript
function createApp(
  domain: MelText | DomainSchema,
  opts?: CreateAppOptions
): App;
```

The `createApp()` function MUST:

1. Return synchronously with an App instance
2. NOT perform runtime initialization during this call
3. Accept either MEL text string or compiled DomainSchema

### 5.2 CreateAppOptions

```typescript
interface CreateAppOptions {
  /** Initial data for genesis snapshot */
  initialData?: unknown;
  
  /** Effect handler mappings */
  services?: ServiceMap;
  
  /** Memory configuration */
  memory?: false | MemoryHubConfig;
  
  /** Plugin array */
  plugins?: readonly AppPlugin[];
  
  /** Validation settings */
  validation?: ValidationConfig;
  
  /** Actor policy */
  actorPolicy?: ActorPolicyConfig;
  
  /** System Action settings */
  systemActions?: SystemActionsConfig;
  
  /** Scheduler configuration */
  scheduler?: SchedulerConfig;
  
  /** Development tools */
  devtools?: DevtoolsConfig;
}
```

### 5.3 ActorPolicyConfig

```typescript
interface ActorPolicyConfig {
  /**
   * Actor policy mode.
   * - 'anonymous': Create anonymous actor if defaultActor not provided
   * - 'require': defaultActor MUST be provided
   * 
   * @default 'anonymous'
   */
  mode?: 'anonymous' | 'require';
  
  /** Default actor configuration */
  defaultActor?: {
    actorId: string;
    kind?: 'human' | 'agent' | 'system';
    name?: string;
    meta?: Record<string, unknown>;
  };
}
```

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| ACTOR-1 | If `mode='require'` and `defaultActor` is absent, `ready()` MUST throw `MissingDefaultActorError` |
| ACTOR-2 | If `mode='anonymous'` and `defaultActor` is absent, implementation MUST create actor with `actorId='anonymous'`, `kind='system'` |
| ACTOR-3 | Anonymous actor MUST be recorded as `actorId='anonymous'` in all traces |

### 5.4 ValidationConfig

```typescript
interface ValidationConfig {
  /**
   * Services validation mode.
   * - 'lazy': Validate at execution time
   * - 'strict': Validate at ready/fork time
   * 
   * @default 'lazy'
   */
  services?: 'lazy' | 'strict';
  
  /**
   * Policy for dynamic effect types in strict mode.
   * @default 'warn'
   */
  dynamicEffectPolicy?: 'warn' | 'error';
}
```

### 5.5 SystemActionsConfig

```typescript
interface SystemActionsConfig {
  /**
   * Enable System Actions.
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Authority policy for System Actions.
   * - 'permissive': Allow all (development)
   * - 'admin-only': Require admin role
   * - AuthorityPolicy: Custom policy
   * 
   * @default 'admin-only'
   */
  authorityPolicy?: 'permissive' | 'admin-only' | AuthorityPolicy;
  
  /** Disabled System Action types */
  disabled?: readonly string[];
}
```

### 5.6 SchedulerConfig

```typescript
interface SchedulerConfig {
  /** Maximum concurrent actions */
  maxConcurrent?: number;

  /** Action execution timeout in ms */
  defaultTimeoutMs?: number;

  /**
   * Serialize same-branch domain actions via FIFO queue.
   *
   * When true (default), actions on the same branch are executed
   * sequentially in submission order. This prevents version conflicts
   * from concurrent snapshot modifications.
   *
   * When false, actions may execute concurrently (use with caution).
   *
   * @default true
   */
  singleWriterPerBranch?: boolean;
}
```

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| SCHED-1 | When `singleWriterPerBranch=true` (default), domain actions on the same branch MUST be serialized via FIFO queue |
| SCHED-2 | FIFO serialization ensures actions complete in submission order on each branch |
| SCHED-3 | A failed action MUST NOT block subsequent actions in the queue (error recovery) |
| SCHED-4 | System actions MUST be serialized via a separate single FIFO queue regardless of `singleWriterPerBranch` |

**Implementation Notes:**

- Current architecture uses single Host per App, so all domain actions share a single queue
- Per-branch parallelism requires per-branch Host instances (future work)
- `act()` returns handle immediately; actual execution is queued
- Queue failures are isolated via `.catch(() => {})` pattern

### 5.7 Initialization

```typescript
interface App {
  ready(): Promise<void>;
}
```

The `ready()` method MUST:

1. Complete all asynchronous initialization
2. Compile domain if provided as MEL text
3. **Validate that DomainSchema contains no `system.*` action types** (NS-ACT-2)
4. Initialize Domain Runtime with user schema
5. Initialize System Runtime with fixed system schema
6. Validate services if `validation.services='strict'`
7. Initialize plugins in order
8. Throw appropriate errors for failures

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| READY-1 | Calling mutation/read APIs before `ready()` MUST throw `AppNotReadyError` |
| READY-2 | Affected APIs (non-exhaustive): `getState`, `subscribe`, `act`, `fork`, `switchBranch`, `currentBranch`, `listBranches`, `session`, `getActionHandle`, `getMigrationLinks`, `system.*`, `memory.*`, `branch.*` methods |
| READY-3 | Implicit lazy initialization is FORBIDDEN |
| READY-4 | If DomainSchema contains action types with `system.*` prefix, `ready()` MUST throw `ReservedNamespaceError` |
| READY-5 | If `CreateAppOptions.services` contains `system.get`, `ready()` MUST throw `ReservedEffectTypeError` |

### 5.8 Disposal

```typescript
interface App {
  dispose(opts?: DisposeOptions): Promise<void>;
}

interface DisposeOptions {
  /** Force immediate termination */
  force?: boolean;
  /** Graceful shutdown timeout in ms */
  timeoutMs?: number;
}
```

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| DISPOSE-1 | All API calls after `dispose()` MUST throw `AppDisposedError` |
| DISPOSE-2 | `dispose()` MUST trigger AbortSignal for pending operations |
| DISPOSE-3 | If `force=false`, MUST wait for in-progress actions; if `force=true`, MUST terminate immediately |

---

## 6. App Interface

### 6.1 Complete Interface

```typescript
interface App {
  // Lifecycle
  readonly status: AppStatus;
  readonly hooks: Hookable<AppHooks>;
  ready(): Promise<void>;
  dispose(opts?: DisposeOptions): Promise<void>;
  
  // Branch Management (Domain Runtime)
  currentBranch(): Branch;
  listBranches(): readonly Branch[];
  switchBranch(branchId: string): Promise<Branch>;
  fork(opts?: ForkOptions): Promise<Branch>;
  
  // Action Execution
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  
  /**
   * Get an existing ActionHandle by proposalId.
   * 
   * @throws ActionNotFoundError if proposalId is unknown
   */
  getActionHandle(proposalId: string): ActionHandle;
  session(actorId: string, opts?: SessionOptions): Session;
  
  // State Access (Domain Runtime)
  getState<T = unknown>(): AppState<T>;
  subscribe<TSelected>(
    selector: (state: AppState<any>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;
  
  // System Runtime Access
  readonly system: SystemFacade;
  
  // Memory
  readonly memory: MemoryFacade;
  
  // Audit
  getMigrationLinks(): readonly MigrationLink[];
}

type AppStatus = 'created' | 'ready' | 'disposing' | 'disposed';
```

---

## 7. State Model

### 7.1 AppState (Domain Runtime)

```typescript
interface AppState<TData = unknown> {
  readonly data: TData;
  readonly computed: Record<string, unknown>;
  readonly system: SystemState;
  readonly meta: SnapshotMeta;
}

interface SystemState {
  readonly status: 'idle' | 'computing' | 'pending' | 'error';
  readonly lastError: ErrorValue | null;
  readonly errors: readonly ErrorValue[];
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
}

interface SnapshotMeta {
  readonly version: number;
  readonly timestamp: number;
  readonly randomSeed: string;
  readonly schemaHash: string;
}
```

### 7.2 ErrorValue

```typescript
interface ErrorValue {
  readonly code: string;
  readonly message: string;
  readonly source: {
    actionId: string;
    nodePath: string;
  };
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}
```

---

## 8. Action Execution

### 8.1 ActionHandle Interface

```typescript
interface ActionHandle {
  /**
   * Proposal ID.
   * 
   * This ID is stable throughout the action lifecycle, including the `preparing` phase.
   * It can be used for reattachment via `app.getActionHandle(proposalId)` at any point.
   */
  readonly proposalId: string;
  
  /** Current phase snapshot */
  readonly phase: ActionPhase;
  
  /**
   * Target runtime.
   * 'domain' for user actions, 'system' for System Actions.
   */
  readonly runtime: 'domain' | 'system';
  
  /**
   * Wait for successful completion.
   * @throws ActionRejectedError - Authority rejected
   * @throws ActionFailedError - Execution failed
   * @throws ActionPreparationError - Preparation failed
   * @throws ActionTimeoutError - Timeout exceeded
   */
  done(opts?: DoneOptions): Promise<CompletedActionResult>;
  
  /**
   * Wait for any result (no throw except timeout).
   * @throws ActionTimeoutError - Timeout exceeded
   */
  result(opts?: DoneOptions): Promise<ActionResult>;
  
  /** Subscribe to phase changes */
  subscribe(listener: (update: ActionUpdate) => void): Unsubscribe;
  
  /**
   * Detach from this handle.
   * The proposal continues in World Protocol.
   */
  detach(): void;
}

interface DoneOptions {
  /** Maximum wait time in ms. @default Infinity */
  timeoutMs?: number;
}
```

### 8.2 ActionPhase

```typescript
type ActionPhase =
  | 'preparing'            // Pre-submission async work (recall, trace composition)
  | 'preparation_failed'   // Preparation failed (recall error, validation error, etc.)
  | 'submitted'            // Proposal submitted to World Protocol
  | 'evaluating'           // Authority evaluation (optional)
  | 'pending'              // HITL approval required
  | 'approved'             // Approved, awaiting execution
  | 'executing'            // Host executing effects
  | 'completed'            // Success, World created
  | 'rejected'             // Authority rejected (NO World created)
  | 'failed';              // Execution failed (World created with error state)
```

**World Protocol Mapping:**

| ActionPhase | World Protocol Status | World Created? |
|-------------|----------------------|----------------|
| `preparing` | (none) | No |
| `preparation_failed` | (none) | **No** |
| `submitted` | `submitted` | No |
| `evaluating` | - | No |
| `pending` | `pending` | No |
| `approved` | `approved` | No |
| `executing` | `executing` | No |
| `completed` | `completed` | **Yes** |
| `rejected` | `rejected` | **No** |
| `failed` | `failed` | **Yes** (with error) |

### 8.3 ActionResult Types

```typescript
type ActionResult =
  | CompletedActionResult
  | RejectedActionResult
  | FailedActionResult
  | PreparationFailedActionResult;

interface CompletedActionResult {
  readonly status: 'completed';
  readonly worldId: string;
  readonly proposalId: string;
  readonly decisionId: string;
  readonly stats: ExecutionStats;
  /** Which runtime produced this World */
  readonly runtime: 'domain' | 'system';
}

interface RejectedActionResult {
  readonly status: 'rejected';
  readonly proposalId: string;
  readonly decisionId: string;
  readonly reason?: string;
  /** Which runtime rejected this action */
  readonly runtime: 'domain' | 'system';
  /** No worldId - rejected actions do not create Worlds */
}

interface FailedActionResult {
  readonly status: 'failed';
  readonly proposalId: string;
  readonly decisionId: string;
  readonly error: ErrorValue;
  /** World created with error state */
  readonly worldId: string;
  readonly runtime: 'domain' | 'system';
}

interface PreparationFailedActionResult {
  readonly status: 'preparation_failed';
  readonly proposalId: string;
  readonly error: ErrorValue;
  /** Which runtime was targeted (preparation failed before submission) */
  readonly runtime: 'domain' | 'system';
}

interface ExecutionStats {
  durationMs: number;
  effectCount: number;
  patchCount: number;
}
```

### 8.4 ActOptions

```typescript
interface ActOptions {
  /** Actor override */
  actorId?: string;
  
  /**
   * Branch context.
   * 
   * - Domain Actions: Execution branch override (action runs against this branch's head)
   * - System Actions: Domain anchor for recall ONLY (MEM-SYS-2); does NOT affect System Runtime execution
   */
  branchId?: string;
  
  /**
   * Memory recall to attach to proposal.
   * 
   * For Domain Actions: atWorldId = branch.head()
   * For System Actions: atWorldId = Domain anchor (see §14.8)
   * 
   * IMPORTANT: If memory is disabled (memory: false), recall MUST NOT be used.
   * Providing recall when memory is disabled results in preparation_failed.
   * 
   * @see §14.8 for System Runtime recall rules
   * @see §14.9 for memory disabled behavior
   */
  recall?: false | RecallRequest | readonly RecallRequest[];
  
  /** Trace options */
  trace?: {
    enabled?: boolean;
    level?: 'minimal' | 'standard' | 'verbose';
  };
}
```

### 8.5 Preparing Phase Rules (MUST)

These rules ensure compliance with Memory SPEC M-3 (Selection Before Submission) and World Protocol P-4 (Proposal readonly after submission).

| Rule ID | Description |
|---------|-------------|
| ACT-PREP-1 | If `opts.recall` is present or other async preflight is required, handle MUST start in `preparing` phase |
| ACT-PREP-2 | Transition from `preparing` to `submitted` MUST NOT occur until Memory selection and trace composition are complete |
| ACT-PREP-3 | `'action:submitted'` hook MUST emit only when Proposal is actually submitted to World Protocol |
| ACT-PREP-4 | If no async preflight is needed, implementation MAY skip `preparing` and start at `submitted` |
| ACT-PREP-5 | Failure during `preparing` MUST result in `preparation_failed` status |

### 8.6 done() Contract Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| DONE-1 | `done()` MUST resolve only when `status='completed'` |
| DONE-2 | `status='rejected'` MUST throw `ActionRejectedError` |
| DONE-3 | `status='failed'` MUST throw `ActionFailedError` |
| DONE-4 | `status='preparation_failed'` MUST throw `ActionPreparationError` |
| DONE-5 | Timeout exceeded MUST throw `ActionTimeoutError` |
| DONE-6 | `result()` MUST resolve all statuses (throw only on timeout) |

### 8.7 detach() Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| DETACH-1 | `detach()` MUST unsubscribe handle only; World Protocol proposal continues |
| DETACH-2 | After `detach()`, calling `done()`/`result()`/`subscribe()` MUST throw `HandleDetachedError` |
| DETACH-3 | `app.getActionHandle(proposalId)` MUST enable re-attachment |
| DETACH-4 | Re-attached handle MUST support new subscriptions and track remaining phases |
| DETACH-5 | `detach()` during `preparing` phase MUST NOT stop preparation |

---

## 9. Branch Management

### 9.1 Branch Interface

```typescript
interface Branch {
  readonly id: string;
  readonly name?: string;
  readonly schemaHash: string;
  
  head(): string;
  checkout(worldId: string): Promise<void>;
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  fork(opts?: ForkOptions): Promise<Branch>;
  getState<T = unknown>(): AppState<T>;
  lineage(opts?: LineageOptions): readonly string[];
}

interface LineageOptions {
  limit?: number;
  untilWorldId?: string;
}
```

### 9.2 Checkout Validation Rules (MUST)

| Rule ID | Description | Error |
|---------|-------------|-------|
| CHECKOUT-1 | If worldId's schemaHash differs from branch.schemaHash | `WorldSchemaHashMismatchError` |
| CHECKOUT-2 | If worldId is not in branch's lineage | `WorldNotInLineageError` |
| CHECKOUT-3 | If worldId does not exist | `WorldNotFoundError` |

### 9.3 ForkOptions

```typescript
interface ForkOptions {
  name?: string;
  
  /** New domain triggers new Runtime creation */
  domain?: MelText | DomainSchema;
  
  /** Services for new Runtime */
  services?: ServiceMap;
  
  /** Migration strategy for schema changes */
  migrate?: 'auto' | MigrationFn;
  
  /** Switch to new branch after fork. @default true */
  switchTo?: boolean;
  
  /** Migration metadata */
  migrationMeta?: {
    reason?: string;
  };
}

type MigrationFn = (ctx: MigrationContext) => unknown;

interface MigrationContext {
  from: {
    schemaHash: string;
    worldId: string;
    state: AppState<any>;
  };
  to: {
    schemaHash: string;
    schema: DomainSchema;
  };
}
```

### 9.4 MigrationLink

Schema-changing forks create MigrationLink records for audit trail continuity.

```typescript
interface MigrationLink {
  readonly linkId: string;
  
  readonly from: {
    readonly schemaHash: string;
    readonly worldId: string;
    readonly branchId: string;
  };
  
  readonly to: {
    readonly schemaHash: string;
    readonly worldId: string;
    readonly branchId: string;
  };
  
  readonly migration: {
    readonly strategy: 'auto' | 'custom';
    readonly migratedAt: number;
    readonly migratedBy: ActorRef;
    readonly reason?: string;
  };
}
```

### 9.5 Fork Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| FORK-1 | Providing `domain` MUST create new Runtime with new schemaHash |
| FORK-2 | Schema change MUST create MigrationLink record |
| FORK-3 | If `migrate` is absent, implementation MUST attempt 'auto'; failure MUST throw `ForkMigrationError` |
| FORK-4 | If `validation.services='strict'`, new Runtime MUST pass validation |

---

## 10. Session Management

### 10.1 Session Interface

```typescript
interface Session {
  readonly actorId: string;
  readonly branchId: string;
  
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  recall(req: RecallRequest | readonly RecallRequest[]): Promise<RecallResult>;
  getState<T = unknown>(): AppState<T>;
}

interface SessionOptions {
  branchId?: string;
  kind?: 'human' | 'agent' | 'system';
  name?: string;
  meta?: Record<string, unknown>;
}
```

### 10.2 Session and Branch ActOptions Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| SESS-ACT-1 | `session.act()` MUST ignore `opts.branchId` if provided; session's fixed branchId is always used |
| SESS-ACT-2 | `branch.act()` MUST ignore `opts.branchId` if provided; the branch's own branchId is always used |
| SESS-ACT-3 | `session.act()` and `branch.act()` with `system.*` type MUST throw `SystemActionRoutingError` (see SYS-INV-2/3) |
| SESS-ACT-4 | `session.act()` MUST ignore `opts.actorId` if provided; session's fixed actorId is always used |

**Rationale**: Session provides a fixed (actorId + branchId) execution context. Allowing `actorId` or `branchId` override would undermine the purpose of sessions and could enable actor spoofing (bypassing authority/audit boundaries). World Protocol binds Proposals to Actors for accountability; session must preserve this binding. If override is needed, use `app.act()` directly.

**Note on `branch.act()`**: Unlike session, branch does not fix an actorId, so `opts.actorId` MAY be honored by `branch.act()` (defaults to ActorPolicy default if not provided).

---

## 11. Hook System

### 11.1 Hookable Interface

```typescript
interface Hookable<TEvents> {
  on<K extends keyof TEvents>(name: K, fn: TEvents[K]): Unsubscribe;
  once<K extends keyof TEvents>(name: K, fn: TEvents[K]): Unsubscribe;
}
```

### 11.2 HookContext

```typescript
interface HookContext {
  /**
   * Safe mutation scheduling.
   * Direct mutations in hooks are FORBIDDEN.
   */
  enqueue(job: EnqueuedJob, opts?: EnqueueOptions): void;
  
  actorId?: string;
  branchId?: string;
  worldId?: string;
}

type EnqueuedJob = () => void | Promise<void>;

interface EnqueueOptions {
  /**
   * Priority level.
   * - 'immediate': Before other pending jobs
   * - 'normal': FIFO (default)
   * - 'defer': After all normal jobs
   * 
   * @default 'normal'
   */
  priority?: 'immediate' | 'normal' | 'defer';
  
  /** Job identifier for debugging */
  label?: string;
}
```

### 11.3 Hook Mutation Guard Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| HOOK-MUT-1 | Direct mutation API calls within hook callbacks MUST throw `HookMutationError` |
| HOOK-MUT-2 | Affected APIs: `app.act`, `branch.act`, `session.act`, `app.fork`, `branch.fork`, `app.switchBranch`, `branch.checkout`, `memory.backfill` |
| HOOK-MUT-3 | Mutations MUST be scheduled via `ctx.enqueue()` |
| HOOK-MUT-4 | If both `HookMutationError` and `AppNotReadyError` conditions apply, `HookMutationError` takes precedence |

**Note on HOOK-MUT-4**: A hook callback executes after `ready()`, so `AppNotReadyError` should never occur inside a hook. However, if implementation quirks cause both conditions, the hook mutation guard is the more specific error.

### 11.4 enqueue Execution Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| ENQ-1 | Jobs MUST execute after hook callback completes |
| ENQ-2 | Jobs within same priority MUST execute in FIFO order |
| ENQ-3 | Priority order: `immediate` > `normal` > `defer` |
| ENQ-4 | Job failure MUST NOT prevent subsequent jobs from executing |
| ENQ-5 | Job failures MUST emit `'job:error'` hook |
| ENQ-6 | Jobs MAY recursively enqueue additional jobs |

### 11.5 Hook Events

```typescript
interface AppHooks {
  // Lifecycle
  'app:created': (ctx: HookContext) => void | Promise<void>;
  'app:ready:before': (ctx: HookContext) => void | Promise<void>;
  'app:ready': (ctx: HookContext) => void | Promise<void>;
  'app:dispose:before': (ctx: HookContext) => void | Promise<void>;
  'app:dispose': (ctx: HookContext) => void | Promise<void>;
  
  // Domain/Runtime
  'domain:resolved': (
    payload: { schemaHash: string; schema: DomainSchema },
    ctx: HookContext
  ) => void | Promise<void>;
  'runtime:created': (
    payload: { schemaHash: string; kind: 'domain' | 'system' },
    ctx: HookContext
  ) => void | Promise<void>;
  
  // Branch
  'branch:created': (
    payload: { branchId: string; schemaHash: string; head: string },
    ctx: HookContext
  ) => void | Promise<void>;
  'branch:checkout': (
    payload: { branchId: string; from: string; to: string },
    ctx: HookContext
  ) => void | Promise<void>;
  'branch:switched': (
    payload: { from: string; to: string },
    ctx: HookContext
  ) => void | Promise<void>;
  
  // Action Lifecycle
  /**
   * Action preparing event.
   * 
   * branchId is present for Domain Actions, absent for System Actions.
   */
  'action:preparing': (
    payload: { proposalId: string; actorId: string; branchId?: string; type: string; runtime: 'domain' | 'system' },
    ctx: HookContext
  ) => void | Promise<void>;
  /**
   * Action submitted event.
   * 
   * branchId is present for Domain Actions, absent for System Actions.
   */
  'action:submitted': (
    payload: { proposalId: string; actorId: string; branchId?: string; type: string; input: unknown; runtime: 'domain' | 'system' },
    ctx: HookContext
  ) => void | Promise<void>;
  'action:phase': (
    payload: { proposalId: string; phase: ActionPhase; detail?: ActionUpdateDetail },
    ctx: HookContext
  ) => void | Promise<void>;
  'action:completed': (
    payload: { proposalId: string; result: ActionResult },
    ctx: HookContext
  ) => void | Promise<void>;
  
  /**
   * System Action world creation event.
   * 
   * IMPORTANT: This hook emits ONLY when a System World is actually created,
   * i.e., when the System Action reaches 'completed' or 'failed' status.
   * Rejected System Actions do NOT emit this hook (no World created).
   * 
   * @see SYS-6
   */
  'system:world': (
    payload: { 
      type: string; 
      proposalId: string; 
      actorId: string; 
      systemWorldId: string;
      status: 'completed' | 'failed';
    },
    ctx: HookContext
  ) => void | Promise<void>;
  
  // Memory
  'memory:ingested': (
    payload: { provider: string; worldId: string },
    ctx: HookContext
  ) => void | Promise<void>;
  'memory:recalled': (
    payload: { provider: string; query: string; atWorldId: string; trace: MemoryTrace },
    ctx: HookContext
  ) => void | Promise<void>;
  
  // Migration
  'migration:created': (
    payload: { link: MigrationLink },
    ctx: HookContext
  ) => void | Promise<void>;
  
  // Job Queue
  'job:error': (
    payload: { error: unknown; label?: string },
    ctx: HookContext
  ) => void | Promise<void>;
  
  // Audit (for App API implicit System Action recording)
  'audit:rejected': (
    payload: { operation: string; reason?: string; proposalId: string },
    ctx: HookContext
  ) => void | Promise<void>;
  'audit:failed': (
    payload: { operation: string; error: ErrorValue; proposalId: string },
    ctx: HookContext
  ) => void | Promise<void>;
}
```

---

## 12. Subscription API

### 12.1 Subscribe Method

```typescript
interface App {
  subscribe<TSelected>(
    selector: (state: AppState<any>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;
}

type Unsubscribe = () => void;
```

### 12.2 SubscribeOptions

```typescript
interface SubscribeOptions<TSelected> {
  /**
   * Equality function for change detection.
   * @default Object.is
   */
  equalityFn?: (a: TSelected, b: TSelected) => boolean;
  
  /**
   * Batch mode for listener invocation.
   * - 'immediate': Every snapshot change
   * - 'transaction': Once per act() completion (default)
   * - { debounce: number }: Debounce in ms
   * 
   * @default 'transaction'
   */
  batchMode?: 'immediate' | 'transaction' | { debounce: number };
  
  /**
   * Invoke listener immediately with current value.
   * @default false
   */
  fireImmediately?: boolean;
}
```

---

## 13. Services (Effect Handlers)

Services provide effect handlers for Domain Runtime actions. System Runtime uses built-in handlers and does not use `CreateAppOptions.services`.

### 13.1 ServiceMap

```typescript
type ServiceMap = Record<string, ServiceHandler>;

type ServiceHandler = (
  params: Record<string, unknown>,
  ctx: ServiceContext
) => ServiceReturn | Promise<ServiceReturn>;

interface ServiceContext {
  snapshot: Readonly<AppState<any>>;
  actorId: string;
  worldId: string;
  branchId: string;
  patch: PatchHelpers;
  
  /** AbortSignal (best-effort; handler MAY ignore) */
  signal: AbortSignal;
}

type ServiceReturn =
  | void
  | Patch
  | readonly Patch[]
  | { patches: readonly Patch[] };
```

### 13.2 Patch Types

```typescript
type Patch =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'merge'; path: string; value: Record<string, unknown> }
  | { op: 'unset'; path: string };

interface PatchHelpers {
  set(path: string, value: unknown): Patch;
  merge(path: string, value: Record<string, unknown>): Patch;
  unset(path: string): Patch;
  many(...patches: readonly (Patch | readonly Patch[])[]): Patch[];
  from(record: Record<string, unknown>, opts?: { basePath?: string }): Patch[];
}
```

### 13.3 Services Validation Rules (MUST)

| Rule ID | Mode | Description |
|---------|------|-------------|
| SVC-1 | lazy | Missing service at execution MUST result in `MissingServiceError` (ActionResult.status='failed') |
| SVC-2 | strict | `ready()`/`fork()` MUST validate all statically-extracted effect types |
| SVC-3 | strict | Missing service MUST throw `MissingServiceError` |
| SVC-4 | strict + warn | Dynamic effect type MUST trigger console.warn |
| SVC-5 | strict + error | Dynamic effect type MUST throw `DynamicEffectTypeError` |

### 13.4 ServiceHandler Error Handling Rules (MUST)

Per Core SPEC, effect handlers should express errors as patches rather than throwing. However, App provides a safety net:

| Rule ID | Description |
|---------|-------------|
| SVC-ERR-1 | ServiceHandler SHOULD NOT throw; errors SHOULD be expressed via patches to error state |
| SVC-ERR-2 | If ServiceHandler throws, App MUST catch the exception |
| SVC-ERR-3 | Caught exception MUST result in ActionResult with `status='failed'` |
| SVC-ERR-4 | Caught exception MUST be converted to `ErrorValue` with `code='SERVICE_HANDLER_THROW'` |
| SVC-ERR-5 | The thrown error's message MUST be preserved in `ErrorValue.message` |

---

## 14. Memory Integration

### 14.1 Memory SPEC v1.2 Type Compliance

Implementations MUST use Memory SPEC v1.2 types exactly as defined:

```typescript
// Memory SPEC v1.2 §5.1.1
interface MemoryRef {
  readonly worldId: WorldId;
}

// Memory SPEC v1.2 §5.1.2
interface VerificationProof {
  readonly method: VerificationMethod;
  readonly proof?: unknown;
}

type VerificationMethod =
  | 'existence' | 'hash' | 'merkle' | 'signature' | 'none'
  | string;

// Memory SPEC v1.2 §5.1.3
interface VerificationEvidence {
  readonly method: VerificationMethod;
  readonly proof?: unknown;
  readonly verifiedAt: number;
  readonly verifiedBy: ActorRef;
}

// Memory SPEC v1.2 §5.1.4
interface SelectedMemory {
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;  // [0, 1]
  readonly verified: boolean;
  readonly evidence?: VerificationEvidence;
}

// Memory SPEC v1.2 §5.1.5
interface MemoryTrace {
  readonly selector: ActorRef;
  readonly query: string;
  readonly selectedAt: number;
  readonly atWorldId: WorldId;
  readonly selected: readonly SelectedMemory[];
}

// Memory SPEC v1.2 §5.3.1
interface SelectionRequest {
  readonly query: string;
  readonly atWorldId: WorldId;
  readonly selector: ActorRef;
  readonly constraints?: SelectionConstraints;
}

// Memory SPEC v1.2 §5.3.2
interface SelectionConstraints {
  readonly maxResults?: number;
  readonly minConfidence?: number;
  readonly requireVerified?: boolean;
  readonly requireEvidence?: boolean;
  readonly timeRange?: {
    readonly after?: number;
    readonly before?: number;
  };
}

// Memory SPEC v1.2 §5.3.3
interface SelectionResult {
  readonly selected: readonly SelectedMemory[];
  readonly selectedAt: number;
}
```

### 14.2 MemoryHubConfig

```typescript
interface MemoryHubConfig {
  providers: Record<string, MemoryProvider>;
  defaultProvider: string;
  
  routing?: {
    /** Determine target providers for ingest. Default: all providers */
    ingestTo?: (event: { worldId: string; schemaHash: string }) => readonly string[];
  };
  
  backfill?: BackfillConfig;
}

interface BackfillConfig {
  /**
   * Backfill mode.
   * - 'off': No backfill
   * - 'onCheckout': Backfill on checkout
   * - 'onRecall': Backfill when needed for recall
   * 
   * @default 'off'
   */
  mode?: 'off' | 'onCheckout' | 'onRecall';
  
  /** Maximum backfill depth (number of Worlds). @default 100 */
  maxDepth?: number;
}
```

### 14.3 MemoryProvider

```typescript
interface MemoryProvider {
  /** Ingest World events (optional) */
  ingest?: (entry: MemoryIngestEntry) => Promise<void>;
  
  /** Select memories (REQUIRED) */
  select: (req: SelectionRequest) => Promise<SelectionResult>;
  
  /** Verifier (optional; NoneVerifier used if absent) */
  verifier?: MemoryVerifier;
  
  meta?: {
    name?: string;
    version?: string;
    capabilities?: readonly ('ingest' | 'select' | 'verify')[];
  };
}

interface MemoryVerifier {
  /** PURE: Generate proof for memory */
  prove(memory: MemoryRef, world: World): ProveResult;
  
  /** PURE: Verify proof */
  verifyProof(proof: VerificationProof): boolean;
}

interface ProveResult {
  readonly valid: boolean;
  readonly proof?: VerificationProof;
  readonly error?: string;
}
```

### 14.4 Default NoneVerifier

Implementations MUST provide a default verifier when `provider.verifier` is absent:

```typescript
const NoneVerifier: MemoryVerifier = {
  prove(memory: MemoryRef, world: World): ProveResult {
    return {
      valid: false,
      proof: { method: 'none' },
      error: 'No verifier configured'
    };
  },
  
  verifyProof(proof: VerificationProof): boolean {
    // MUST always return false - unverified memories cannot become verified
    return false;
  }
};
```

**Security Rationale**: `verifyProof()` MUST return `false` for NoneVerifier to prevent unverified memories from being treated as verified. If this returned `true` for `method === 'none'`, implementations using `verified = verifier.verifyProof(proof)` would incorrectly mark unverified memories as verified, defeating `SelectionConstraints.requireVerified` and creating a security vulnerability.

### 14.4.1 Verified Computation Rule (MUST)

| Rule ID | Description |
|---------|-------------|
| VER-1 | `SelectedMemory.verified` MUST be `proveResult.valid && verifier.verifyProof(proof)` |
| VER-2 | NoneVerifier MUST always produce `verified = false` (since `proveResult.valid = false`) |
| VER-3 | `SelectionConstraints.requireVerified = true` MUST filter out all NoneVerifier results |

### 14.5 MemoryFacade

```typescript
interface MemoryFacade {
  enabled(): boolean;
  recall(
    req: RecallRequest | readonly RecallRequest[],
    ctx?: { actorId?: string; branchId?: string }
  ): Promise<RecallResult>;
  providers(): readonly string[];
  backfill(opts: { worldId: string; depth?: number }): Promise<void>;
}

type RecallRequest =
  | string
  | {
      query: string;
      provider?: string;
      constraints?: SelectionConstraints;
    };

interface RecallResult {
  readonly attachments: readonly {
    provider: string;
    trace: MemoryTrace;
  }[];
  readonly selected: readonly SelectedMemory[];
  readonly views: readonly MemorySelectionView[];
}
```

### 14.6 Multi-Recall Attach Policy

When multiple recalls are attached via `ActOptions.recall`:

```typescript
interface ProposalTraceContext {
  /** Standard extension point (synthesized single trace) */
  memory?: MemoryTrace;
  
  /** App extension (all individual traces for audit) */
  memoryTraces?: readonly MemoryTrace[];
}
```

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| ATTACH-1 | If `ActOptions.recall` is array, all recalls MUST complete before attach |
| ATTACH-2 | `context.memory` MUST contain synthesized single MemoryTrace |
| ATTACH-3 | `context.memoryTraces` MUST contain all individual MemoryTrace instances |
| ATTACH-4 | Synthesized trace MUST merge `selected` arrays; `query` SHOULD join with delimiter |
| ATTACH-5 | Transition to `submitted` MUST NOT occur until all recalls complete |

### 14.7 Memory Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| MEM-1 | App MUST collect **Domain Runtime** World creation events and deliver to MemoryHub |
| MEM-1a | System Runtime Worlds are NOT ingested by default (different schemaHash would confuse providers) |
| MEM-1b | Implementations MAY provide opt-in configuration for System World ingestion to separate providers |
| MEM-2 | MemoryHub MUST fan-out to providers according to routing config |
| MEM-3 | `provider.select()` MUST return Memory SPEC v1.2 `SelectionResult` |
| MEM-4 | Recall results MUST be returned as Memory SPEC v1.2 `MemoryTrace` |
| MEM-5 | MemoryTrace MUST be attachable to `Proposal.trace.context.memory` |
| MEM-6 | For Domain Actions, recall MUST use `atWorldId = branch.head()` |
| MEM-7 | All recalls MUST emit `'memory:recalled'` hook with trace |
| MEM-8 | If `provider.verifier` is absent, implementation MUST use NoneVerifier |

### 14.8 System Action Recall Rules (MUST)

Memory recall in System Actions requires special handling to maintain type consistency with Memory SPEC.

| Rule ID | Description |
|---------|-------------|
| MEM-SYS-1 | For System Actions, `SelectionRequest.atWorldId` MUST be anchored to a **Domain Runtime worldId** |
| MEM-SYS-2 | Default Domain anchor: `app.currentBranch().head()`; if `opts.branchId` provided, use that branch's head |
| MEM-SYS-3 | System Action recall selects from **Domain Runtime worldlines**, not System Runtime |
| MEM-SYS-4 | App MAY record System Runtime head at selection time in `ProposalTraceContext.systemAtWorldId` for audit correlation |
| MEM-SYS-5 | If System Action input specifies a domain worldId (e.g., `system.memory.backfill { worldId }`), that worldId MAY be used as anchor |

**Rationale**: `SelectionRequest.atWorldId` and `MemoryTrace.atWorldId` define the selection context anchor. Memory providers use this to scope lineage/schema/store queries. Using a System Runtime worldId (different schemaHash) would break provider implementations. The Domain anchor ensures type consistency while the optional `systemAtWorldId` extension preserves audit trail of which System World triggered the recall.

```typescript
interface ProposalTraceContext {
  /** Standard Memory trace (atWorldId = Domain anchor) */
  memory?: MemoryTrace;
  
  /** All individual traces for audit */
  memoryTraces?: readonly MemoryTrace[];
  
  /** System Runtime head at recall time (audit correlation) */
  systemAtWorldId?: string;
}
```

### 14.9 Memory Disabled Behavior (MUST)

When memory is disabled (`CreateAppOptions.memory = false`), the following rules apply:

| Rule ID | Description |
|---------|-------------|
| MEM-DIS-1 | `app.memory.enabled()` MUST return `false` |
| MEM-DIS-2 | `app.memory.recall()` MUST throw `MemoryDisabledError` |
| MEM-DIS-3 | `app.memory.backfill()` MUST throw `MemoryDisabledError` |
| MEM-DIS-4 | `app.memory.providers()` MUST return empty array `[]` |
| MEM-DIS-5 | `app.act(..., { recall: ... })` where recall is truthy MUST fail with `preparation_failed` status |
| MEM-DIS-6 | `PreparationFailedActionResult.error.code` MUST be `'MEMORY_DISABLED'` |
| MEM-DIS-7 | `'memory:ingested'` and `'memory:recalled'` hooks MUST NOT emit when memory is disabled |
| MEM-DIS-8 | `recall: []` (empty array) MUST be treated as "no recall" (not truthy for MEM-DIS-5 purposes) |

**Note on MEM-DIS-5/8**: The empty array `[]` is JavaScript-truthy but semantically means "no recall requests". To prevent developer confusion, empty array is explicitly treated as "no recall" and does not trigger preparation_failed.

**Note on MEM-DIS-6**: The error code `MEMORY_DISABLED` appears in the `ErrorValue` returned in the result, not in the thrown `ActionPreparationError` (which retains `code='ACTION_PREPARATION'`). This allows distinguishing specific preparation failure causes via result inspection while maintaining consistent exception types.

**Rationale**: Strict failure mode ensures developers don't accidentally rely on memory features in configurations where memory is disabled. Silent no-ops would mask configuration errors.

```typescript
// Example: memory disabled behavior
const app = createApp(domain, { memory: false });
await app.ready();

app.memory.enabled();     // false
app.memory.providers();   // []
app.memory.recall('query'); // throws MemoryDisabledError

// recall in act() → preparation_failed
const handle = app.act('todo.add', { title: 'x' }, { recall: 'context' });
const result = await handle.result();
// result.status === 'preparation_failed'
// result.error.code === 'MEMORY_DISABLED'
```

### 14.10 Standalone Recall Anchor Rules (MUST)

The standalone recall APIs (`app.memory.recall()` and `session.recall()`) need explicit anchor rules to ensure consistent `SelectionRequest.atWorldId` determination.

| Rule ID | Description |
|---------|-------------|
| MEM-REC-1 | `app.memory.recall(req, ctx)`: `atWorldId` MUST be `ctx.branchId`'s head if provided, else `app.currentBranch().head()` |
| MEM-REC-2 | `session.recall(req)`: `atWorldId` MUST always be `session.branchId`'s head |
| MEM-REC-3 | If `memory: false`, both `app.memory.recall()` and `session.recall()` MUST throw `MemoryDisabledError` |
| MEM-REC-4 | `MemoryTrace.selector` MUST be `ctx.actorId` / `session.actorId`, or ActorPolicy default if not provided |
| MEM-REC-5 | If `ctx.branchId` is provided but does not exist, `app.memory.recall()` MUST throw `BranchNotFoundError` |

**Rationale**: Memory providers use `atWorldId` to scope lineage/schema/store queries. Without explicit anchor rules, implementations would diverge on which worldId to use, breaking compatibility and reproducibility.

```typescript
// Example: standalone recall anchor behavior
const app = createApp(domain, { memory: { ... } });
await app.ready();

// app.memory.recall - uses currentBranch().head() by default
const result1 = await app.memory.recall('search query');
// atWorldId = app.currentBranch().head()

// app.memory.recall with explicit branchId
const result2 = await app.memory.recall('search query', { branchId: 'feature-branch' });
// atWorldId = app.listBranches().find(b => b.id === 'feature-branch').head()

// session.recall - always uses session's branch
const session = app.session('user-123', { branchId: 'feature-branch' });
const result3 = await session.recall('search query');
// atWorldId = feature-branch.head()
```

---

## 15. Plugin System

### 15.1 Plugin Type

```typescript
type AppPlugin = (app: App) => void | Promise<void>;
```

### 15.2 Plugin Behavior

- Plugins are registered at `createApp()` time
- Plugins execute sequentially during `app.ready()` (awaited)
- Hook registration is the primary plugin pattern
- Plugin failure MUST throw `PluginInitError`

---

## 16. System Runtime Model

### 16.1 Overview

System Actions operate in a separate **System Runtime** distinct from the user's Domain Runtime. This separation ensures:

1. **Protocol Compliance**: World Protocol's deterministic worldId calculation (schemaHash + snapshotHash) remains valid
2. **Clean Separation**: User domain state is not polluted by operational metadata
3. **Audit Integrity**: System operations create their own worldline for independent audit

### 16.2 Dual Runtime Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Manifesto App                           │
│                                                                 │
│  ┌─────────────────────────┐    ┌─────────────────────────┐   │
│  │     Domain Runtime      │    │     System Runtime      │   │
│  │                         │    │                         │   │
│  │  schemaHash: user's     │    │  schemaHash: fixed      │   │
│  │  state: user data       │    │  state: operational     │   │
│  │                         │    │                         │   │
│  │  ┌─────────────────┐   │    │  ┌─────────────────┐   │   │
│  │  │ Domain World    │   │    │  │ System World    │   │   │
│  │  │ (user actions)  │   │    │  │ (completed/     │   │   │
│  │  └────────┬────────┘   │    │  │  failed only)   │   │   │
│  │           │            │    │  └────────┬────────┘   │   │
│  │  ┌────────▼────────┐   │    │  ┌────────▼────────┐   │   │
│  │  │ Domain World    │   │    │  │ System World    │   │   │
│  │  └────────┬────────┘   │    │  └────────┬────────┘   │   │
│  │           │            │    │           │            │   │
│  │           ▼            │    │           ▼            │   │
│  │         (DAG)          │    │         (DAG)          │   │
│  └─────────────────────────┘    └─────────────────────────┘   │
│                                                                 │
│  Note: Rejected actions do NOT create Worlds in either runtime │
└─────────────────────────────────────────────────────────────────┘
```

### 16.3 System Runtime Schema

The System Runtime uses a fixed, internal schema. Implementations MUST use a schema that includes at minimum:

```typescript
interface SystemRuntimeState {
  /** Registered actors */
  actors: Record<string, {
    actorId: string;
    kind: 'human' | 'agent' | 'system';
    name?: string;
    meta?: Record<string, unknown>;
    enabled: boolean;
    authorityBindings?: string[];
  }>;
  
  /** Registered services */
  services: Record<string, {
    effectType: string;
    handlerRef: string;
    registeredAt: number;
    registeredBy: string;
  }>;
  
  /** Memory configuration */
  memoryConfig: {
    providers: string[];
    defaultProvider: string;
    routing?: unknown;
    backfill?: unknown;
  };
  
  /** Workflow states */
  workflows: Record<string, {
    workflowId: string;
    enabled: boolean;
    policy?: unknown;
  }>;
  
  /** Branch pointers (for audit, not actual state) */
  branchPointers: Record<string, {
    branchId: string;
    headWorldId: string;
    updatedAt: number;
    updatedBy: string;
  }>;
  
  /** Audit log entries */
  auditLog: Array<{
    timestamp: number;
    actorId: string;
    actionType: string;
    proposalId: string;
    worldId: string;
    summary: string;
  }>;
}
```

### 16.4 System Runtime Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| SYSRT-1 | App MUST initialize System Runtime with fixed system schema at `ready()` |
| SYSRT-2 | System Actions MUST execute in System Runtime, NOT Domain Runtime |
| SYSRT-3 | System Action execution that reaches `completed` or `failed` MUST create new System World |
| SYSRT-4 | System Action execution that is `rejected` MUST NOT create any World (per World Protocol) |
| SYSRT-5 | System Runtime's schemaHash MUST be constant (never changes) |
| SYSRT-6 | System World MUST record operational state changes as patches |
| SYSRT-7 | System Action effect handlers MUST return patches targeting System Runtime state |
| SYSRT-8 | `ActionHandle.runtime` MUST indicate which runtime executed the action |
| SYSRT-9 | `CompletedActionResult.runtime` and `FailedActionResult.runtime` MUST indicate which runtime produced the World |

### 16.5 SystemFacade

```typescript
interface SystemFacade {
  /**
   * Get current System Runtime state.
   */
  getState(): SystemRuntimeState;
  
  /**
   * Get System Runtime's current head worldId.
   */
  head(): string;
  
  /**
   * Get System Runtime's worldline (audit trail).
   */
  lineage(opts?: LineageOptions): readonly string[];
  
  /**
   * Subscribe to System Runtime state changes.
   */
  subscribe(
    listener: (state: SystemRuntimeState) => void
  ): Unsubscribe;
}
```

### 16.6 Action Routing

When `app.act(type, input)` is called:

1. If `type` starts with `system.` (except `system.get`), route to System Runtime
2. Otherwise, route to Domain Runtime

```typescript
// Domain Action → Domain Runtime
app.act('todo.add', { title: 'Buy milk' });

// System Action → System Runtime
app.act('system.actor.register', { actorId: 'agent-1', kind: 'agent' });
```

### 16.7 Cross-Runtime References

System Worlds MAY reference Domain worldIds for correlation:

```typescript
// Example: system.branch.checkout records which Domain worldId was checked out
interface BranchCheckoutPayload {
  branchId: string;
  toWorldId: string;        // Domain Runtime worldId
  systemWorldId: string;    // System World recording this operation (only if completed/failed)
}
```

This enables audit queries like "what operations affected Domain World X?"

---

## 17. System Action Catalog

### 17.1 Design Rationale

Manifesto's core values are **Determinism**, **Auditability**, and **Authority Governance**. Meta-operations (Actor/Branch/Schema/Service/Memory management) handled through privileged APIs would:

- Leave execution/permissions untraced
- Make approval/execution state opaque
- Break the governance discipline

System Actions model meta-operations as domain Actions executing in System Runtime, applying the same rules:

```
┌─────────────────────────────────────────────────────────────┐
│  All Actions                                                │
│  ┌─────────────────────────────────────────────────────────┤
│  │  Authority evaluation                                   │
│  │  Trace recording                                        │
│  │  World creation (only on completed/failed)              │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

### 17.2 Actor Management Actions

| Action Type | Input | Description |
|-------------|-------|-------------|
| `system.actor.register` | `{ actorId, kind?, name?, meta? }` | Register new Actor |
| `system.actor.disable` | `{ actorId, reason? }` | Disable Actor |
| `system.actor.updateMeta` | `{ actorId, meta }` | Update Actor metadata |
| `system.actor.bindAuthority` | `{ actorId, authorityId }` | Change Actor-Authority binding |

### 17.3 Branch Management Actions

| Action Type | Input | Description |
|-------------|-------|-------------|
| `system.branch.create` | `{ name?, fromWorldId? }` | Create Branch (Action version of fork) |
| `system.branch.checkout` | `{ branchId, toWorldId }` | Record checkout operation |
| `system.schema.migrate` | `{ newDomain, migrate?, reason? }` | Schema change + MigrationLink |

### 17.4 Services Management Actions

| Action Type | Input | Description |
|-------------|-------|-------------|
| `system.service.register` | `{ effectType, handlerRef }` | Register service |
| `system.service.unregister` | `{ effectType }` | Remove service |
| `system.service.replace` | `{ effectType, handlerRef }` | Replace service |

### 17.5 Memory Operations Actions

| Action Type | Input | Description |
|-------------|-------|-------------|
| `system.memory.configure` | `{ providers?, routing?, backfill? }` | Configure memory |
| `system.memory.backfill` | `{ worldId, depth? }` | Trigger explicit backfill |

### 17.6 Workflow Actions

| Action Type | Input | Description |
|-------------|-------|-------------|
| `system.workflow.enable` | `{ workflowId }` | Enable workflow |
| `system.workflow.disable` | `{ workflowId }` | Disable workflow |
| `system.workflow.setPolicy` | `{ workflowId, policy }` | Set workflow policy |

### 17.7 App API vs System Action Relationship

| App API | System Action | Difference |
|---------|---------------|------------|
| `app.fork()` | `system.branch.create` | API: immediate + System Action recorded; Action: explicit audit |
| `branch.checkout()` | `system.branch.checkout` | API: immediate + System Action recorded; Action: explicit audit |
| `app.memory.backfill()` | `system.memory.backfill` | API: immediate + System Action recorded; Action: explicit audit |

**Implementation Note**: App APIs (fork, checkout, etc.) SHOULD internally trigger corresponding System Actions to ensure audit trail. The difference is:

- **App API**: Convenient call, System Action recorded implicitly
- **System Action directly**: Explicit call, same audit trail

**Audit Failure Policy (MUST):**

| Rule ID | Description |
|---------|-------------|
| API-AUD-1 | If internal System Action audit is `rejected`, App API MUST still complete the operation (best-effort audit) |
| API-AUD-2 | Audit rejection MUST emit `'audit:rejected'` hook with operation details |
| API-AUD-3 | If internal System Action audit `failed`, App API MAY proceed but MUST emit `'audit:failed'` hook |
| API-AUD-4 | Implementations MAY provide `auditPolicy: 'strict'` option to fail App API when audit fails |

**Rationale**: App APIs are convenience wrappers. Blocking user operations due to audit infrastructure issues would degrade UX. Best-effort audit with observable hooks allows monitoring without blocking.

### 17.8 System Action Invocation Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| SYS-INV-1 | System Actions MUST be invoked via `app.act()` only |
| SYS-INV-2 | `branch.act()` with `system.*` type MUST throw `SystemActionRoutingError` |
| SYS-INV-3 | `session.act()` with `system.*` type MUST throw `SystemActionRoutingError` |

**Rationale**: `branch.act()` and `session.act()` carry `branchId` context that doesn't apply to System Runtime. Allowing `system.*` invocation through these APIs would create ambiguity about which runtime executes the action and what `atWorldId` means for recall.

### 17.9 System Action Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| SYS-1 | System Actions MUST use `system.*` namespace (except reserved `system.get`) |
| SYS-2 | All System Actions MUST undergo Authority evaluation |
| SYS-3 | System Actions reaching `completed` or `failed` MUST create System World in System Runtime |
| SYS-4 | System Actions that are `rejected` MUST NOT create any World (World Protocol compliance) |
| SYS-5 | Actions in `systemActions.disabled` MUST throw `SystemActionDisabledError` |
| SYS-5a | If `systemActions.enabled = false`, ALL `system.*` actions MUST throw `SystemActionDisabledError` |
| SYS-6 | `'system:world'` hook MUST emit ONLY when System World is created (`completed` or `failed`) |
| SYS-7 | `'system:world'` hook MUST NOT emit for `rejected` System Actions |

---

## 18. Reserved Namespaces

### 18.1 Effect Type Namespace Reservations

To prevent conflicts between Compiler-generated effects and App System Actions, the following namespace rules apply:

| Namespace | Reserved For | Description |
|-----------|--------------|-------------|
| `system.get` | Compiler SPEC v0.4 | MEL `$system.*` value access |
| `system.*` (except `system.get`) | App System Actions | Operational management |

### 18.2 Effect Type Namespace Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| NS-EFF-1 | `system.get` effect type is RESERVED for Compiler's MEL system value access |
| NS-EFF-2 | User domain actions/flows MUST NOT define effects with `system.*` prefix (except `system.get` which is Compiler-generated) |
| NS-EFF-3 | If user domain attempts `system.*` effect (except `system.get`), implementation MUST throw `ReservedNamespaceError` |
| NS-EFF-4 | Implementations MAY provide configuration to relax NS-EFF-2/NS-EFF-3 for migration purposes |

**Note on NS-EFF-2**: The `system.get` effect is generated by the Compiler when processing MEL `$system.*` expressions. User code does not "define" this effect; the Compiler emits it. NS-EFF-2 prohibits user-defined `system.*` effects in MEL source, not Compiler-generated effects.

### 18.3 Action Type Namespace Rules (MUST)

To prevent routing conflicts between Domain Actions and System Actions:

| Rule ID | Description |
|---------|-------------|
| NS-ACT-1 | User Domain actions MUST NOT use `system.*` prefix for action types |
| NS-ACT-2 | If DomainSchema contains action types with `system.*` prefix (including `system.get`), `ready()` MUST throw `ReservedNamespaceError` |
| NS-ACT-3 | Action type namespace validation MUST occur before Domain Runtime initialization |
| NS-ACT-4 | `app.act('system.get', ...)` MUST throw `ReservedNamespaceError`; `system.get` is an effect type, not an action type |

**Note on NS-ACT-4**: `system.get` is reserved as an **effect type** for Compiler-generated system value access. It is NOT a valid action type. Attempting to invoke it as an action is always an error.

### 18.4 System Action Types

```typescript
const SYSTEM_ACTION_TYPES = [
  // Reserved by Compiler
  // 'system.get' - NOT in this list, handled by Compiler
  
  // Actor Management
  'system.actor.register',
  'system.actor.disable',
  'system.actor.updateMeta',
  'system.actor.bindAuthority',
  
  // Branch Management
  'system.branch.create',
  'system.branch.checkout',
  'system.schema.migrate',
  
  // Services Management
  'system.service.register',
  'system.service.unregister',
  'system.service.replace',
  
  // Memory Operations
  'system.memory.configure',
  'system.memory.backfill',
  
  // Workflow
  'system.workflow.enable',
  'system.workflow.disable',
  'system.workflow.setPolicy',
] as const;

type SystemActionType = typeof SYSTEM_ACTION_TYPES[number];
```

### 18.5 `system.get` Built-in Handler Rules (MUST)

The `system.get` effect is reserved for Compiler SPEC v0.4 to implement MEL `$system.*` value access. Special handling rules apply:

| Rule ID | Description |
|---------|-------------|
| SYSGET-1 | App/Host MUST provide a built-in handler for `system.get` effect |
| SYSGET-2 | Any `ServiceMap` provided to App MUST NOT include `system.get` handler (applies to both `CreateAppOptions.services` AND `ForkOptions.services`) |
| SYSGET-3 | Attempt to register `system.get` in any services input MUST throw `ReservedEffectTypeError` |
| SYSGET-4 | `validation.services='strict'` MUST treat `system.get` as always satisfied (built-in) |
| SYSGET-5 | Built-in `system.get` handler MUST be deterministic and side-effect free |
| SYSGET-6 | Reserved effect validation (SYSGET-2/3) MUST occur at both `ready()` and `fork()` time |

**Rationale**: `system.get` provides access to system values (`$system.timestamp`, `$system.random`, etc.) compiled from MEL. Allowing user override would break determinism guarantees and compiler contracts. The built-in handler ensures consistent behavior across all implementations. Validation at both `ready()` and `fork()` prevents bypass via forked runtimes.

```typescript
// Example: system.get override attempts (all forbidden)
const app = createApp(domain, {
  services: {
    'system.get': () => { /* custom handler */ }  // ❌ FORBIDDEN at ready()
  }
});
await app.ready(); // Throws ReservedEffectTypeError

// Fork bypass attempt also blocked
const app2 = createApp(domain, { services: {} });
await app2.ready();
await app2.fork({
  services: { 'system.get': () => {} }  // ❌ FORBIDDEN at fork()
}); // Throws ReservedEffectTypeError

// Correct: system.get is automatically available
const app3 = createApp(domain, {
  services: {
    'http.fetch': httpFetchHandler,  // ✅ User services
  }
});
// system.get is built-in, no need to register
```

---

## 19. Error Hierarchy

### 19.1 Base Error

```typescript
abstract class ManifestoAppError extends Error {
  abstract readonly code: string;
  readonly timestamp: number;
  readonly cause?: unknown;
  
  constructor(message: string, opts?: { cause?: unknown });
}
```

### 19.2 Error Catalog

| Error Class | Code | Condition |
|-------------|------|-----------|
| `AppNotReadyError` | `APP_NOT_READY` | API call before `ready()` |
| `AppDisposedError` | `APP_DISPOSED` | API call after `dispose()` |
| `DomainCompileError` | `DOMAIN_COMPILE` | MEL compilation failure |
| `HookMutationError` | `HOOK_MUTATION` | Direct mutation in hook |
| `MissingServiceError` | `MISSING_SERVICE` | Effect handler not found |
| `MissingDefaultActorError` | `MISSING_ACTOR` | `mode='require'` but no `defaultActor` |
| `DynamicEffectTypeError` | `DYNAMIC_EFFECT` | Dynamic effect type in strict mode |
| `ForkMigrationError` | `FORK_MIGRATION` | Migration failure |
| `BranchNotFoundError` | `BRANCH_NOT_FOUND` | Branch does not exist |
| `WorldNotFoundError` | `WORLD_NOT_FOUND` | World does not exist |
| `WorldSchemaHashMismatchError` | `SCHEMA_MISMATCH` | Schema mismatch on checkout |
| `WorldNotInLineageError` | `NOT_IN_LINEAGE` | WorldId outside lineage |
| `ActionRejectedError` | `ACTION_REJECTED` | Authority rejected |
| `ActionFailedError` | `ACTION_FAILED` | Execution failed |
| `ActionPreparationError` | `ACTION_PREPARATION` | Preparing phase failure |
| `ActionTimeoutError` | `ACTION_TIMEOUT` | Timeout exceeded |
| `ActionNotFoundError` | `ACTION_NOT_FOUND` | Unknown proposalId |
| `HandleDetachedError` | `HANDLE_DETACHED` | Handle use after detach |
| `SystemActionDisabledError` | `SYSTEM_ACTION_DISABLED` | Disabled System Action invoked |
| `SystemActionRoutingError` | `SYSTEM_ACTION_ROUTING` | System Action invoked via `branch.act()` or `session.act()` |
| `MemoryDisabledError` | `MEMORY_DISABLED` | Memory operation when memory is disabled |
| `ReservedNamespaceError` | `RESERVED_NAMESPACE` | Attempt to use reserved namespace (effect or action type) |
| `ReservedEffectTypeError` | `RESERVED_EFFECT_TYPE` | Attempt to register handler for reserved effect type (e.g., `system.get`) |
| `PluginInitError` | `PLUGIN_INIT` | Plugin initialization failure |

---

## 20. Security Considerations

### 20.1 Authority Governance

All state modifications flow through Authority evaluation. Implementations SHOULD:

- Enforce principle of least privilege for actors
- Log all Authority decisions for audit
- Support multi-actor approval workflows for sensitive operations

### 20.2 System Action Security

System Actions that modify runtime configuration (services, memory, actors) SHOULD:

- Require elevated privileges (`admin-only` default)
- Be auditable through System Runtime worldline
- Support disabling specific actions per deployment

### 20.3 Memory Verification

For high-integrity deployments:

- Implement MemoryVerifier with cryptographic proofs
- Require `verified=true` for sensitive recalls
- Audit all memory selections via `'memory:recalled'` hook

### 20.4 Namespace Protection

The reserved namespace mechanism prevents:

- Accidental collision between user effects and system effects
- Privilege escalation through effect type or action type spoofing
- Confusion between Compiler-generated and App-generated effects
- Routing conflicts between Domain and System Actions

---

## 21. References

### 21.1 Normative References

- [RFC 2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- Manifesto Core SPEC v2.0.0
- Manifesto Host SPEC v1.1
- Manifesto World Protocol SPEC v1.0
- Manifesto Memory SPEC v1.2
- Manifesto Compiler SPEC v0.4

### 21.2 Informative References

- Manifesto App FDR v0.2.0
- Manifesto App System-as-Actions FDR v0.3.1

---

## Appendix A: Type Definitions

### A.1 Complete Type Summary

```typescript
// App Status
type AppStatus = 'created' | 'ready' | 'disposing' | 'disposed';

// Action Phase
type ActionPhase =
  | 'preparing' | 'preparation_failed' | 'submitted' | 'evaluating' | 'pending'
  | 'approved' | 'executing' | 'completed' | 'rejected' | 'failed';

// Action Results
type ActionResult =
  | CompletedActionResult
  | RejectedActionResult
  | FailedActionResult
  | PreparationFailedActionResult;

// Patch Operations
type Patch =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'merge'; path: string; value: Record<string, unknown> }
  | { op: 'unset'; path: string };

// Memory Types (from Memory SPEC v1.2)
type VerificationMethod =
  | 'existence' | 'hash' | 'merkle' | 'signature' | 'none'
  | string;

// Runtime Indicator
type RuntimeKind = 'domain' | 'system';

// Unsubscribe Function
type Unsubscribe = () => void;
```

### A.2 Imported Types

These types are referenced but defined in dependent specifications:

| Type | Source | Description |
|------|--------|-------------|
| `World` | World Protocol SPEC | Immutable world state node |
| `Proposal` | World Protocol SPEC | Action submission request |
| `Decision` | World Protocol SPEC | Authority evaluation result |
| `ActorRef` | World Protocol SPEC | Actor identifier reference |
| `DomainSchema` | Core SPEC / Compiler SPEC | Compiled MEL domain definition |
| `AuthorityPolicy` | World Protocol SPEC | Permission evaluation policy |

### A.3 App-Defined Types

These types are defined by this specification but not fully detailed in normative sections:

```typescript
/** Phase change notification */
interface ActionUpdate {
  readonly phase: ActionPhase;
  readonly previousPhase: ActionPhase;
  readonly detail?: ActionUpdateDetail;
  readonly timestamp: number;
}

/** Phase-specific details */
type ActionUpdateDetail =
  | { kind: 'pending'; approvers: readonly string[] }
  | { kind: 'rejected'; reason?: string }
  | { kind: 'failed'; error: ErrorValue }
  | { kind: 'completed'; worldId: string }
  | { kind: 'preparation_failed'; error: ErrorValue };

/** World event for memory ingestion */
interface MemoryIngestEntry {
  readonly worldId: string;
  readonly schemaHash: string;
  readonly snapshot: Readonly<AppState<unknown>>;
  readonly parentWorldId?: string;
  readonly createdAt: number;
  readonly createdBy: ActorRef;
}

/** Projected memory content for UI/display */
interface MemorySelectionView {
  readonly ref: MemoryRef;
  readonly summary: string;
  readonly relevance: number;
}

/** Pending HITL requirement */
interface Requirement {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly requiredApprovers?: readonly string[];
}
```

### A.4 System Action Types

```typescript
const SYSTEM_ACTION_TYPES = [
  'system.actor.register',
  'system.actor.disable',
  'system.actor.updateMeta',
  'system.actor.bindAuthority',
  'system.branch.create',
  'system.branch.checkout',
  'system.schema.migrate',
  'system.service.register',
  'system.service.unregister',
  'system.service.replace',
  'system.memory.configure',
  'system.memory.backfill',
  'system.workflow.enable',
  'system.workflow.disable',
  'system.workflow.setPolicy',
] as const;

type SystemActionType = typeof SYSTEM_ACTION_TYPES[number];
```

---

## Appendix B: FDR Cross-Reference

### B.1 App FDR (v0.2.0)

| FDR ID | Spec Section | Key Rules |
|--------|--------------|-----------|
| FDR-APP-001 | §5.6 | READY-1~4 |
| FDR-APP-002 | §11.3 | HOOK-MUT-1~3 |
| FDR-APP-003 | §11.4 | ENQ-1~6 |
| FDR-APP-004 | §8 | ActionHandle, ACT-PREP-1~5, DONE-1~6, DETACH-1~5 |
| FDR-APP-005 | §9.4, §9.5 | FORK-1~4, MigrationLink |
| FDR-APP-006 | §13.3, §13.4 | SVC-1~5, SVC-ERR-1~5 |
| FDR-APP-007 | §12 | SubscribeOptions.batchMode |
| FDR-APP-008 | §5.3 | ACTOR-1~3 |
| FDR-APP-009 | §9.2 | CHECKOUT-1~3 |
| FDR-APP-010 | §5.7 | DISPOSE-1~3 |
| FDR-APP-011 | §14 | MEM-1~8, MEM-SYS-1~5, MEM-DIS-1~7, ATTACH-1~5 |
| FDR-APP-012 | §19 | Error hierarchy |

### B.2 System FDR (v0.3.1)

| FDR ID | Spec Section | Key Rules |
|--------|--------------|-----------|
| FDR-SYS-001 | §16, §17 | System Runtime Model, System Action Catalog, SYS-1~7, SYS-INV-1~3 |
| FDR-SYS-002 | §6, §8 | World as Action product, App as Facade |
| FDR-SYS-003 | §8.2, §8.5 | Preparing phase, ACT-PREP-1~5 |
| FDR-SYS-004 | §9.4 | MigrationLink ledger |
| FDR-SYS-005 | §8.7 | detach/reattach, DETACH-1~5 |
| FDR-SYS-006 | §14.2 | MemoryHub single ingest + fan-out |
| FDR-SYS-007 | §16 | System Runtime separation, SYSRT-1~9 |
| FDR-SYS-008 | §18.3 | Action type namespace reservation, NS-ACT-1~3 |
| FDR-SYS-009 | §17.7 | App API audit failure policy, API-AUD-1~4 |
| FDR-SYS-010 | §14.8 | System Action recall Domain anchor, MEM-SYS-1~5 |
| FDR-SYS-011 | §11.5 | Hook payload branchId optional for System Actions |
| FDR-SYS-012 | §14.9 | Memory disabled behavior, MEM-DIS-1~7 |
| FDR-SYS-013 | §8.2 | preparation_failed phase in ActionPhase/ActionUpdateDetail |
| FDR-SYS-014 | §10.2 | Session/Branch context rules, SESS-ACT-1~4 |
| FDR-SYS-015 | §14.7 | Domain-only memory ingest default, MEM-1a/1b |
| FDR-SYS-016 | §14.10 | Standalone recall anchor rules, MEM-REC-1~5 |
| FDR-SYS-017 | §18.5 | system.get built-in handler rules, SYSGET-1~6 |
| FDR-SYS-018 | §18.2 | NS-EFF-2 system.get exception clarification |
| FDR-SYS-019 | §18.3 | NS-ACT-4 runtime system.get action rejection |

---

## Appendix C: Usage Examples

### C.1 Basic Application

```typescript
import { createApp } from '@manifesto/app';

const app = createApp(domainMel, {
  initialData: { todos: [] },
  services: {
    'http.fetch': async (params, ctx) => {
      const res = await fetch(String(params.url));
      return ctx.patch.set(String(params.into), await res.json());
    }
  },
});

await app.ready();

// Domain Action → Domain Runtime
const result = await app.act('todo.add', { title: 'Buy milk' }).done();
console.log('Created Domain World:', result.worldId);
console.log('Runtime:', result.runtime); // 'domain'
```

### C.2 System Action with Audit Trail

```typescript
// System Action → System Runtime
const handle = app.act('system.actor.register', {
  actorId: 'agent-research',
  kind: 'agent',
  name: 'Research Agent',
});

const result = await handle.result();

if (result.status === 'completed') {
  console.log('Created System World:', result.worldId);
  console.log('Runtime:', result.runtime); // 'system'
} else if (result.status === 'rejected') {
  // No worldId - rejected actions don't create Worlds
  console.log('Rejected:', result.reason);
}

// Query System Runtime audit trail
const systemState = app.system.getState();
console.log('Registered actors:', systemState.actors);
```

### C.3 Observing System World Creation

```typescript
// This hook fires ONLY when System World is actually created
app.hooks.on('system:world', (payload, ctx) => {
  console.log(`System World created: ${payload.systemWorldId}`);
  console.log(`Action: ${payload.type}`);
  console.log(`Status: ${payload.status}`); // 'completed' or 'failed'
});

// Rejected System Actions emit 'action:completed' with result.status='rejected'
// but do NOT emit 'system:world'
app.hooks.on('action:completed', (payload, ctx) => {
  if (payload.result.status === 'rejected') {
    console.log('System Action rejected, no World created');
  }
});
```

### C.4 Reserved Namespace Validation

```typescript
// This will throw ReservedNamespaceError at ready()
const badDomain = `
  action system.custom {
    state { x: 1 }
  }
`;

const app = createApp(badDomain);
await app.ready(); // Throws ReservedNamespaceError: 
                   // "Action type 'system.custom' uses reserved namespace"
```

---

## Appendix D: Change History

| Version | Date | Changes |
|---------|------|---------|
| 0.4.7 | 2026-01-06 | Security fix: NoneVerifier.verifyProof() MUST return false (VER-1~3); Added MEM-DIS-8 for empty array handling; Added SYS-5a for enabled=false; Added getActionHandle @throws; Added HOOK-MUT-4 for error priority |
| 0.4.6 | 2026-01-06 | Fixed NS-EFF-2/SYSGET rule conflict (system.get exception explicit); Extended SYSGET-2/3 to cover ForkOptions.services bypass (SYSGET-6); Added SESS-ACT-4 for session actorId override handling; Added MEM-REC-5 for branchId not found; Added NS-ACT-4 for runtime system.get action rejection |
| 0.4.5 | 2026-01-06 | Added standalone recall anchor rules (§14.10, MEM-REC-1~4); Added system.get built-in handler rules (§18.5, SYSGET-1~5); Expanded READY-2 as non-exhaustive; Added READY-5 for system.get registration; Added ReservedEffectTypeError; Clarified services are Domain Runtime only; Added runtime to RejectedActionResult/PreparationFailedActionResult |
| 0.4.4 | 2026-01-06 | Added `preparation_failed` to ActionPhase and ActionUpdateDetail; Fixed MEM-DIS-6 error code specification (ErrorValue.code, not exception code); Clarified proposalId is stable throughout lifecycle; Added SESS-ACT-1~3 for Session/Branch branchId override rules; Added MEM-1a/1b for Domain-only ingest default |
| 0.4.3 | 2026-01-06 | Fixed branchId semantic conflict (§8.4: Domain=execution, System=recall anchor); Made hook payload branchId optional (§11.5); Added memory disabled behavior (§14.9, MEM-DIS-1~7); Added MemoryDisabledError; Renamed SYSTEM_EFFECT_TYPES to SYSTEM_ACTION_TYPES |
| 0.4.2 | 2026-01-06 | Fixed System Action recall atWorldId (MEM-SYS-1~5 revised to use Domain anchor); Added SYS-INV-1~3 for invocation restriction; Added API-AUD-1~4 for audit failure policy; Added 'audit:rejected'/'audit:failed' hooks; Added SystemActionRoutingError; Added Imported/App-Defined Types appendix |
| 0.4.1 | 2026-01-06 | Fixed World Protocol compliance: SYS-3/4/6/7 for rejected handling; NS-ACT-1~3 for action type reservation; SVC-ERR-1~5 for handler throw handling; Renamed 'system:action' to 'system:world' hook |
| 0.4.0 | 2026-01-06 | Added System Runtime Model (§16); Reserved Namespaces (§18); SYSRT-1~8, NS-EFF-1~4 rules |
| 0.3.3 | 2026-01-06 | Added System Action Catalog (§17); FDR-SYS cross-reference |
| 0.3.2 | 2026-01-06 | Added `preparing` phase; Fixed SelectionResult type compliance |
| 0.3.1 | 2026-01-05 | Memory SPEC v1.2 alignment; done()/result() split; detach() pattern |
| 0.3.0 | 2026-01-05 | ActionHandle pattern; Hook mutation guards; Error hierarchy |
| 0.2.0 | 2026-01-04 | Initial public draft |

---

## Appendix E: Implementation Guidance

This appendix provides guidance for implementing App SPEC v0.4.7, particularly when using AI coding agents.

### E.1 Upstream Package Invariants

App implementation MUST NOT violate these constitutional invariants from upstream packages:

#### Host Contract (MUST respect)

| ID | Invariant |
|----|-----------|
| HOST-INV-1 | Snapshot is the single channel between Core and Host |
| HOST-INV-2 | No resume - execution is atomic |
| HOST-INV-3 | Effect handlers express results as `Patch[]` (throw forbidden philosophy) |
| HOST-INV-4 | Translator output MUST go through Compiler: lower → evaluate → apply |

#### World Protocol (MUST respect)

| ID | Invariant |
|----|-----------|
| WORLD-INV-1 | `worldId = hash(schemaHash + snapshotHash)` |
| WORLD-INV-2 | `rejected` proposals do NOT create Worlds |
| WORLD-INV-3 | Proposal is immutable after submission |
| WORLD-INV-4 | Authority evaluation is synchronous |

#### Memory SPEC v1.2 (MUST respect)

| ID | Invariant |
|----|-----------|
| MEM-INV-1 | 4-Layer architecture (Broker → Provider → Verifier → Storage) |
| MEM-INV-2 | Selection MUST complete before Proposal submission |
| MEM-INV-3 | Verifier purity - no side effects |
| MEM-INV-4 | Type definitions are canonical (no redefinition) |

#### Compiler SPEC (MUST respect)

| ID | Invariant |
|----|-----------|
| COMP-INV-1 | `system.get` is effect type, not action type |
| COMP-INV-2 | MEL source → DomainSchema transformation is Compiler's responsibility |
| COMP-INV-3 | Effect type extraction is static analysis |

### E.2 Reuse Priority

When implementing this specification, prioritize reuse of existing packages:

| Priority | Package | Reuse Target | App's Role |
|----------|---------|--------------|------------|
| P0 | @manifesto-ai/core | Snapshot, Patch, AppState types | Direct import |
| P0 | @manifesto-ai/world | Proposal, Decision, Authority types | Thin wrapper |
| P0 | @manifesto-ai/memory | MemoryTrace, SelectionResult, Provider | Direct import |
| P1 | @manifesto-ai/host | Effect execution model | Respect contract |
| P1 | @manifesto-ai/effect-utils | Handler combinators | Build services DX on top |
| P2 | @manifesto-ai/compiler | DomainSchema, system.get handling | Integration point |

### E.3 Anti-Patterns

Implementations MUST NOT exhibit these patterns:

| Anti-Pattern | Why Wrong | Correct Approach |
|--------------|-----------|------------------|
| New `Proposal` type | World Protocol already defines it | Import from @manifesto-ai/world |
| New `Patch` type | Core SPEC canonical type | Import from @manifesto-ai/core |
| New effect execution loop | Host contract violation | Use Host's executor |
| `system.get` as action handler | Compiler contract violation | Built-in effect handler only |
| Memory type redefinition | Memory SPEC canonical | Import from @manifesto-ai/memory |
| New state management | Core already provides | Use Core's Snapshot model |

### E.4 Agent-Assisted Implementation Process

When delegating implementation to coding agents, enforce this three-phase process:

**Phase 1: Inventory Pass (Read-Only)**
- Search existing codebase for reusable components
- Output "Reuse Candidate List" mapping App SPEC components to existing types
- NO code generation until inventory complete

**Phase 2: Spec↔Code Mapping Table**
- Map every SPEC API to implementation location
- Justify any new type definitions
- Document change plan with file list and diff summary

**Phase 3: Diff-First Implementation**
- Modify existing files with minimal changes
- New files require "no reuse candidate" justification
- PR order: thin facade → features → conformance tests

### E.5 Conformance Test Requirements

Implementations MUST pass conformance tests for:

**P0 - Protocol Compliance**
- `rejected` proposals create no World
- `worldId` formula respected
- Proposal immutable after submission

**P1 - Reserved Namespace**
- `system.get` is built-in effect (override forbidden)
- `system.*` action types rejected at ready()
- Fork cannot bypass service restrictions

**P2 - Lifecycle Integrity**
- Memory selection completes before submission
- Session context (actorId + branchId) immutable
- Hook mutation guard active

---

**End of Specification**
