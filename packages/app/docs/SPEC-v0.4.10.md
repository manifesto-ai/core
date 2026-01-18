# Manifesto App Public API Specification

**Version:** 0.4.10  
**Status:** Final  
**Date:** 2026-01-07  
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
- **Domain schema access API** (v0.4.10)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| Single Entry Point | `createApp(domain, opts)` as the sole factory |
| Explicit Initialization | `await app.ready()` MUST be called; no implicit lazy init |
| Observable Execution | ActionHandle for tracking proposal lifecycle |
| Safe Orchestration | Hook mutation guard with enqueue pattern |
| Protocol Compliance | No modification to underlying protocol semantics |
| Deterministic Audit | All operations traceable through worldlines |
| **Plugin Interoperability** | Guaranteed access to domain artifacts (v0.4.10) |

### 1.4 Relationship to Other Specifications

This specification depends on:

- **Core SPEC v2.0.0**: Snapshot, patch, and computed semantics
- **Host SPEC v1.1**: Effect execution model
- **World Protocol SPEC v1.0**: DAG, Proposal, Decision, Authority model
- **Memory SPEC v1.2**: Selection, verification, and trace model
- **Compiler SPEC v0.4**: MEL compilation, DomainSchema, and `system.get` effect

This specification is depended upon by:

- **Mind Protocol Plugin SPEC v0.2.1+**: Requires `getDomainSchema()` API

---

## 2–4. Conformance, Terminology, Architecture

*(Sections 2–4 unchanged from v0.4.9)*

---

## 5. App Creation and Lifecycle

### 5.1–5.5

*(Unchanged from v0.4.9)*

### 5.6 Initialization

```typescript
interface App {
  ready(): Promise<void>;
}
```

The `ready()` method MUST:

1. Complete all asynchronous initialization
2. Compile domain if provided as MEL text
3. **Validate that DomainSchema contains no `system.*` action types** (NS-ACT-2, READY-4)
4. **Cache the resolved DomainSchema** (available via `getDomainSchema()` after this point)
5. **Emit `domain:resolved` hook** (only after validation passes)
6. Initialize Domain Runtime with user schema
7. Initialize System Runtime with fixed system schema
8. Validate services if `validation.services='strict'`
9. **Initialize plugins in order** (plugins may call `getDomainSchema()` per READY-1a)
10. Throw appropriate errors for failures

**Note**: Steps 3-5 order ensures that `domain:resolved` only emits for valid schemas. If READY-4 validation fails, `domain:resolved` does NOT emit.

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| READY-1 | Calling mutation/read APIs before `ready()` MUST throw `AppNotReadyError` |
| READY-1a | **Exception**: `getDomainSchema()` is callable after READY-6 (schema resolved), even before `ready()` resolves. This enables plugin initialization. |
| READY-2 | Affected APIs (non-exhaustive): `getState`, `subscribe`, `act`, `fork`, `switchBranch`, `currentBranch`, `listBranches`, `session`, `getActionHandle`, `getMigrationLinks`, `system.*`, `memory.*`, `branch.*` methods |
| READY-3 | Implicit lazy initialization is FORBIDDEN |
| READY-4 | If DomainSchema contains action types with `system.*` prefix, `ready()` MUST throw `ReservedNamespaceError` |
| READY-5 | If `CreateAppOptions.services` contains `system.get`, `ready()` MUST throw `ReservedEffectTypeError` |
| **READY-6** | **DomainSchema MUST be resolved and cached BEFORE plugins execute** |

**Note on READY-1/1a**: Most APIs require `ready()` to fully resolve before use. However, `getDomainSchema()` is specifically designed for plugin initialization, so it becomes available earlier—after schema resolution (READY-6) but before `ready()` completes.

### 5.7 Disposal

*(Unchanged from v0.4.9)*

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
  
  // Domain Schema Access (NEW in v0.4.10)
  /**
   * Returns the DomainSchema for the current branch's schemaHash.
   * 
   * This provides synchronous pull-based access to the domain schema,
   * enabling plugins and user code to reliably obtain schema without
   * timing dependencies on the 'domain:resolved' hook.
   * 
   * NOTE: In multi-schema scenarios (schema-changing fork), this returns
   * the schema for the CURRENT branch's schemaHash, which may differ from
   * the initial domain's schema.
   * 
   * @throws AppNotReadyError if called before ready() resolves
   * @returns DomainSchema for current branch's schemaHash
   */
  getDomainSchema(): DomainSchema;
  
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

### 6.2 getDomainSchema() Rules (NEW)

