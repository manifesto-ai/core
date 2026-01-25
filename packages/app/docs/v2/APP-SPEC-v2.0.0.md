# Manifesto App Specification v2.0.0

> **Status:** Ratified  
> **Scope:** Manifesto App Layer Implementations  
> **Compatible with:** Core SPEC v2.0.0, Host Contract v2.0.2, World Protocol v2.0.2, ARCHITECTURE v2.0  
> **Implements:** ADR-001 (Layer Separation)  
> **Authors:** Manifesto Team  
> **License:** MIT  
> **Changelog:**
> - **v2.0.0 (2025-01-20):** Final polish — HookContext→AppRef (re-entrancy prevention), Tick terminology clarified (Proposal vs Mailbox), proposalId pre-allocation rule (HANDLE-9/10)
> - **v2.0.0 (2025-01-20):** Added `preparation_failed` to ActionResult (phase↔result type alignment), HANDLE-7/8 rules
> - **v2.0.0 (2025-01-20):** Added `$app` namespace for App-owned input fields (MEM-7/8), `$host` exclusion rules (STORE-7/8), BRANCH-7 failed World handling
> - **v2.0.0 (2025-01-20):** Fixed ArtifactRef type to `{uri, hash}` (World SPEC alignment), Fixed opts optionality in HostExecutor.execute
> - **v2.0.0 (2025-01-20):** Added §12.4 Schema Compatibility Check — configuration errors fail fast without World creation
> - **v2.0.0 (2025-01-20):** GO — Host↔World boundary sealed (ArtifactRef), Tick/Publish aligned with PUB-001/POLICY-001
> - **v2.0.0:** Complete rewrite — v2 architecture with v0.4.x API compatibility

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Layering Model & Boundary](#4-layering-model--boundary)
5. [Core Types](#5-core-types)
6. [App Interface](#6-app-interface)
7. [Lifecycle](#7-lifecycle)
8. [Host Integration](#8-host-integration)
9. [World Integration](#9-world-integration)
10. [Policy System](#10-policy-system)
11. [External Memory](#11-external-memory)
12. [Branch Management](#12-branch-management)
13. [Schema Registry](#13-schema-registry)
14. [Session](#14-session)
15. [System Runtime](#15-system-runtime)
16. [Action Handle](#16-action-handle)
17. [Hook System](#17-hook-system)
18. [Plugin System](#18-plugin-system)
19. [Invariants](#19-invariants)
20. [Compliance](#20-compliance)
21. [References](#21-references)

---

## 1. Purpose

This document defines the **Manifesto App Specification v2.0.0**.

The App layer is the **Composition Root** that:

- Assembles Core, Host, and World into a working system
- Owns the execution process (while World owns results)
- Implements policy decisions (ExecutionKey, Authority routing, Scope enforcement)
- Provides extensibility (Hooks, Plugins)
- Manages persistence (WorldStore) and external memory (MemoryStore)
- Provides high-level APIs for developer ergonomics (Branch, Session, ActionHandle)

This specification defines:

- The App's public interface and lifecycle
- Host↔World integration contract (HostExecutor, WorldStore)
- Policy system (ExecutionKey derivation, Authority routing, ApprovedScope)
- External Memory with Context Freezing for determinism
- Branch management with named pointers over World lineage
- Schema registry with MEL compilation support
- Session for actor-scoped operations
- System Runtime for meta-operations
- ActionHandle for observable action execution
- Hook and Plugin systems for extensibility

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Host↔World Integration | HostExecutor adapter, WorldStore, Trace mapping |
| Policy System | ExecutionKey derivation, Authority routing, Scope enforcement |
| Lifecycle Management | App states, initialization, disposal |
| Extensibility | Hook registry, Plugin system |
| External Memory | MemoryStore interface, Context Freezing |
| Branch Management | Named pointers over World DAG |
| Schema Registry | DomainSchema storage, MEL compilation |
| Session | Actor-scoped operation context |
| System Runtime | Meta-operations (`system.*` namespace) |
| Action Handle | Observable action execution |
| Publish Boundary | Tick definition, state:publish timing |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Core computation internals | Core SPEC responsibility |
| Host execution internals | Host Contract responsibility |
| World governance rules | World Protocol responsibility |
| MEL grammar/semantics | MEL SPEC responsibility |
| Specific storage backends | Interface only; implementation is user's choice |

---

## 4. Layering Model & Boundary

### 4.1 Constitutional Boundary

Per **ADR-001** and **ARCHITECTURE v2.0**:

```
Core computes meaning.     (pure, deterministic)
Host executes reality.     (IO, effects, mailbox)
World governs legitimacy.  (governance, lineage, audit)
App assembles and absorbs. (integration, policy, extensibility)
```

### 4.2 Results vs Process

| Aspect | Owner | Description |
|--------|-------|-------------|
| **Results** | World | What becomes history (World, Snapshot, Lineage) |
| **Process** | App | How execution happens (telemetry, scheduling, hooks) |

### 4.3 App's "Does NOT Know" Boundary

**Explicit ignorance is constitutional.** App does NOT know:

| App Does NOT Know | Reason | Rule ID |
|-------------------|--------|---------|
| Core computation internals | Layer separation | APP-BOUNDARY-1 |
| World constitution changes | Governance is World's | APP-BOUNDARY-2 |
| How effects are executed | Host's responsibility | APP-BOUNDARY-3 |

### 4.4 Boundary Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-BOUNDARY-1 | MUST NOT | App MUST NOT depend on Core internal implementation |
| APP-BOUNDARY-2 | MUST NOT | App MUST NOT modify World governance rules |
| APP-BOUNDARY-3 | MUST NOT | App MUST NOT bypass HostExecutor interface |
| APP-BOUNDARY-4 | MUST | App MUST receive Host and WorldStore via injection |

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

/**
 * Opaque reference to Host-owned artifact.
 * World/App MAY store this reference but MUST NOT interpret its contents.
 * Only Host knows how to resolve ArtifactRef → actual data.
 *
 * Structure follows World SPEC v2.0.2 for cross-boundary compatibility.
 */
type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};
```

### 5.2 App Status

```typescript
type AppStatus = 'created' | 'ready' | 'disposing' | 'disposed';
```

### 5.3 Proposal Status

```typescript
type ProposalStatus =
  | 'submitted'
  | 'evaluating'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';
```

### 5.4 Action Phase

```typescript
type ActionPhase =
  | 'preparing'
  | 'submitted'
  | 'evaluating'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'preparation_failed';
```

### 5.5 World Outcome

```typescript
type WorldOutcome = 'completed' | 'failed';
```

### 5.6 Authority Types

```typescript
type AuthorityKind = 'auto' | 'human' | 'policy' | 'consensus';

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

### 5.7 ApprovedScope

```typescript
type ApprovedScope = {
  readonly allowedPaths: readonly string[];
  readonly maxPatchCount?: number;
  readonly constraints?: Record<string, unknown>;
};
```

### 5.8 Execution Policy Config

```typescript
type ExecutionKeyPolicy = (proposal: Proposal) => ExecutionKey;

type ExecutionPolicyConfig = {
  readonly executionKeyPolicy: ExecutionKeyPolicy;
  readonly intentTypeOverrides?: Record<string, ExecutionKeyPolicy>;
  readonly actorKindOverrides?: Record<string, ExecutionKeyPolicy>;
};
```

### 5.9 Branch

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

### 5.10 Action Result

```typescript
type ActionResult =
  | { readonly status: 'completed'; readonly world: World; readonly snapshot: Snapshot }
  | { readonly status: 'failed'; readonly world: World; readonly error: ErrorValue }
  | { readonly status: 'rejected'; readonly reason: string; readonly decision: AuthorityDecision }
  | { readonly status: 'preparation_failed'; readonly reason: string; readonly error?: ErrorValue };
```

**Result semantics:**

| Status | World Created | Description |
|--------|---------------|-------------|
| `completed` | Yes | Execution succeeded, World contains terminal snapshot |
| `failed` | Yes | Execution failed, World contains failure state |
| `rejected` | No | Authority denied approval |
| `preparation_failed` | No | Preparation failed before proposal submission (e.g., schema validation, effect handler mismatch) |

---

## 6. App Interface

### 6.1 AppConfig

```typescript
type AppConfig = {
  // ─────────────────────────────────────────
  // Required
  // ─────────────────────────────────────────

  /** Domain schema or MEL source text */
  readonly schema: DomainSchema | string;

  /** Host instance */
  readonly host: Host;

  /** World storage backend */
  readonly worldStore: WorldStore;

  // ─────────────────────────────────────────
  // Optional: Policy
  // ─────────────────────────────────────────

  /** Policy service (default: auto-approve, unique key) */
  readonly policyService?: PolicyService;

  /** Execution key policy shorthand */
  readonly executionKeyPolicy?: ExecutionKeyPolicy;

  // ─────────────────────────────────────────
  // Optional: Memory
  // ─────────────────────────────────────────

  /** External memory store */
  readonly memoryStore?: MemoryStore;

  /** Memory provider for execution integration */
  readonly memoryProvider?: MemoryProvider;

  // ─────────────────────────────────────────
  // Optional: Compilation
  // ─────────────────────────────────────────

  /** Compiler for MEL text (required if schema is string) */
  readonly compiler?: Compiler;

  // ─────────────────────────────────────────
  // Optional: Services
  // ─────────────────────────────────────────

  /** Effect handlers */
  readonly services?: ServiceMap;

  // ─────────────────────────────────────────
  // Optional: Extensibility
  // ─────────────────────────────────────────

  /** Plugins to install */
  readonly plugins?: readonly AppPlugin[];

  /** Pre-configured hooks */
  readonly hooks?: Partial<AppHooks>;

  // ─────────────────────────────────────────
  // Optional: Validation
  // ─────────────────────────────────────────

  readonly validation?: {
    /** Validate services match schema effects */
    readonly services?: 'strict' | 'warn' | 'off';
  };
};
```

### 6.2 App Public API

```typescript
interface App {
  // ═══════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════

  /** Current app status */
  readonly status: AppStatus;

  /** Hook registry */
  readonly hooks: Hookable<AppHooks>;

  /**
   * Initialize the App.
   *
   * MUST be called before any mutation/read APIs.
   * Compiles MEL if schema is string, initializes plugins.
   */
  ready(): Promise<void>;

  /**
   * Dispose the App.
   *
   * Drains executing actions, cleans up resources.
   */
  dispose(opts?: DisposeOptions): Promise<void>;

  // ═══════════════════════════════════════════════════════════════
  // Schema Access
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the DomainSchema for the current branch.
   *
   * @throws AppNotReadyError if schema not yet resolved
   */
  getDomainSchema(): DomainSchema;

  // ═══════════════════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current state.
   */
  getState<T = unknown>(): AppState<T>;

  /**
   * Subscribe to state changes.
   */
  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;

  // ═══════════════════════════════════════════════════════════════
  // Action Execution (High-Level API)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Execute an action.
   *
   * This is the primary API for action execution.
   * Returns an ActionHandle for tracking.
   *
   * @param type - Action type (e.g., 'todo:add')
   * @param input - Action input payload
   * @param opts - Execution options
   */
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;

  /**
   * Get an existing ActionHandle by proposalId.
   *
   * @throws ActionNotFoundError if proposalId is unknown
   */
  getActionHandle(proposalId: ProposalId): ActionHandle;

  // ═══════════════════════════════════════════════════════════════
  // Proposal Execution (Low-Level API)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Submit a proposal for execution.
   *
   * Low-level API. Prefer act() for most use cases.
   */
  submitProposal(proposal: Proposal): Promise<ProposalResult>;

  // ═══════════════════════════════════════════════════════════════
  // Session
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a session for an actor.
   *
   * Session provides actor-scoped action execution.
   */
  session(actorId: ActorId, opts?: SessionOptions): Session;

  // ═══════════════════════════════════════════════════════════════
  // Branch Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current branch.
   */
  currentBranch(): Branch;

  /**
   * List all branches.
   */
  listBranches(): readonly Branch[];

  /**
   * Switch to a different branch.
   */
  switchBranch(branchId: BranchId): Promise<Branch>;

  /**
   * Create a new branch (fork).
   */
  fork(opts?: ForkOptions): Promise<Branch>;

  // ═══════════════════════════════════════════════════════════════
  // System Runtime
  // ═══════════════════════════════════════════════════════════════

  /** System operations facade */
  readonly system: SystemFacade;

  // ═══════════════════════════════════════════════════════════════
  // Memory
  // ═══════════════════════════════════════════════════════════════

  /** Memory operations facade */
  readonly memory: MemoryFacade;

  // ═══════════════════════════════════════════════════════════════
  // World Query
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current head WorldId.
   */
  getCurrentHead(): WorldId;

  /**
   * Get snapshot for a World.
   */
  getSnapshot(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   */
  getWorld(worldId: WorldId): Promise<World>;

  // ═══════════════════════════════════════════════════════════════
  // Audit
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get migration links (schema migrations).
   */
  getMigrationLinks(): readonly MigrationLink[];
}
```

### 6.3 ActOptions

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

### 6.4 ForkOptions

```typescript
type ForkOptions = {
  /** Fork point (default: current head) */
  readonly from?: WorldId;

  /** Branch name */
  readonly name?: string;

  /** New domain for schema-changing fork */
  readonly domain?: DomainSchema | string;

  /** Switch to new branch after creation */
  readonly switchTo?: boolean;
};
```

### 6.5 ProposalResult

```typescript
type ProposalResult =
  | { readonly status: 'completed'; readonly world: World }
  | { readonly status: 'failed'; readonly world: World; readonly error?: ErrorValue }
  | { readonly status: 'rejected'; readonly reason: string };
```

### 6.6 App Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-API-1 | MUST | App MUST implement all required interface methods |
| APP-API-2 | MUST | Mutation/read APIs before `ready()` MUST throw `AppNotReadyError` |
| APP-API-3 | MUST | `act()` MUST return ActionHandle synchronously |
| APP-API-4 | MUST | `submitProposal()` MUST return ProposalResult |
| APP-API-5 | MUST NOT | App MUST NOT expose internal Host or World instances |
| APP-API-6 | MUST | `getDomainSchema()` MUST return current branch's schema |

---

## 7. Lifecycle

### 7.1 State Transitions

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

### 7.2 Ready Sequence

The `ready()` method MUST:

1. Compile domain if provided as MEL text
2. Validate that DomainSchema contains no `system.*` action types
3. Cache the resolved DomainSchema
4. Emit `domain:resolved` hook
5. Initialize Domain Runtime with user schema
6. Initialize System Runtime with fixed system schema
7. Validate services if `validation.services='strict'`
8. Initialize plugins in order
9. Emit `app:ready` hook

### 7.3 Lifecycle Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-LC-1 | MUST | App MUST start in 'created' status |
| APP-LC-2 | MUST | `ready()` MUST be called before mutation/read APIs |
| APP-LC-3 | MUST | `dispose()` MUST drain executing actions before cleanup |
| APP-LC-4 | MUST NOT | Disposed App MUST NOT accept new actions |
| APP-LC-5 | SHOULD | Plugin errors during initialization SHOULD be catchable |
| READY-1 | MUST | APIs before `ready()` resolves MUST throw `AppNotReadyError` |
| READY-1a | EXCEPTION | `getDomainSchema()` is callable after schema resolved (before `ready()` resolves) |
| READY-4 | MUST | If DomainSchema contains `system.*` action types, `ready()` MUST throw `ReservedNamespaceError` |
| READY-6 | MUST | DomainSchema MUST be resolved and cached BEFORE plugins execute |

---

## 8. Host Integration

### 8.1 HostExecutor Interface

```typescript
/**
 * HostExecutor: App's adapter for Host execution.
 *
 * World interacts with execution ONLY through this interface.
 * App implements this, wrapping the actual Host.
 */
interface HostExecutor {
  /**
   * Execute an intent against a snapshot.
   *
   * @param key - ExecutionKey for mailbox routing
   * @param baseSnapshot - Starting snapshot
   * @param intent - Intent to execute
   * @param opts - Execution options (World SPEC defined, optional)
   * @returns Terminal snapshot and outcome
   */
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;

  /**
   * Abort execution for a key (best-effort).
   */
  abort?(key: ExecutionKey): void;
}
```

### 8.2 HostExecutionOptions

```typescript
/**
 * HostExecutionOptions: Defined by World SPEC.
 * App MUST NOT extend this type.
 *
 * Note: approvedScope is `unknown` at World boundary.
 * App/Policy layer interprets and validates the actual ApprovedScope structure.
 */
type HostExecutionOptions = {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};
```

### 8.3 HostExecutionResult

```typescript
/**
 * HostExecutionResult: Returned from HostExecutor.execute().
 *
 * Note: Trace data is referenced via opaque ArtifactRef, not embedded.
 * This preserves World's ignorance of Host internal types (TraceEvent).
 * App MAY resolve traceRef through Host's artifact resolution API
 * for telemetry purposes, but this is outside World's concern.
 */
type HostExecutionResult = {
  readonly outcome: 'completed' | 'failed';
  readonly terminalSnapshot: Snapshot;
  readonly error?: ErrorValue;
  readonly traceRef?: ArtifactRef;
};
```

### 8.4 HostExecutor Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| HEXEC-1 | MUST | App MUST implement HostExecutor interface |
| HEXEC-2 | MUST NOT | HostExecutor MUST NOT leak Host internals |
| HEXEC-3 | MUST | `execute()` MUST return HostExecutionResult |
| HEXEC-4 | MUST | `execute()` MUST route to correct ExecutionKey mailbox |
| HEXEC-5 | SHOULD | `abort()` SHOULD be implemented for cancellation support |
| HEXEC-6 | MUST NOT | HostExecutionResult MUST NOT contain Host internal types (e.g., TraceEvent); use opaque ArtifactRef instead |

---

## 9. World Integration

### 9.1 WorldStore Interface

```typescript
/**
 * WorldStore: Persistence abstraction for Worlds.
 */
interface WorldStore {
  // ─────────────────────────────────────────
  // Core Operations
  // ─────────────────────────────────────────

  /**
   * Store a World and its delta.
   */
  store(world: World, delta: WorldDelta): Promise<void>;

  /**
   * Restore a Snapshot for a World.
   * MAY involve delta reconstruction.
   */
  restore(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   */
  getWorld(worldId: WorldId): Promise<World | null>;

  /**
   * Check if World exists.
   */
  has(worldId: WorldId): Promise<boolean>;

  // ─────────────────────────────────────────
  // Query
  // ─────────────────────────────────────────

  /**
   * Get children of a World.
   */
  getChildren(worldId: WorldId): Promise<readonly WorldId[]>;

  /**
   * Get lineage path to Genesis.
   */
  getLineage(worldId: WorldId): Promise<readonly WorldId[]>;

  // ─────────────────────────────────────────
  // Maintenance (Optional)
  // ─────────────────────────────────────────

  /**
   * Compact old Worlds (delta-only storage).
   */
  compact?(options: CompactOptions): Promise<CompactResult>;

  /**
   * Archive cold Worlds.
   */
  archive?(worldIds: readonly WorldId[]): Promise<void>;
}
```

### 9.2 WorldDelta

```typescript
type WorldDelta = {
  readonly fromWorld: WorldId;
  readonly toWorld: WorldId;
  readonly patches: readonly Patch[];
  readonly createdAt: number;
};
```

### 9.3 WorldStore Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| STORE-1 | MUST | WorldStore MUST implement `store()`, `restore()`, `getWorld()`, `has()` |
| STORE-2 | MUST | `restore()` MUST return complete Snapshot |
| STORE-3 | MUST | `restore()` MUST reconstruct from deltas if necessary |
| STORE-4 | SHOULD | Active Horizon Worlds SHOULD have full Snapshots |
| STORE-5 | MAY | `compact()` and `archive()` are optional |
| STORE-6 | MUST NOT | `store()` MUST NOT modify World or Delta |
| STORE-7 | MUST | `store()` MUST exclude `data.$host` from canonical hash computation |
| STORE-8 | MUST | `restore()` MUST return Snapshot without `data.$host` (Host re-seeds on execution) |

---

## 10. Policy System

### 10.1 PolicyService Interface

```typescript
interface PolicyService {
  /**
   * Derive ExecutionKey for a Proposal.
   */
  deriveExecutionKey(proposal: Proposal): ExecutionKey;

  /**
   * Route Proposal to Authority and get decision.
   *
   * Note: AuthorityDecision.scope is typed as ApprovedScope within Policy layer,
   * but becomes `unknown` when crossing to World boundary via HostExecutionOptions.
   */
  requestApproval(proposal: Proposal): Promise<AuthorityDecision>;

  /**
   * Validate Proposal against ApprovedScope (pre-execution).
   */
  validateScope(proposal: Proposal, scope: ApprovedScope): ValidationResult;

  /**
   * Validate execution result against ApprovedScope (post-execution).
   */
  validateResultScope?(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ValidationResult;
}
```

### 10.2 Built-in ExecutionKey Policies

```typescript
/** Default: Unique key per proposal (maximum parallelism) */
const defaultPolicy: ExecutionKeyPolicy =
    (p) => `proposal:${p.proposalId}`;

/** Actor-serial: One key per actor (serialize per actor) */
const actorSerialPolicy: ExecutionKeyPolicy =
  (p) => `actor:${p.actorId}`;

/** Base-serial: One key per base world (serialize per branch) */
const baseSerialPolicy: ExecutionKeyPolicy =
  (p) => `base:${p.baseWorld}`;

/** Global-serial: Single key (full serialization) */
const globalSerialPolicy: ExecutionKeyPolicy =
  () => 'global';
```

### 10.3 Tick Definition

This specification uses **Proposal Tick** as the authoritative tick boundary:

```
Proposal Tick = startExecution(proposal) → ... → terminalSnapshot reached
```

**Terminology clarification:**

| Term | Scope | Description |
|------|-------|-------------|
| **Proposal Tick** | App/World | One proposal execution cycle; publish boundary |
| **Mailbox Tick** | Host (internal) | Host's internal scheduling unit; NOT a publish boundary |

When serialization policies map multiple Proposals to the same ExecutionKey:
- Each Proposal still gets its own **Proposal Tick**
- `state:publish` fires per **Proposal Tick**, not per mailbox-idle
- Host may batch multiple Proposal Ticks into one Mailbox Tick internally (implementation detail)

**Rule:** App and World specs always mean **Proposal Tick** when saying "tick" without qualifier.

### 10.4 Policy Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| POLICY-1 | MUST | App MUST derive ExecutionKey via PolicyService |
| POLICY-2 | MUST | App MUST request Authority approval before execution |
| POLICY-3 | MUST | App MUST validate Proposal against scope before execution |
| POLICY-4 | SHOULD | App SHOULD validate result scope after execution |
| POLICY-5 | MUST | Rejected Proposal MUST NOT create World |
| POLICY-6 | MUST | Tick boundary MUST be per-proposal, not per-mailbox |

---

## 11. External Memory

### 11.1 MemoryStore Interface

```typescript
/**
 * MemoryStore: External mutable storage.
 *
 * Separate from World (immutable history).
 */
interface MemoryStore<T = unknown> {
  // ─────────────────────────────────────────
  // CRUD (Required)
  // ─────────────────────────────────────────

  create(record: MemoryRecordInput<T>): Promise<MemoryId>;
  get(id: MemoryId): Promise<StoredMemoryRecord<T> | null>;
  update(id: MemoryId, patch: Partial<T>): Promise<void>;
  delete(id: MemoryId): Promise<void>;
  query(filter: MemoryFilter): Promise<StoredMemoryRecord<T>[]>;

  // ─────────────────────────────────────────
  // Batch (Optional)
  // ─────────────────────────────────────────

  createMany?(records: MemoryRecordInput<T>[]): Promise<MemoryId[]>;
  deleteMany?(ids: MemoryId[]): Promise<void>;

  // ─────────────────────────────────────────
  // Maintenance (Optional)
  // ─────────────────────────────────────────

  consolidate?(): Promise<void>;
  clear?(): Promise<void>;
}
```

### 11.2 Memory Record Types

```typescript
/**
 * MemoryRecordInput: For create operations.
 */
type MemoryRecordInput<T> = {
  readonly id?: MemoryId;
  readonly data: T;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

/**
 * StoredMemoryRecord: Returned from get/query.
 */
type StoredMemoryRecord<T> = {
  readonly id: MemoryId;
  readonly data: T;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};
```

### 11.3 MemoryFacade Interface

```typescript
/**
 * MemoryFacade: High-level memory operations.
 */
interface MemoryFacade {
  /**
   * Recall context at a specific world.
   */
  recall(query: string, opts?: RecallOptions): Promise<MemoryTrace>;

  /**
   * Ingest data into memory.
   */
  ingest(data: unknown, opts?: IngestOptions): Promise<void>;

  /**
   * Check if memory is enabled.
   */
  readonly enabled: boolean;

  /**
   * Direct store access (if enabled).
   */
  readonly store: MemoryStore | undefined;
}

type RecallOptions = {
  readonly worldId?: WorldId;
  readonly limit?: number;
};

type IngestOptions = {
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};
```

### 11.4 Context Freezing

To preserve **determinism** across replays:

```typescript
/**
 * AppExecutionContext: App-internal context.
 * NOT part of World SPEC's HostExecutionOptions.
 */
type AppExecutionContext = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
};

/**
 * Freeze memory context into Snapshot.
 * MUST be value copy, NOT reference.
 *
 * Note: App-owned data uses `$app` namespace to avoid collision
 * with domain input fields.
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

### 11.5 Memory Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-1 | MUST | MemoryStore MUST implement create, get, update, delete, query |
| MEM-2 | MUST | `get()`/`query()` MUST return StoredMemoryRecord with required id |
| MEM-3 | MUST | `get()` MUST return null for non-existent ID |
| MEM-4 | MUST | `update()` MUST throw for non-existent ID |
| MEM-5 | MUST NOT | MemoryStore failure MUST NOT block World execution |
| MEM-6 | SHOULD | recall/remember SHOULD have timeout with graceful degradation |
| MEM-7 | MUST | Recalled context MUST be frozen as value into `input.$app.memoryContext` |
| MEM-8 | MUST | Replay MUST use frozen context from `input.$app`, NOT re-query MemoryStore |
| MEM-9 | MUST NOT | memoryContext MUST NOT be passed via HostExecutionOptions |
| MEM-DIS-1 | MUST | If memory disabled, `memory.recall()` MUST throw `MemoryDisabledError` |
| MEM-DIS-2 | MUST | If memory disabled, `memory.enabled` MUST return false |

---

## 12. Branch Management

### 12.1 Overview

Branches are **named pointers** over the World DAG. Each branch tracks:
- A head WorldId
- A schemaHash (may differ between branches)
- Lineage information

### 12.2 BranchManager (Internal)

```typescript
interface BranchManager {
  /**
   * Get current branch.
   */
  current(): Branch;

  /**
   * List all branches.
   */
  list(): readonly Branch[];

  /**
   * Get branch by ID.
   */
  get(branchId: BranchId): Branch | undefined;

  /**
   * Create a new branch.
   */
  create(opts: CreateBranchOptions): Promise<Branch>;

  /**
   * Switch to a branch.
   */
  switch(branchId: BranchId): Promise<Branch>;

  /**
   * Update branch head.
   */
  updateHead(branchId: BranchId, worldId: WorldId): void;
}

type CreateBranchOptions = {
  readonly name?: string;
  readonly from: WorldId;
  readonly schemaHash: SchemaHash;
  readonly switchTo?: boolean;
};
```

### 12.3 Branch Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| BRANCH-1 | MUST | App MUST have at least one branch ('main' by default) |
| BRANCH-2 | MUST | `currentBranch()` MUST return the active branch |
| BRANCH-3 | MUST | `fork()` MUST create a new branch pointing to specified World |
| BRANCH-4 | MUST | `switchBranch()` MUST update current branch pointer |
| BRANCH-5 | MUST | Branch head MUST be updated to point to new World after **completed** execution |
| BRANCH-6 | SHOULD | `fork({ domain })` SHOULD support schema-changing forks |
| BRANCH-7 | MUST NOT | Branch head MUST NOT advance to Failed World; failed Worlds exist in lineage only |
| FORK-1 | MUST | `fork({ domain })` with new schema MUST create new Runtime |
| FORK-2 | MUST | `fork({ domain })` MUST verify effect handler compatibility before creating branch |
| FORK-3 | MUST | Missing effect handler MUST cause fork to fail without World creation |

### 12.4 Schema Compatibility Check (Normative)

When `fork({ domain })` is invoked with a new DomainSchema:

1. The App **MUST** statically extract all effect types declared by the schema's actions.
2. The App **MUST** verify that every required effect type is provided by the Host's registered effect handlers (including system-reserved handlers).
3. If any required effect type is missing, the fork operation **MUST** fail.
4. This failure **MUST** occur before any Proposal is created and **MUST NOT** produce any World or lineage changes.

```typescript
/**
 * Schema compatibility validation result.
 */
type SchemaCompatibilityResult =
  | { readonly compatible: true }
  | { readonly compatible: false; readonly missingEffects: readonly string[] };

/**
 * Validate schema against Host's effect handlers.
 * Called during fork({ domain }) before any World mutation.
 */
function validateSchemaCompatibility(
  schema: DomainSchema,
  host: Host
): SchemaCompatibilityResult;
```

**Rationale**: Effect handler mismatch is a **configuration error**, not an execution failure. Configuration errors must fail fast at fork-time rather than creating Failed Worlds that pollute lineage.

---

## 13. Schema Registry

### 13.1 Overview

The Schema Registry manages DomainSchema instances, supporting:
- MEL compilation
- Multiple schemas (schema-changing forks)
- Referential identity per schemaHash

### 13.2 SchemaRegistry Interface

```typescript
interface SchemaRegistry {
  /**
   * Register a compiled schema.
   * @returns schemaHash
   */
  register(schema: DomainSchema): SchemaHash;

  /**
   * Get schema by hash.
   */
  get(schemaHash: SchemaHash): DomainSchema | undefined;

  /**
   * Get current branch's schema.
   */
  getCurrent(): DomainSchema;

  /**
   * Compile MEL text and register.
   */
  compile(melText: string): Promise<DomainSchema>;
}
```

### 13.3 Schema Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SCHEMA-1 | MUST | `getDomainSchema()` MUST return current branch's schema |
| SCHEMA-2 | MUST | `getDomainSchema()` MUST throw `AppNotReadyError` if schema not yet resolved |
| SCHEMA-3 | MUST NOT | `getDomainSchema()` MUST NOT return undefined once resolved |
| SCHEMA-4 | MUST | Repeated calls MUST return same cached instance per schemaHash |
| SCHEMA-5 | MUST | If domain is MEL text, `getDomainSchema()` returns compiled result |
| SCHEMA-6 | MUST | After `switchBranch()` with different schemaHash, return new schema |

---

## 14. Session

### 14.1 Overview

Session provides an **actor-scoped context** for action execution, reducing boilerplate for repeated operations by the same actor.

### 14.2 Session Interface

```typescript
interface Session {
  /** Actor ID for this session */
  readonly actorId: ActorId;

  /** Optional branch binding */
  readonly branchId?: BranchId;

  /**
   * Execute an action in this session's context.
   */
  act(type: string, input?: unknown, opts?: SessionActOptions): ActionHandle;

  /**
   * End the session.
   */
  end(): void;
}

type SessionOptions = {
  readonly branchId?: BranchId;
};

type SessionActOptions = Omit<ActOptions, 'actorId' | 'branchId'>;
```

### 14.3 Session Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SESS-1 | MUST | Session MUST bind actorId for all actions |
| SESS-2 | MUST | `session.act()` MUST use session's actorId |
| SESS-3 | MAY | Session MAY bind to a specific branch |
| SESS-ACT-1 | MUST | `opts.actorId` in `session.act()` is FORBIDDEN |
| SESS-ACT-2 | MUST | `opts.branchId` in `session.act()` is FORBIDDEN if session has branchId |
| SESS-ACT-4 | MUST | Session MUST maintain actor binding for entire lifetime |

---

## 15. System Runtime

### 15.1 Overview

System Runtime handles **meta-operations** in the `system.*` namespace. These actions operate on the App itself rather than domain state.

### 15.2 SystemFacade Interface

```typescript
interface SystemFacade {
  /**
   * Execute a system action.
   */
  act(type: `system.${string}`, input?: unknown): ActionHandle;

  /**
   * Memory maintenance operations.
   */
  readonly memory: SystemMemoryFacade;
}

interface SystemMemoryFacade {
  /**
   * Run memory maintenance (forget-only).
   */
  maintain(opts: MemoryMaintenanceOptions): ActionHandle;
}

type MemoryMaintenanceOptions = {
  readonly operations: readonly MemoryMaintenanceOp[];
  readonly actorId?: ActorId;
};
```

### 15.3 Reserved System Actions

| Action Type | Description |
|-------------|-------------|
| `system.memory.maintain` | Memory maintenance (forget operations) |
| `system.get` | System value retrieval (compiler-internal) |

### 15.4 System Runtime Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SYS-1 | MUST | System actions MUST use `system.*` namespace |
| SYS-3 | MUST | Rejected system action MUST NOT create World |
| SYS-4 | MUST | Failed system action MUST create World with `outcome: 'failed'` |
| SYSRT-1 | MUST | System Runtime MUST be separate from Domain Runtime |
| SYSRT-2 | MUST | System actions MUST NOT modify domain state |
| SYSRT-3 | MUST | System Runtime schema is fixed (not user-defined) |

---

## 16. Action Handle

### 16.1 Overview

ActionHandle provides **observable action execution**, allowing callers to track progress and await completion.

### 16.2 ActionHandle Interface

```typescript
interface ActionHandle {
  /** Unique proposal ID */
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
   * Resolves with ActionResult.
   */
  completed(): Promise<ActionResult>;

  /**
   * Subscribe to phase changes.
   */
  onPhase(listener: (phase: ActionPhase, detail?: ActionUpdateDetail) => void): Unsubscribe;

  /**
   * Cancel the action (best-effort).
   * Only effective before execution starts.
   */
  cancel?(): void;
}

type ActionUpdateDetail = {
  readonly error?: ErrorValue;
  readonly worldId?: WorldId;
  readonly decision?: AuthorityDecision;
};
```

### 16.3 ActionHandle Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| HANDLE-1 | MUST | `act()` MUST return ActionHandle synchronously |
| HANDLE-2 | MUST | `completed()` MUST resolve when action reaches terminal state |
| HANDLE-3 | MUST | `phase` MUST reflect current action phase |
| HANDLE-4 | MUST | `onPhase` MUST fire for each phase transition |
| HANDLE-5 | MAY | `cancel()` MAY be called before execution starts |
| HANDLE-6 | MUST | `cancel()` MUST be no-op after execution starts |
| HANDLE-7 | MUST | `preparation_failed` phase MUST resolve `completed()` with `status: 'preparation_failed'` |
| HANDLE-8 | MUST | `preparation_failed` result MUST NOT contain World reference |
| HANDLE-9 | MUST | `proposalId` MUST be pre-allocated in `preparing` phase (before validation) |
| HANDLE-10 | MUST | On `preparation_failed`, ActionHandle MUST complete with the pre-allocated `proposalId` |

---

## 17. Hook System

### 17.1 Hook Categories

| Category | Purpose |
|----------|---------|
| Lifecycle | App state transitions |
| Domain | Schema resolution |
| Branch | Branch operations |
| Action | Action lifecycle |
| System | System action events |
| Memory | Memory operations |
| Audit | Rejection/failure tracking |

### 17.2 AppHooks Interface

```typescript
interface AppHooks {
  // ─────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────
  'app:created': (ctx: HookContext) => HookResult;
  'app:ready:before': (ctx: HookContext) => HookResult;
  'app:ready': (ctx: HookContext) => HookResult;
  'app:dispose:before': (ctx: HookContext) => HookResult;
  'app:dispose': (ctx: HookContext) => HookResult;

  // ─────────────────────────────────────────
  // Domain/Schema
  // ─────────────────────────────────────────
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

  // ─────────────────────────────────────────
  // Branch
  // ─────────────────────────────────────────
  'branch:created': (
    payload: { branchId: BranchId; schemaHash: SchemaHash; head: WorldId },
    ctx: HookContext
  ) => HookResult;
  'branch:switched': (
    payload: { from: BranchId; to: BranchId },
    ctx: HookContext
  ) => HookResult;

  // ─────────────────────────────────────────
  // Action Lifecycle
  // ─────────────────────────────────────────
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

  // ─────────────────────────────────────────
  // State
  // ─────────────────────────────────────────
  'state:publish': (
    payload: { snapshot: Snapshot; worldId: WorldId },
    ctx: HookContext
  ) => HookResult;

  // ─────────────────────────────────────────
  // World
  // ─────────────────────────────────────────
  'world:created': (
    payload: { world: World; parent: WorldId },
    ctx: HookContext
  ) => HookResult;

  // ─────────────────────────────────────────
  // System
  // ─────────────────────────────────────────
  'system:world': (
    payload: { type: string; proposalId: ProposalId; systemWorldId: WorldId; status: WorldOutcome },
    ctx: HookContext
  ) => HookResult;

  // ─────────────────────────────────────────
  // Memory
  // ─────────────────────────────────────────
  'memory:ingested': (
    payload: { provider: string; worldId: WorldId },
    ctx: HookContext
  ) => HookResult;
  'memory:recalled': (
    payload: { provider: string; query: string; atWorldId: WorldId; trace: MemoryTrace },
    ctx: HookContext
  ) => HookResult;

  // ─────────────────────────────────────────
  // Audit
  // ─────────────────────────────────────────
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

### 17.3 Hook Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| HOOK-1 | MUST | Hooks MUST NOT modify Snapshot or World |
| HOOK-2 | MUST | Hooks MUST be observation only |
| HOOK-3 | MUST NOT | Hook errors MUST NOT fail execution |
| HOOK-4 | MUST | `state:publish` MUST fire at most once per tick |
| HOOK-5 | SHOULD | Hooks SHOULD be async-safe |
| HOOK-6 | MUST | Hooks receive `AppRef` (not full `App`) to prevent direct mutation |
| HOOK-7 | MUST | `AppRef.enqueueAction()` MUST defer execution until after current hook completes |
| HOOK-GUARD-1 | MUST | Hook mutation guard MUST use enqueue pattern (no synchronous `act()` calls) |

---

## 18. Plugin System

### 18.1 Plugin Interface

```typescript
type AppPlugin = (app: App) => void | Promise<void>;
```

### 18.2 Plugin Initialization

Plugins are initialized during `ready()`, after schema resolution but before `app:ready` hook.

```typescript
// Plugin example
const myPlugin: AppPlugin = async (app) => {
  // Schema is available (READY-6)
  const schema = app.getDomainSchema();

  // Register hooks
  app.hooks.on('action:completed', (payload, ctx) => {
    // Plugin logic
  });
};
```

### 18.3 Plugin Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLUGIN-1 | MUST | Plugins execute during `ready()`, after schema resolution |
| PLUGIN-2 | MAY | Plugins MAY call `getDomainSchema()` during initialization |
| PLUGIN-3 | MUST NOT | Plugin errors SHOULD be catchable, MUST NOT corrupt App state |
| PLUGIN-4 | MUST | Plugins MUST NOT modify Core/Host/World behavior |

---

## 19. Invariants

### 19.1 Constitutional Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-1 | Same input produces same output (Determinism) | Context Freezing |
| INV-2 | World is immutable once created | WorldStore contract |
| INV-3 | Failed execution creates Failed World | Proposal flow |
| INV-4 | Authority rejection creates no World | Proposal flow |
| INV-5 | External Memory is separate from World history | Architecture |
| INV-6 | Configuration error creates no World | Schema compatibility check |

### 19.2 Execution Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-7 | Run-to-completion for executing proposals | HostExecutor |
| INV-8 | One tick per proposal (even with serialization) | Policy system |
| INV-9 | `state:publish` at most once per tick | Hook system |

### 19.3 Namespace Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-10 | `system.*` reserved for System Runtime | READY-4 validation |
| INV-11 | Domain schema MUST NOT contain `system.*` actions | READY-4 |

---

## 20. Compliance

### 20.1 Compliance Levels

| Level | Description |
|-------|-------------|
| **Minimal** | Core API, Lifecycle, HostExecutor, WorldStore |
| **Standard** | Minimal + Branch, Schema, Session, ActionHandle |
| **Full** | Standard + System Runtime, Memory, Plugins |

### 20.2 Compliance Checklist

#### Minimal Compliance

- [ ] Implements App interface (§6)
- [ ] Implements lifecycle state machine (§7)
- [ ] Implements HostExecutor (§8)
- [ ] Implements WorldStore core operations (§9)
- [ ] Respects layer boundaries (§4)

#### Standard Compliance

- [ ] Minimal compliance
- [ ] Implements PolicyService (§10)
- [ ] Implements Branch management (§12)
- [ ] Implements Schema registry (§13)
- [ ] Implements Session (§14)
- [ ] Implements ActionHandle (§16)
- [ ] Implements Hook system (§17)

#### Full Compliance

- [ ] Standard compliance
- [ ] Implements External Memory (§11)
- [ ] Implements Context Freezing (§11.4)
- [ ] Implements System Runtime (§15)
- [ ] Implements Plugin system (§18)
- [ ] Implements WorldStore maintenance (§9.1)

---

## 21. References

### 21.1 Specifications

| Document | Version | Relevance |
|----------|---------|-----------|
| ARCHITECTURE | v2.0.0 | Layer model, boundaries |
| ADR-001 | - | Layer separation decision |
| Core SPEC | v2.0.0 | Snapshot, compute, apply |
| Host Contract | v2.0.2 | Execution model, mailbox |
| World Protocol | v2.0.2 | Governance, lineage |
| MEL SPEC | v0.3.3 | Expression language |

### 21.2 Foundational Design Rationales

| FDR | Scope |
|-----|-------|
| FDR-APP-PUB-001 | Tick definition, publish boundary |
| FDR-APP-RUNTIME-001 | Lifecycle, hooks, plugins |
| FDR-APP-INTEGRATION-001 | HostExecutor, WorldStore, maintenance |
| FDR-APP-POLICY-001 | ExecutionKey, authority, scope |
| FDR-APP-EXT-001 | MemoryStore, context freezing |

---

*End of Manifesto App Specification v2.0.0*
