# Manifesto SDK Specification v0.1.0

> **Status:** Draft
> **Scope:** Manifesto SDK Layer — Public Developer API
> **Compatible with:** Core SPEC v2.0.0, Host Contract v2.0.2, World Protocol v2.0.3, APP-SPEC v2.3.0, Runtime SPEC v0.1.0
> **Derived from:** APP-SPEC v2.3.0 §5–§7, §14, §16–§18; ADR-APP-002
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - **v0.1.0 (2026-02-11):** Initial draft — extracted from APP-SPEC v2.3.0
>   - **Fix:** `AppState.meta` aligned with Core SPEC SnapshotMeta (`timestamp: number`, `randomSeed` not `hash`)
>   - **Fix:** `AppState.system` aligned with Core SPEC SystemState (added `lastError: ErrorValue | null`, status union type, `currentAction: string | null`)
>   - **Fix:** Removed erroneous `input` field from `AppState` (not part of App-level state contract); added `state` DX alias

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Layering Model & Boundary](#4-layering-model--boundary)
5. [Core Types](#5-core-types)
6. [createApp Factory](#6-createapp-factory)
7. [App Interface](#7-app-interface)
8. [Lifecycle](#8-lifecycle)
9. [Action Handle](#9-action-handle)
10. [Session](#10-session)
11. [State Access & Subscription](#11-state-access--subscription)
12. [Branch API](#12-branch-api)
13. [System Facade](#13-system-facade)
14. [Memory Facade](#14-memory-facade)
15. [World Query API](#15-world-query-api)
16. [Hook System](#16-hook-system)
17. [Plugin System](#17-plugin-system)
18. [Error Types](#18-error-types)
19. [Invariants](#19-invariants)
20. [Compliance](#20-compliance)
21. [References](#21-references)

---

## 1. Purpose

This document defines the **Manifesto SDK Specification v0.1.0**.

The SDK layer is the **public developer-facing API** that:

- Provides the `createApp()` factory as the single entry point
- Defines the `App` interface for all application operations
- Defines `ActionHandle` for observable, asynchronous action execution
- Defines `Session` for actor-scoped operation context
- Defines public types (`AppConfig`, `Effects`, `AppState`, etc.)
- Provides Hook and Plugin systems for extensibility
- Provides facade interfaces for System Runtime and Memory operations
- Defines error types for developer-friendly error handling

**Relationship to Runtime:** The SDK layer delegates all internal orchestration to the Runtime layer (see runtime-SPEC). The SDK owns the public contract shape; the Runtime owns execution mechanics.

**Relationship to App:** This specification, together with the Runtime Specification, represents a decomposition of APP-SPEC v2.3.0. The combined contract of SDK + Runtime MUST be equivalent to the App layer's responsibilities as defined in APP-SPEC v2.3.0.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| `createApp()` factory | Configuration, validation, assembly |
| `App` interface | Public methods, lifecycle, read/write APIs |
| `ActionHandle` | Observable action execution, phase tracking |
| `Session` | Actor-scoped context with immutable binding |
| `AppConfig` | Configuration types and options |
| State access | `getState()`, `subscribe()`, `AppState<T>` |
| Branch API | Public branch operations (list, switch, fork) |
| Facade interfaces | `SystemFacade`, `MemoryFacade` (public contract) |
| Hook system | Hook registry, `AppHooks`, `AppRef` |
| Plugin system | Plugin interface, initialization contract |
| Error types | Public error hierarchy |
| World query | `getCurrentHead()`, `getSnapshot()`, `getWorld()` |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Execution pipeline internals | Runtime SPEC responsibility |
| HostExecutor implementation | Runtime SPEC responsibility |
| PolicyService internals | Runtime SPEC responsibility |
| MemoryHub/provider routing | Runtime SPEC responsibility |
| BranchManager implementation | Runtime SPEC responsibility |
| SchemaRegistry implementation | Runtime SPEC responsibility |
| Action Queue management | Runtime SPEC responsibility |
| Core computation | Core SPEC responsibility |
| Host execution model | Host Contract responsibility |
| World governance | World Protocol responsibility |

---

## 4. Layering Model & Boundary

### 4.1 SDK's Position

```
┌──────────────────────────────────────────────────┐
│  User / Application Code                         │
│  const app = createApp({ schema, effects });     │
│  const handle = app.act('todo:add', { ... });    │
└──────────────────────┬───────────────────────────┘
                       │ uses
                       ▼
┌──────────────────────────────────────────────────┐
│  SDK Layer (Public API)                          │  ← This SPEC
│  createApp, App, ActionHandle, Session, Hooks    │
└──────────────────────┬───────────────────────────┘
                       │ delegates to
                       ▼
┌──────────────────────────────────────────────────┐
│  Runtime Layer (Internal Orchestration)           │
│  Pipeline, Policy, Memory, Branches, Subscriptions│
└──────────────────────────────────────────────────┘
```

### 4.2 SDK's Constitutional Role

```
SDK presents.  (public API, DX, facades, extensibility)
```

The SDK layer is the **only** layer that end-developers interact with directly. It absorbs complexity and provides ergonomic APIs.

### 4.3 SDK's "Does NOT Know" Boundary

| SDK Does NOT Know | Reason | Rule ID |
|-------------------|--------|---------|
| How pipeline stages are executed | Runtime internal | SDK-BOUNDARY-1 |
| How HostExecutor bridges Host↔World | Runtime internal | SDK-BOUNDARY-2 |
| How PolicyService derives keys | Runtime internal | SDK-BOUNDARY-3 |
| How MemoryHub routes to providers | Runtime internal | SDK-BOUNDARY-4 |
| How BranchManager tracks heads | Runtime internal | SDK-BOUNDARY-5 |

### 4.4 Boundary Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-BOUNDARY-1 | MUST NOT | SDK MUST NOT expose Runtime internals to end-users |
| SDK-BOUNDARY-2 | MUST NOT | SDK MUST NOT expose Host or World instances directly |
| SDK-BOUNDARY-3 | MUST NOT | SDK MUST NOT require end-users to provide Host or Compiler |
| SDK-BOUNDARY-4 | MUST | SDK MUST delegate all orchestration to Runtime |
| SDK-BOUNDARY-5 | MUST | SDK MUST provide stable public types independent of internal changes |

---

## 5. Core Types

### 5.1 Identifiers

```typescript
type WorldId = string;
type ActorId = string;
type ProposalId = string;
type ExecutionKey = string;
type MemoryId = string;
type BranchId = string;
type SchemaHash = string;
```

### 5.2 App Status

```typescript
type AppStatus = 'created' | 'ready' | 'disposing' | 'disposed';
```

### 5.3 Action Phase

```typescript
type ActionPhase =
  | 'preparing'
  | 'preparation_failed'
  | 'submitted'
  | 'evaluating'
  | 'pending'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected';
```

### 5.4 Action Result

```typescript
type ActionResult =
  | CompletedActionResult
  | RejectedActionResult
  | FailedActionResult
  | PreparationFailedActionResult;

type CompletedActionResult = {
  readonly status: 'completed';
  readonly world: World;
  readonly snapshot: Snapshot;
  readonly stats?: ExecutionStats;
};

type FailedActionResult = {
  readonly status: 'failed';
  readonly world: World;
  readonly error: ErrorValue;
  readonly stats?: ExecutionStats;
};

type RejectedActionResult = {
  readonly status: 'rejected';
  readonly reason: string;
  readonly decision: AuthorityDecision;
};

type PreparationFailedActionResult = {
  readonly status: 'preparation_failed';
  readonly reason: string;
  readonly error?: ErrorValue;
};
```

**Result semantics:**

| Status | World Created | Description |
|--------|---------------|-------------|
| `completed` | Yes | Execution succeeded, World contains terminal snapshot |
| `failed` | Yes | Execution failed, World contains failure state |
| `rejected` | No | Authority denied approval |
| `preparation_failed` | No | Preparation failed before proposal submission |

### 5.5 Authority Types

```typescript
type AuthorityKind = 'auto' | 'human' | 'policy' | 'tribunal';

type AuthorityRef = {
  readonly kind: AuthorityKind;
  readonly id: string;
  readonly meta?: Record<string, unknown>;
};

type AuthorityDecision = {
  readonly approved: boolean;
  readonly reason?: string;
  readonly scope?: ApprovedScope;
  readonly timestamp: number;
};
```

### 5.6 ApprovedScope

```typescript
type ApprovedScope = {
  readonly allowedPaths: readonly string[];
  readonly maxPatchCount?: number;
  readonly constraints?: Record<string, unknown>;
};
```

### 5.7 Branch

```typescript
type Branch = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
  readonly parentBranch?: BranchId;
};
```

### 5.8 AppState

```typescript
/**
 * Complete app state.
 * Mirrors Core's Snapshot structure with DX alias.
 *
 * @see Core SPEC v2.0.0 §SnapshotMeta (4 fixed fields)
 * @see Core SPEC v2.0.0 §SystemState
 */
interface AppState<TData = unknown> {
  readonly data: TData;
  /** DX alias for `data`. Referential identity: `state === data`. */
  readonly state: TData;
  readonly computed: Record<string, unknown>;
  readonly system: SystemState;
  readonly meta: SnapshotMeta;
}

/**
 * System state within snapshot.
 *
 * Note: `lastError` is the most recent error (convenience accessor).
 *       `errors` is the full error history array.
 */
interface SystemState {
  readonly status: 'idle' | 'computing' | 'pending' | 'error';
  readonly lastError: ErrorValue | null;
  readonly errors: readonly ErrorValue[];
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
}

/**
 * Snapshot metadata.
 *
 * Core SPEC v2.0.0 defines exactly 4 fields. App MUST NOT extend this type.
 */
interface SnapshotMeta {
  readonly version: number;
  readonly timestamp: number;
  readonly randomSeed: string;
  readonly schemaHash: string;
}
```

### 5.9 Proposal (Low-Level)

```typescript
type Proposal = {
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly intentType: string;
  readonly intentBody: unknown;
  readonly baseWorld: WorldId;
  readonly branchId?: BranchId;
};

type ProposalResult =
  | { readonly status: 'completed'; readonly world: World }
  | { readonly status: 'failed'; readonly world: World; readonly error?: ErrorValue }
  | { readonly status: 'rejected'; readonly reason: string };
```

---

## 6. createApp Factory

### 6.1 Signature

```typescript
function createApp(config: AppConfig): App;
```

`createApp()` MUST return an `App` instance **synchronously**. The returned App is in `'created'` status and MUST have `ready()` called before use.

### 6.2 AppConfig

```typescript
type AppConfig = {
  // ─────────────────────────────────────────
  // Required
  // ─────────────────────────────────────────

  /** Domain schema (compiled DomainSchema or MEL source text) */
  readonly schema: DomainSchema | string;

  /** Effect handlers (required) */
  readonly effects: Effects;

  // ─────────────────────────────────────────
  // Optional: World (ADR-003)
  // ─────────────────────────────────────────

  /**
   * ManifestoWorld instance (optional).
   * If not provided, App creates an internal World with InMemoryWorldStore.
   * World owns persistence — App does NOT receive WorldStore directly.
   */
  readonly world?: ManifestoWorld;

  // ─────────────────────────────────────────
  // Optional: Policy
  // ─────────────────────────────────────────

  /** Custom PolicyService (default: auto-approve, unique key per proposal) */
  readonly policyService?: PolicyService;

  /** ExecutionKey policy shorthand (ignored if policyService provided) */
  readonly executionKeyPolicy?: ExecutionKeyPolicy;

  // ─────────────────────────────────────────
  // Optional: Memory
  // ─────────────────────────────────────────

  /** External memory store */
  readonly memoryStore?: MemoryStore;

  /** Memory provider for execution integration */
  readonly memoryProvider?: MemoryProvider;

  /** Memory hub configuration (false to disable) */
  readonly memory?: false | MemoryHubConfig;

  // ─────────────────────────────────────────
  // Optional: Extensibility
  // ─────────────────────────────────────────

  /** Plugins to install during ready() */
  readonly plugins?: readonly AppPlugin[];

  /** Pre-configured hooks */
  readonly hooks?: Partial<AppHooks>;

  // ─────────────────────────────────────────
  // Optional: Validation
  // ─────────────────────────────────────────

  readonly validation?: {
    /** Validate effects match schema requirements */
    readonly effects?: 'strict' | 'warn' | 'off';
  };

  // ─────────────────────────────────────────
  // Optional: Initial State
  // ─────────────────────────────────────────

  /** Initial data for genesis snapshot (overrides schema defaults) */
  readonly initialData?: unknown;

  // ─────────────────────────────────────────
  // Optional: Actor Policy
  // ─────────────────────────────────────────

  /** Actor policy configuration */
  readonly actorPolicy?: ActorPolicyConfig;

  // ─────────────────────────────────────────
  // Optional: Scheduler
  // ─────────────────────────────────────────

  /** Scheduler configuration */
  readonly scheduler?: SchedulerConfig;

  // ─────────────────────────────────────────
  // Optional: System Actions
  // ─────────────────────────────────────────

  /** System actions configuration */
  readonly systemActions?: SystemActionsConfig;

  // ─────────────────────────────────────────
  // Optional: Devtools
  // ─────────────────────────────────────────

  /** Devtools configuration */
  readonly devtools?: DevtoolsConfig;
};
```

### 6.3 Effects

```typescript
/**
 * Effect handler function signature for SDK layer.
 * Simplified from Host's EffectHandler — type is already determined
 * by the Effects record key, so only params and context are passed.
 *
 * Effect handlers:
 * - MUST return Patch[] (can be empty)
 * - MUST NOT throw exceptions (return error patches instead)
 * - MUST NOT contain domain logic
 */
type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext
) => Promise<readonly Patch[]>;

type Effects = Record<string, EffectHandler>;

type AppEffectContext = {
  readonly snapshot: Readonly<Snapshot>;
};
```

### 6.4 createApp Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-CREATE-1 | MUST | `createApp()` MUST return synchronously |
| SDK-CREATE-2 | MUST | Returned App MUST be in `'created'` status |
| SDK-CREATE-3 | MUST | `schema` and `effects` MUST be provided |
| SDK-CREATE-4 | MUST NOT | `createApp()` MUST NOT require end-users to provide Host or Compiler |
| SDK-CREATE-5 | MUST | If `world` not provided, MUST create internal World with InMemoryWorldStore |
| SDK-CREATE-6 | MUST | `createApp()` MUST validate reserved effect types (reject `system.get` override) |
| SDK-CREATE-7 | SHOULD | `createApp()` SHOULD accept MEL text string as schema |

---

## 7. App Interface

### 7.1 Full Interface

```typescript
interface App {
  // ═══════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════

  /** Current app status */
  readonly status: AppStatus;

  /** Hook registry */
  readonly hooks: Hookable<AppHooks>;

  /** Initialize the App */
  ready(): Promise<void>;

  /** Dispose the App */
  dispose(opts?: DisposeOptions): Promise<void>;

  // ═══════════════════════════════════════════════════
  // Schema Access
  // ═══════════════════════════════════════════════════

  getDomainSchema(): DomainSchema;

  // ═══════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════

  getState<T = unknown>(): AppState<T>;

  getSnapshot<T = unknown>(): AppState<T>;

  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;

  // ═══════════════════════════════════════════════════
  // Action Execution (High-Level API)
  // ═══════════════════════════════════════════════════

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;

  getActionHandle(proposalId: ProposalId): ActionHandle;

  // ═══════════════════════════════════════════════════
  // Proposal Execution (Low-Level API)
  // ═══════════════════════════════════════════════════

  submitProposal(proposal: Proposal): Promise<ProposalResult>;

  // ═══════════════════════════════════════════════════
  // Session
  // ═══════════════════════════════════════════════════

  session(actorId: ActorId, opts?: SessionOptions): Session;

  // ═══════════════════════════════════════════════════
  // Branch Management
  // ═══════════════════════════════════════════════════

  currentBranch(): Branch;
  listBranches(): readonly Branch[];
  switchBranch(branchId: BranchId): Promise<Branch>;
  fork(opts?: ForkOptions): Promise<Branch>;

  // ═══════════════════════════════════════════════════
  // System Runtime
  // ═══════════════════════════════════════════════════

  readonly system: SystemFacade;

  // ═══════════════════════════════════════════════════
  // Memory
  // ═══════════════════════════════════════════════════

  readonly memory: MemoryFacade;

  // ═══════════════════════════════════════════════════
  // World Query
  // ═══════════════════════════════════════════════════

  getCurrentHead(): WorldId;
  getSnapshot(worldId: WorldId): Promise<Snapshot>;
  getWorld(worldId: WorldId): Promise<World>;
  getHeads(): Promise<readonly WorldHead[]>;
  getLatestHead(): Promise<WorldHead | null>;

  // ═══════════════════════════════════════════════════
  // Audit
  // ═══════════════════════════════════════════════════

  getMigrationLinks(): readonly MigrationLink[];
}
```

### 7.2 ActOptions

```typescript
type ActOptions = {
  /** Actor performing the action (default: 'default') */
  readonly actorId?: ActorId;

  /** Target branch (default: current branch) */
  readonly branchId?: BranchId;

  /** Base world override (default: branch head) */
  readonly baseWorld?: WorldId;

  /** Timeout in milliseconds */
  readonly timeoutMs?: number;

  /** Abort signal */
  readonly signal?: AbortSignal;
};
```

### 7.3 ForkOptions

```typescript
type ForkOptions = {
  /** Fork point (default: current head) */
  readonly from?: WorldId;

  /** Branch name */
  readonly name?: string;

  /** New domain for schema-changing fork */
  readonly domain?: DomainSchema | string;

  /** Switch to new branch after creation (default: false) */
  readonly switchTo?: boolean;
};
```

### 7.4 SubscribeOptions

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
  | 'immediate'
  | 'transaction'
  | { readonly debounce: number };
```

### 7.5 DisposeOptions

```typescript
type DisposeOptions = {
  /** Wait for executing actions or abort immediately */
  readonly force?: boolean;

  /** Timeout for graceful shutdown */
  readonly timeoutMs?: number;
};
```

### 7.6 App Interface Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-APP-1 | MUST | App MUST implement all required interface methods |
| SDK-APP-2 | MUST | Mutation/read APIs before `ready()` MUST throw `AppNotReadyError` |
| SDK-APP-3 | MUST | `act()` MUST return ActionHandle synchronously |
| SDK-APP-4 | MUST | `submitProposal()` MUST return ProposalResult |
| SDK-APP-5 | MUST NOT | App MUST NOT expose internal Host, Runtime, or World instances |
| SDK-APP-6 | MUST | `getDomainSchema()` MUST return current branch's schema |
| SDK-APP-7 | MUST | `getDomainSchema()` MUST throw `AppNotReadyError` if not yet resolved |

---

## 8. Lifecycle

### 8.1 State Transitions

```
created ────ready()────► ready ◄───────┐
                           │           │
                           │ act()     │ action complete
                           ▼           │
                        (executing)────┘
                           │
                           │ dispose()
                           ▼
                       disposing ────cleanup────► disposed
```

### 8.2 Ready Sequence (SDK Perspective)

`ready()` MUST:

1. Compile domain if provided as MEL text
2. Validate that DomainSchema contains no `system.*` action types
3. Resolve and cache the DomainSchema
4. Emit `domain:resolved` hook
5. Create genesis snapshot (schema defaults + `config.initialData` + computed evaluation)
6. Initialize Runtime components
7. Initialize plugins in order
8. Emit `app:ready` hook

### 8.3 Lifecycle Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-LC-1 | MUST | App MUST start in `'created'` status |
| SDK-LC-2 | MUST | `ready()` MUST be called before mutation/read APIs |
| SDK-LC-3 | MUST | `dispose()` MUST drain executing actions before cleanup |
| SDK-LC-4 | MUST NOT | Disposed App MUST NOT accept new actions |
| SDK-LC-5 | SHOULD | Plugin errors during initialization SHOULD be catchable |
| SDK-READY-1 | MUST | APIs before `ready()` resolves MUST throw `AppNotReadyError` |
| SDK-READY-1a | EXCEPTION | `getDomainSchema()` is callable after schema resolved (before `ready()` resolves) |
| SDK-READY-4 | MUST | If DomainSchema contains `system.*` action types, `ready()` MUST throw `ReservedNamespaceError` |
| SDK-READY-6 | MUST | DomainSchema MUST be resolved and cached BEFORE plugins execute |
| SDK-READY-7 | MUST | Genesis snapshot MUST include schema field defaults; `config.initialData` MUST override schema defaults |
| SDK-READY-8 | MUST | Genesis snapshot MUST include evaluated computed values derived from initial state |

---

## 9. Action Handle

### 9.1 Overview

ActionHandle provides **observable action execution**, allowing callers to track progress, await completion, and subscribe to phase changes.

### 9.2 ActionHandle Interface

```typescript
interface ActionHandle {
  /** Unique proposal ID (stable throughout lifecycle) */
  readonly proposalId: ProposalId;

  /** Current phase */
  readonly phase: ActionPhase;

  /** Actor performing the action */
  readonly actorId: ActorId;

  /** Action type */
  readonly type: string;

  /** Runtime type */
  readonly runtime: 'domain' | 'system';

  /**
   * Wait for action to complete.
   * Resolves with CompletedActionResult (throws on failure/rejection).
   */
  done(opts?: DoneOptions): Promise<CompletedActionResult>;

  /**
   * Wait for action to reach terminal state.
   * Resolves with ActionResult (never throws).
   */
  result(opts?: DoneOptions): Promise<ActionResult>;

  /**
   * Subscribe to action updates (phase changes, completion).
   */
  subscribe(listener: (update: ActionUpdate) => void): Unsubscribe;

  /**
   * Detach handle from tracking.
   * The action continues but handle no longer receives updates.
   */
  detach(): void;
}

type DoneOptions = {
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;

  /** Abort signal */
  readonly signal?: AbortSignal;
};
```

### 9.3 ActionUpdate

```typescript
type ActionUpdate = {
  readonly proposalId: ProposalId;
  readonly phase: ActionPhase;
  readonly detail?: ActionUpdateDetail;
  readonly timestamp: number;
};

type ActionUpdateDetail =
  | { readonly kind: 'phase_change'; readonly from: ActionPhase; readonly to: ActionPhase }
  | { readonly kind: 'completed'; readonly result: ActionResult }
  | { readonly kind: 'error'; readonly error: ErrorValue };
```

### 9.4 `done()` vs `result()`

| Method | Resolves | Throws |
|--------|----------|--------|
| `done()` | On `completed` only | On `failed`, `rejected`, `preparation_failed` |
| `result()` | On any terminal state | Never (returns ActionResult with status) |

### 9.5 ActionHandle Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-HANDLE-1 | MUST | `act()` MUST return ActionHandle synchronously |
| SDK-HANDLE-2 | MUST | `result()` MUST resolve when action reaches terminal state |
| SDK-HANDLE-3 | MUST | `phase` MUST reflect current action phase |
| SDK-HANDLE-4 | MUST | `subscribe()` MUST fire for each phase transition |
| SDK-HANDLE-5 | MUST | `done()` MUST throw on failed/rejected results |
| SDK-HANDLE-6 | MUST | `result()` MUST NOT throw (returns result with status) |
| SDK-HANDLE-7 | MUST | `preparation_failed` phase MUST resolve `result()` with `status: 'preparation_failed'` |
| SDK-HANDLE-8 | MUST | `preparation_failed` result MUST NOT contain World reference |
| SDK-HANDLE-9 | MUST | `proposalId` MUST be pre-allocated in `preparing` phase (before validation) |
| SDK-HANDLE-10 | MUST | On `preparation_failed`, ActionHandle MUST complete with the pre-allocated `proposalId` |
| SDK-HANDLE-11 | MUST | `detach()` MUST stop updates to handle without cancelling execution |

---

## 10. Session

### 10.1 Overview

Session provides an **actor-scoped context** for action execution, reducing boilerplate for repeated operations by the same actor. Once created, the actor binding is immutable.

### 10.2 Session Interface

```typescript
interface Session {
  /** Actor ID for this session (immutable) */
  readonly actorId: ActorId;

  /** Optional branch binding (immutable) */
  readonly branchId?: BranchId;

  /**
   * Execute an action in this session's context.
   * Uses session's actorId and branchId.
   */
  act(type: string, input?: unknown, opts?: SessionActOptions): ActionHandle;

  /**
   * Recall memory context within this session's scope.
   * @throws MemoryDisabledError if memory not configured
   */
  recall(query: string, opts?: RecallOptions): Promise<RecallResult>;

  /**
   * Get current state for this session's branch.
   */
  getState<T = unknown>(): AppState<T>;
}

type SessionOptions = {
  /** Branch to bind (default: current branch at session creation) */
  readonly branchId?: BranchId;

  /** Session kind (metadata) */
  readonly kind?: string;

  /** Session name (metadata) */
  readonly name?: string;

  /** Additional metadata */
  readonly meta?: Record<string, unknown>;
};

/** actorId and branchId cannot be overridden */
type SessionActOptions = Omit<ActOptions, 'actorId' | 'branchId'>;
```

### 10.3 Session Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SESS-1 | MUST | Session MUST bind actorId for all actions |
| SDK-SESS-2 | MUST | `session.act()` MUST use session's actorId |
| SDK-SESS-3 | MAY | Session MAY bind to a specific branch |
| SDK-SESS-ACT-1 | MUST NOT | `opts.actorId` in `session.act()` MUST NOT be allowed (context override forbidden) |
| SDK-SESS-ACT-2 | MUST NOT | `opts.branchId` in `session.act()` MUST NOT be allowed if session has branchId |
| SDK-SESS-ACT-3 | MUST | Session MUST reject `system.*` action types (throw error) |
| SDK-SESS-ACT-4 | MUST | Session MUST maintain actor binding for entire lifetime |
| SDK-SESS-MEM-1 | MUST | `session.recall()` MUST throw `MemoryDisabledError` if memory not configured |

---

## 11. State Access & Subscription

### 11.1 getState()

```typescript
getState<T = unknown>(): AppState<T>;
```

Returns the current application state for the active branch.

### 11.2 subscribe()

```typescript
subscribe<TSelected>(
  selector: (state: AppState<unknown>) => TSelected,
  listener: (selected: TSelected) => void,
  opts?: SubscribeOptions<TSelected>
): Unsubscribe;
```

Subscribes to state changes with selector-based change detection.

### 11.3 State Access Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-STATE-1 | MUST | `getState()` MUST return current branch's state |
| SDK-STATE-2 | MUST | `subscribe()` MUST fire only when selector output changes |
| SDK-STATE-3 | MUST | `getState()` before `ready()` MUST throw `AppNotReadyError` |
| SDK-STATE-4 | SHOULD | Default equality function SHOULD be `Object.is` |
| SDK-STATE-5 | MUST | Unsubscribe function MUST remove only the specific subscription |
| SDK-STATE-6 | MAY | `subscribe()` MAY support `fireImmediately` to invoke listener at registration time |

---

## 12. Branch API

### 12.1 Public Branch Operations

```typescript
/** Get current branch */
currentBranch(): Branch;

/** List all branches */
listBranches(): readonly Branch[];

/** Switch to a different branch */
switchBranch(branchId: BranchId): Promise<Branch>;

/** Create a new branch (fork) */
fork(opts?: ForkOptions): Promise<Branch>;
```

### 12.2 Branch API Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-BRANCH-1 | MUST | App MUST have at least one branch ('main' by default) |
| SDK-BRANCH-2 | MUST | `currentBranch()` MUST return the active branch |
| SDK-BRANCH-3 | MUST | `fork()` MUST create a new branch pointing to specified World |
| SDK-BRANCH-4 | MUST | `switchBranch()` MUST update current branch pointer and state |
| SDK-BRANCH-5 | SHOULD | `fork({ domain })` SHOULD support schema-changing forks |
| SDK-BRANCH-6 | MUST | Schema-changing fork MUST verify effect handler compatibility before branching |
| SDK-BRANCH-7 | MUST | Missing effect handler MUST cause fork to fail without World creation |

---

## 13. System Facade

### 13.1 SystemFacade Interface

```typescript
interface SystemFacade {
  /** Execute a system action */
  act(type: `system.${string}`, input?: unknown): ActionHandle;

  /** Memory maintenance operations */
  readonly memory: SystemMemoryFacade;
}

interface SystemMemoryFacade {
  /** Run memory maintenance (forget-only) */
  maintain(opts: MemoryMaintenanceOptions): ActionHandle;
}

type MemoryMaintenanceOptions = {
  readonly operations: readonly MemoryMaintenanceOp[];
  readonly actorId?: ActorId;
};
```

### 13.2 Reserved System Actions

| Action Type | Description |
|-------------|-------------|
| `system.memory.maintain` | Memory maintenance (forget operations) |

### 13.3 System Facade Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SYS-1 | MUST | System actions MUST use `system.*` namespace |
| SDK-SYS-2 | MUST | `system.act()` MUST return ActionHandle |
| SDK-SYS-3 | MUST NOT | Session MUST NOT be able to invoke `system.*` actions |

---

## 14. Memory Facade

### 14.1 MemoryFacade Interface

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

type RecallOptions = {
  readonly worldId?: WorldId;
  readonly limit?: number;
  readonly actorId?: ActorId;
  readonly branchId?: BranchId;
};
```

### 14.2 Memory Facade Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-MEM-1 | MUST | If memory disabled, `recall()` MUST throw `MemoryDisabledError` |
| SDK-MEM-2 | MUST | If memory disabled, `enabled()` MUST return `false` |
| SDK-MEM-3 | MUST | If memory disabled, `providers()` MUST return empty array |
| SDK-MEM-4 | MUST NOT | Memory failure MUST NOT block action execution |

---

## 15. World Query API

### 15.1 Interface

```typescript
/** Get current head WorldId */
getCurrentHead(): WorldId;

/** Get snapshot for a World */
getSnapshot(worldId: WorldId): Promise<Snapshot>;

/** Get World metadata */
getWorld(worldId: WorldId): Promise<World>;

/** Get all heads across branches */
getHeads(): Promise<readonly WorldHead[]>;

/** Get latest head */
getLatestHead(): Promise<WorldHead | null>;

/** Get migration links (schema migrations) */
getMigrationLinks(): readonly MigrationLink[];
```

### 15.2 World Query Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-WORLD-1 | MUST | `getCurrentHead()` MUST return current branch's head WorldId |
| SDK-WORLD-2 | MUST | `getSnapshot()` MUST return complete Snapshot for given WorldId |
| SDK-WORLD-3 | MUST | World Query APIs before `ready()` MUST throw `AppNotReadyError` |

---

## 16. Hook System

### 16.1 Hook Categories

| Category | Hooks | Description |
|----------|-------|-------------|
| Lifecycle | `app:created`, `app:ready:before`, `app:ready`, `app:dispose:before`, `app:dispose` | App state transitions |
| Domain | `domain:resolved`, `domain:schema:added`, `runtime:created` | Schema resolution |
| Branch | `branch:created`, `branch:switched` | Branch operations |
| Action | `action:preparing`, `action:submitted`, `action:phase`, `action:completed` | Action lifecycle |
| State | `state:publish` | State publication (once per Proposal Tick) |
| World | `world:created` | World creation |
| System | `system:world` | System action World creation |
| Memory | `memory:ingested`, `memory:recalled` | Memory operations |
| Audit | `audit:rejected`, `audit:failed` | Rejection/failure tracking |

### 16.2 AppHooks Interface

```typescript
interface AppHooks {
  // Lifecycle
  'app:created': (ctx: HookContext) => HookResult;
  'app:ready:before': (ctx: HookContext) => HookResult;
  'app:ready': (ctx: HookContext) => HookResult;
  'app:dispose:before': (ctx: HookContext) => HookResult;
  'app:dispose': (ctx: HookContext) => HookResult;

  // Domain/Schema
  'domain:resolved': (
    payload: { schemaHash: SchemaHash; schema: DomainSchema },
    ctx: HookContext
  ) => HookResult;
  'domain:schema:added': (
    payload: { schemaHash: SchemaHash; schema: DomainSchema },
    ctx: HookContext
  ) => HookResult;
  'runtime:created': (
    payload: { schemaHash: SchemaHash; kind: 'domain' | 'system' },
    ctx: HookContext
  ) => HookResult;

  // Branch
  'branch:created': (
    payload: { branchId: BranchId; schemaHash: SchemaHash; head: WorldId },
    ctx: HookContext
  ) => HookResult;
  'branch:switched': (
    payload: { from: BranchId; to: BranchId },
    ctx: HookContext
  ) => HookResult;

  // Action Lifecycle
  'action:preparing': (
    payload: { proposalId: ProposalId; actorId: ActorId; type: string; runtime: 'domain' | 'system' },
    ctx: HookContext
  ) => HookResult;
  'action:submitted': (
    payload: { proposalId: ProposalId; actorId: ActorId; type: string; input: unknown; runtime: 'domain' | 'system' },
    ctx: HookContext
  ) => HookResult;
  'action:phase': (
    payload: { proposalId: ProposalId; phase: ActionPhase; detail?: ActionUpdateDetail },
    ctx: HookContext
  ) => HookResult;
  'action:completed': (
    payload: { proposalId: ProposalId; result: ActionResult },
    ctx: HookContext
  ) => HookResult;

  // State
  'state:publish': (
    payload: { snapshot: Snapshot; worldId: WorldId },
    ctx: HookContext
  ) => HookResult;

  // World
  'world:created': (
    payload: { world: World; parent: WorldId },
    ctx: HookContext
  ) => HookResult;

  // System
  'system:world': (
    payload: { type: string; proposalId: ProposalId; systemWorldId: WorldId; status: WorldOutcome },
    ctx: HookContext
  ) => HookResult;

  // Memory
  'memory:ingested': (
    payload: { provider: string; worldId: WorldId },
    ctx: HookContext
  ) => HookResult;
  'memory:recalled': (
    payload: { provider: string; query: string; atWorldId: WorldId; trace: MemoryTrace },
    ctx: HookContext
  ) => HookResult;

  // Audit
  'audit:rejected': (
    payload: { operation: string; reason?: string; proposalId: ProposalId },
    ctx: HookContext
  ) => HookResult;
  'audit:failed': (
    payload: { operation: string; error: ErrorValue; proposalId: ProposalId },
    ctx: HookContext
  ) => HookResult;
}

type HookResult = void | Promise<void>;
```

### 16.3 HookContext & AppRef

```typescript
/**
 * AppRef: Read-only facade for hooks.
 * Prevents re-entrant mutations and infinite trigger loops.
 */
interface AppRef {
  readonly status: AppStatus;
  getState<T = unknown>(): AppState<T>;
  getDomainSchema(): DomainSchema;
  getCurrentHead(): WorldId;
  currentBranch(): Branch;

  /**
   * Enqueue an action for execution after current hook completes.
   * NOT synchronous execution — prevents re-entrancy.
   */
  enqueueAction(type: string, input?: unknown, opts?: ActOptions): ProposalId;
}

type HookContext = {
  readonly app: AppRef;
  readonly timestamp: number;
};
```

### 16.4 Hook Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-HOOK-1 | MUST | Hooks MUST NOT modify Snapshot or World |
| SDK-HOOK-2 | MUST | Hooks MUST be observation only |
| SDK-HOOK-3 | MUST NOT | Hook errors MUST NOT fail execution |
| SDK-HOOK-4 | MUST | `state:publish` MUST fire at most once per Proposal Tick |
| SDK-HOOK-5 | SHOULD | Hooks SHOULD be async-safe |
| SDK-HOOK-6 | MUST | Hooks receive `AppRef` (not full `App`) to prevent direct mutation |
| SDK-HOOK-7 | MUST | `AppRef.enqueueAction()` MUST defer execution until after current hook completes |
| SDK-HOOK-GUARD-1 | MUST | Hook mutation guard MUST use enqueue pattern (no synchronous `act()` calls) |

---

## 17. Plugin System

### 17.1 Plugin Interface

```typescript
type AppPlugin = (app: App) => void | Promise<void>;
```

### 17.2 Plugin Initialization

Plugins execute during `ready()`, **after** schema resolution but **before** `app:ready` hook.

```typescript
// Plugin example
const myPlugin: AppPlugin = async (app) => {
  // Schema is available (SDK-READY-6)
  const schema = app.getDomainSchema();

  // Register hooks
  app.hooks.on('action:completed', (payload, ctx) => {
    // Plugin logic
  });
};
```

### 17.3 Plugin Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-PLUGIN-1 | MUST | Plugins execute during `ready()`, after schema resolution |
| SDK-PLUGIN-2 | MAY | Plugins MAY call `getDomainSchema()` during initialization |
| SDK-PLUGIN-3 | SHOULD | Plugin errors SHOULD be catchable |
| SDK-PLUGIN-4 | MUST NOT | Plugin errors MUST NOT corrupt App state |
| SDK-PLUGIN-5 | MUST NOT | Plugins MUST NOT modify Core/Host/World behavior |

---

## 18. Error Types

### 18.1 Error Hierarchy

```typescript
/** Base class for all App errors */
class ManifestoAppError extends Error {
  readonly code: string;
}

/** Lifecycle errors */
class AppNotReadyError extends ManifestoAppError {}
class AppDisposedError extends ManifestoAppError {}
class ReservedNamespaceError extends ManifestoAppError {}

/** Action errors */
class ActionRejectedError extends ManifestoAppError {}
class ActionFailedError extends ManifestoAppError {}
class ActionTimeoutError extends ManifestoAppError {}
class ActionNotFoundError extends ManifestoAppError {}

/** Memory errors */
class MemoryDisabledError extends ManifestoAppError {}

/** Branch errors */
class BranchNotFoundError extends ManifestoAppError {}
class SchemaIncompatibleError extends ManifestoAppError {}

/** Session errors */
class SessionContextOverrideError extends ManifestoAppError {}
class SystemActionViaSessionError extends ManifestoAppError {}
```

### 18.2 Error Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ERR-1 | MUST | All SDK errors MUST extend `ManifestoAppError` |
| SDK-ERR-2 | MUST | All errors MUST have a stable `code` property |
| SDK-ERR-3 | MUST | `done()` on rejected/failed action MUST throw appropriate error subclass |
| SDK-ERR-4 | MUST NOT | `result()` MUST NOT throw (returns ActionResult instead) |

---

## 19. Invariants

### 19.1 Public API Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| SDK-INV-1 | `act()` returns synchronously | SDK contract |
| SDK-INV-2 | `proposalId` is pre-allocated in `preparing` phase | Pipeline contract |
| SDK-INV-3 | Session cannot invoke `system.*` actions | Session validation |
| SDK-INV-4 | Session actorId cannot be overridden | Session immutability |
| SDK-INV-5 | Hooks receive AppRef, not full App | Re-entrancy prevention |
| SDK-INV-6 | `state:publish` fires at most once per Proposal Tick | Publish boundary |
| SDK-INV-7 | Plugins execute after schema, before `app:ready` | Initialization order |
| SDK-INV-8 | `result()` never throws | ActionHandle contract |
| SDK-INV-9 | `done()` throws on non-completed results | ActionHandle contract |

### 19.2 Namespace Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| SDK-INV-10 | `system.*` reserved for System Runtime | `ready()` validation |
| SDK-INV-11 | Domain schema MUST NOT contain `system.*` actions | `ready()` validation |

---

## 20. Compliance

### 20.1 Compliance Levels

| Level | Description |
|-------|-------------|
| **Minimal** | createApp, App interface, Lifecycle, act(), ActionHandle, getState() |
| **Standard** | Minimal + Session, Branch, Hooks, subscribe(), World Query |
| **Full** | Standard + Plugins, MemoryFacade, SystemFacade, Fork |

### 20.2 Compliance Checklist

#### Minimal Compliance

- [ ] Implements `createApp()` factory (§6)
- [ ] Implements `App` interface core methods (§7)
- [ ] Implements lifecycle state machine (§8)
- [ ] Implements `ActionHandle` with `done()` and `result()` (§9)
- [ ] Implements `getState()` and `subscribe()` (§11)
- [ ] All errors extend `ManifestoAppError` (§18)
- [ ] Respects layer boundaries (§4)

#### Standard Compliance

- [ ] Minimal compliance
- [ ] Implements `Session` with immutable binding (§10)
- [ ] Implements Branch API (§12)
- [ ] Implements Hook system (§16)
- [ ] Implements World Query API (§15)
- [ ] `getDomainSchema()` works after schema resolution (§7)

#### Full Compliance

- [ ] Standard compliance
- [ ] Implements Plugin system (§17)
- [ ] Implements `MemoryFacade` (§14)
- [ ] Implements `SystemFacade` (§13)
- [ ] Implements `fork({ domain })` with schema compatibility (§12)
- [ ] Implements `createTestApp()` helper

---

## 21. References

### 21.1 Specifications

| Document | Version | Relevance |
|----------|---------|-----------|
| APP-SPEC | v2.3.0 | Parent specification (decomposed into SDK + Runtime) |
| Runtime SPEC | v0.1.0 | Internal orchestration (companion spec) |
| Core SPEC | v2.0.0 | Snapshot, DomainSchema, Patch types |
| Host Contract | v2.0.2 | EffectHandler signature (adapted by Runtime) |
| World Protocol | v2.0.3 | World, WorldId, governance |

### 21.2 Architecture Decision Records

| ADR | Scope |
|-----|-------|
| ADR-001 | Layer separation |
| ADR-APP-002 | createApp API simplification (effects-first) |
| ADR-003 | World owns persistence |

### 21.3 Foundational Design Rationales

| FDR | Scope |
|-----|-------|
| FDR-APP-RUNTIME-001 | Lifecycle, hooks, plugins |
| FDR-APP-PUB-001 | Tick definition, publish boundary |
| FDR-APP-POLICY-001 | ExecutionKey, authority, scope |
| FDR-APP-EXT-001 | MemoryStore, context freezing |

---

*End of Manifesto SDK Specification v0.1.0*