**Rules (MUST):**

| Rule ID | Description |
|---------|-------------|
| SCHEMA-1 | `getDomainSchema()` MUST return the `DomainSchema` for the **current branch's schemaHash** |
| SCHEMA-2 | `getDomainSchema()` MUST throw `AppNotReadyError` if the DomainSchema **has not yet been resolved and cached** (see READY-6) |
| SCHEMA-3 | `getDomainSchema()` MUST NOT return `undefined` once schema is resolved |
| SCHEMA-4 | Repeated calls MUST return the **same cached instance** for a given schemaHash (referential identity per schemaHash) |
| SCHEMA-5 | If domain was provided as MEL text, `getDomainSchema()` returns the compiled result |
| SCHEMA-6 | After `switchBranch()` or schema-changing `fork({ domain, switchTo: true })`, if the new branch has a **different schemaHash**, subsequent `getDomainSchema()` calls MUST return the schema for the new schemaHash |

**Critical Note on SCHEMA-2**: The condition is "schema not yet resolved/cached", **NOT** "ready() not yet resolved". This distinction is crucial:
- READY-6 ensures schema is resolved BEFORE plugins execute
- Plugins execute DURING `ready()` (before it resolves)
- Therefore, plugins CAN call `getDomainSchema()` even though `ready()` hasn't resolved yet

**Rationale**:
- SCHEMA-1/6: Multi-schema scenarios (schema-changing forks) require `getDomainSchema()` to return the schema relevant to the current execution context, not a fixed "initial" schema.
- SCHEMA-2: Keyed to "schema resolved" rather than "ready resolved" to enable plugin access during initialization.
- SCHEMA-4: Referential identity per schemaHash enables efficient equality checks without deep comparison.
- READY-6: Ensures plugins can call `getDomainSchema()` during initialization.

**Multi-Schema Behavior:**

```typescript
const app = createApp(initialMel);
await app.ready();

// Initial schema
const schema1 = app.getDomainSchema();
console.log(schema1.hash);  // 'abc123'

// Schema-changing fork
await app.fork({ domain: newMel, switchTo: true });

// Now returns schema for new branch
const schema2 = app.getDomainSchema();
console.log(schema2.hash);  // 'def456' - different!

// Referential identity per schemaHash
const schema3 = app.getDomainSchema();
console.log(schema2 === schema3);  // true (same schemaHash)
```

**Plugin Usage:**

```typescript
// Plugin can safely call getDomainSchema() during initialization
// because READY-6 guarantees schema is resolved before plugins execute
const myPlugin: AppPlugin = async (app) => {
  const schema = app.getDomainSchema();  // ✅ Works - schema resolved
  
  // Build ActionSpace, register hooks, etc.
  const actionSpace = buildActionSpace(schema);
  
  app.hooks.on('action:completed', (payload, ctx) => {
    // Use actionSpace for validation
  });
};
```

---

## 7–10. State Model, Action Execution, Branch, Session

*(Sections 7–10 unchanged from v0.4.9)*

---

## 11. Hook System

*(Sections 11.1–11.4 unchanged from v0.4.9)*

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
  /**
   * Emitted when DomainSchema is resolved during ready().
   * 
   * This hook emits BEFORE plugins execute (per READY-6).
   * Plugins should use app.getDomainSchema() for reliable access
   * rather than capturing schema from this hook payload.
   * 
   * @see SCHEMA-1~6 for getDomainSchema() API
   */
  'domain:resolved': (
    payload: { schemaHash: string; schema: DomainSchema },
    ctx: HookContext
  ) => void | Promise<void>;
  
  /**
   * Emitted when a new schema is resolved (e.g., schema-changing fork).
   * Only emits for schemas not previously seen in this App instance.
   */
  'domain:schema:added': (
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
  'action:preparing': (
    payload: { proposalId: string; actorId: string; branchId?: string; type: string; runtime: 'domain' | 'system' },
    ctx: HookContext
  ) => void | Promise<void>;
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
  
  // Audit
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

## 12–18. Subscription, Services, Memory, Plugin, System Runtime, System Actions, Reserved Namespaces

*(Sections 12–18 unchanged from v0.4.9)*

---

## 19. Error Hierarchy

*(Section 19 unchanged from v0.4.9)*

---

## 20. Security Considerations

*(Section 20 unchanged from v0.4.9)*

---

## 21. References

*(Section 21 unchanged from v0.4.9)*

---

## Appendix A: Type Definitions

### A.1 Imported Types (from upstream packages)

These types are imported directly from their respective packages and MUST NOT be redefined:

| Package | Types |
|---------|-------|
| @manifesto-ai/core | `Snapshot`, `Patch`, `AppState`, `SnapshotMeta` |
| @manifesto-ai/world | `Proposal`, `Decision`, `Authority`, `AuthorityPolicy` |
| @manifesto-ai/memory | `MemoryRef`, `SelectionResult`, `VerificationEvidence`, `MemoryTrace`, `MemoryMaintenanceOp` |
| @manifesto-ai/compiler | `DomainSchema`, `ActionDefinition`, `EffectDefinition` |
| @manifesto-ai/host | `EffectHandler`, `HandlerContext` |

### A.2 App-Defined Types

These types are defined by App SPEC:

| Type | Description |
|------|-------------|
| `App` | Main facade interface |
| `ActionHandle` | Action lifecycle observer |
| `ActionResult` | Union of completion states |
| `Branch` | Branch pointer interface |
| `Session` | Fixed actor+branch context |
| `MemoryFacade` | Memory operations facade |
| `SystemFacade` | System Runtime access facade |
| `ServiceMap` | Effect handler registry |
| `AppPlugin` | Plugin type |
| `AppHooks` | Hook event definitions |

---

## Appendix B: FDR Cross-Reference

| SPEC Rule | FDR Reference | Issue |
|-----------|---------------|-------|
| SYS-3, SYS-4, SYS-6, SYS-7 | FDR-CRIT-002 | Rejected System Actions |
| NS-ACT-1~3, READY-4 | FDR-CRIT-003 | Action type namespace |
| MEM-SYS-1~5 | FDR-CRIT-004 | System Action recall anchor |
| API-AUD-1~4 | FDR-CRIT-005 | Audit failure policy |
| SYS-INV-1~3 | FDR-CRIT-006 | System Action invocation |
| ActOptions.branchId | FDR-CRIT-007 | branchId semantics |
| Hook payload branchId | FDR-CRIT-008 | Optional branchId |
| MEM-DIS-1~7 | FDR-CRIT-009 | Memory disabled |
| SESS-ACT-1~4 | FDR-CRIT-013 | Session override handling |
| MEM-REC-1~5 | FDR-CRIT-014 | Standalone recall anchor |
| VER-1~3 | FDR-CRIT-015 | NoneVerifier security |
| **SCHEMA-1~6, READY-1a, READY-6** | **FDR-CRIT-019** | **getDomainSchema() API** |

---

## Appendix C: Examples

*(Appendix C unchanged from v0.4.9)*

---

## Appendix D: Change History

| Version | Date | Changes |
|---------|------|---------|
| **0.4.10** | **2026-01-07** | **Added `getDomainSchema()` API (§6.2, SCHEMA-1~6) for reliable plugin schema access; SCHEMA-2 keyed to "schema resolved" (not "ready resolved") to enable plugin use; Added READY-1a exception for getDomainSchema(); Added READY-6 for schema resolution ordering; Reordered ready() steps (validate before emit); Added `domain:schema:added` hook; Added Mind Protocol Plugin SPEC v0.2.1 as dependent specification; Added FDR-CRIT-019 cross-reference** |
| 0.4.9 | 2026-01-07 | Critical fix: Added MemoryMaintenanceContext for actor-scope support (§14.3) |
| 0.4.8 | 2026-01-07 | Added Memory Maintenance system action (§17.5.1, system.memory.maintain) |
| 0.4.7 | 2026-01-06 | Security fix: NoneVerifier.verifyProof() MUST return false (VER-1~3) |
| 0.4.6 | 2026-01-06 | Fixed NS-EFF-2/SYSGET rule conflict; Added SESS-ACT-4 |
| 0.4.5 | 2026-01-06 | Added standalone recall anchor rules (MEM-REC-1~4); system.get built-in |
| 0.4.4 | 2026-01-06 | Added `preparation_failed` phase; Session override rules |
| 0.4.3 | 2026-01-06 | Fixed branchId semantics; Memory disabled behavior |
| 0.4.2 | 2026-01-06 | System Action recall anchor; Invocation restriction |
| 0.4.1 | 2026-01-06 | World Protocol compliance; Reserved namespace |
| 0.4.0 | 2026-01-06 | System Runtime Model; Reserved Namespaces |
| 0.3.x | 2026-01-05 | ActionHandle, Hook guards, Memory alignment |
| 0.2.0 | 2026-01-04 | Initial public draft |

---

## Appendix E: Implementation Guidance

*(Appendix E unchanged from v0.4.9)*

---

**End of Specification**
