# Manifesto App Foundational Design Rationale (FDR)

**Version:** 0.4.7  
**Status:** Final  
**Date:** 2026-01-06  
**Companion:** manifesto-ai-app__v0.4.7__SPEC.md

## Abstract

This document records the design rationale, critical issue resolutions, and architectural decisions made during the v0.4.x specification development cycle. Each decision includes the problem context, alternatives considered, chosen solution, and justification.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Critical Issue Resolution Log](#2-critical-issue-resolution-log)
3. [Architectural Decisions](#3-architectural-decisions)
4. [Rule Justifications](#4-rule-justifications)
5. [Cross-Reference Matrix](#5-cross-reference-matrix)

---

## 1. Overview

### 1.1 Specification Evolution

The v0.4.x specification evolved through 8 review iterations (v0.4.0 → v0.4.7), each addressing critical issues identified through runtime modeling and protocol compliance verification.

| Version | Primary Focus | Critical Issues Resolved |
|---------|---------------|-------------------------|
| v0.4.0 | System Runtime Model, Reserved Namespaces | Initial architecture |
| v0.4.1 | World Protocol Compliance (rejected handling) | 2 |
| v0.4.2 | System Action recall anchor, Invocation restriction | 1 |
| v0.4.3 | branchId semantics, Memory disabled behavior | 3 |
| v0.4.4 | preparation_failed phase, Error code consistency | 2 |
| v0.4.5 | Standalone recall anchor, system.get built-in | 2 |
| v0.4.6 | NS-EFF-2 conflict, Fork bypass, Session actor | 3 |
| v0.4.7 | NoneVerifier security, Edge case clarifications | 1 |

**Total Critical Issues Resolved: 14**

### 1.2 Design Principles Applied

Throughout the v0.4.x cycle, these principles guided decisions:

1. **Protocol Compliance**: No modification to World Protocol, Core, Host, or Memory SPEC semantics
2. **Determinism**: All state changes must be reproducible and auditable
3. **Type Consistency**: Types across package boundaries must be exactly aligned
4. **Implementation Non-Divergence**: Specifications must be unambiguous to prevent implementation fragmentation
5. **Security by Default**: Reserved namespaces and built-in handlers prevent privilege escalation

---

## 2. Critical Issue Resolution Log

### 2.1 FDR-CRIT-001: System Action Persistence Model Undefined (v0.4.0)

**Problem**: System Actions (`system.branch.checkout`, `system.memory.configure`, etc.) don't modify domain state, producing no patches. With World Protocol's `worldId = schemaHash + snapshotHash`, same snapshotHash means same worldId as parent, breaking DAG integrity.

**Options Considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. System Runtime Separation | Separate runtime with fixed schema for System Actions | Clean separation, protocol compliant | Dual runtime complexity |
| B. Reserved audit path | All System Actions append to `data.__system.audit[]` | Single runtime | Pollutes domain state, requires Core SPEC change |

**Decision**: Option A - System Runtime Separation

**Rationale**: Option B would require modifying Core SPEC's snapshot semantics and pollute user domain state with operational metadata. Option A keeps each runtime's worldline clean and maintains protocol compliance without upstream changes.

**Resulting Rules**: SYSRT-1~9

---

### 2.2 FDR-CRIT-002: Rejected System Actions Creating Worlds (v0.4.1)

**Problem**: Initial spec stated "All System Actions MUST create System World" (SYS-3), but World Protocol explicitly states `rejected` proposals do NOT create Worlds.

**Analysis**: World Protocol state machine:
- `completed` → World created
- `failed` → World created (with error state)
- `rejected` → **NO World created** (terminal, decision only)

**Decision**: Revise SYS-3/4/6/7 to explicitly handle rejected case

**Resulting Rules**:
- SYS-3: System Actions reaching `completed` or `failed` MUST create System World
- SYS-4: System Actions that are `rejected` MUST NOT create any World
- SYS-6/7: `system:world` hook emits ONLY on World creation

**Hook Rename**: `system:action` → `system:world` (semantic accuracy)

---

### 2.3 FDR-CRIT-003: Action Type Namespace Not Reserved (v0.4.1)

**Problem**: Reserved Namespaces (§18) only covered effect types, not action types. User could define `system.custom` action, which would be routed to System Runtime unexpectedly.

**Decision**: Extend namespace reservation to action types

**Resulting Rules**: NS-ACT-1~3, READY-4

---

### 2.4 FDR-CRIT-004: System Action Recall atWorldId Conflict (v0.4.2)

**Problem**: Initial design used `app.system.head()` (System Runtime worldId) as `atWorldId` for System Action recall, but selection target was Domain Runtime worldlines. Memory providers use `atWorldId` to scope lineage/schema/store queries—different schemaHash would break implementations.

**Options Considered**:

| Option | Description | Verdict |
|--------|-------------|---------|
| A. System head as anchor | `atWorldId = app.system.head()` | ❌ Type mismatch with Memory SPEC |
| B. Domain head as anchor | `atWorldId = app.currentBranch().head()` | ✅ Type consistent |
| C. Dual anchor fields | Both system and domain anchors | Overcomplicated |

**Decision**: Option B - Domain anchor with optional system correlation

**Resulting Rules**: MEM-SYS-1~5
- `atWorldId` = Domain Runtime worldId (type consistent)
- `ProposalTraceContext.systemAtWorldId` = optional audit correlation

---

### 2.5 FDR-CRIT-005: App API Audit Failure Policy Undefined (v0.4.2)

**Problem**: App APIs (fork, checkout, backfill) trigger internal System Actions for audit. If audit is rejected/failed, should the API fail?

**Decision**: Best-effort audit with observable hooks

**Rationale**: Blocking user operations due to audit infrastructure issues would degrade UX. Audit is important but not worth blocking core functionality.

**Resulting Rules**: API-AUD-1~4
- `rejected` → API completes, `audit:rejected` hook emits
- `failed` → API MAY proceed, `audit:failed` hook emits
- Optional `auditPolicy: 'strict'` for critical deployments

---

### 2.6 FDR-CRIT-006: System Action Invocation via branch.act()/session.act() (v0.4.2)

**Problem**: `branch.act()` and `session.act()` carry `branchId` context that doesn't apply to System Runtime. Allowing `system.*` invocation creates routing ambiguity.

**Decision**: System Actions MUST be invoked via `app.act()` only

**Resulting Rules**: SYS-INV-1~3, `SystemActionRoutingError`

---

### 2.7 FDR-CRIT-007: branchId Semantic Conflict (v0.4.3)

**Problem**: `ActOptions.branchId` was marked "Domain Runtime only" but also used as recall anchor for System Actions (MEM-SYS-2).

**Decision**: Clarify dual semantics explicitly

**Resulting Change**:
```typescript
/**
 * Branch context.
 * - Domain Actions: Execution branch override
 * - System Actions: Domain anchor for recall ONLY (does NOT affect System Runtime execution)
 */
branchId?: string;
```

---

### 2.8 FDR-CRIT-008: Hook Payload branchId Required for System Actions (v0.4.3)

**Problem**: `action:preparing`/`action:submitted` payloads required `branchId: string`, but System Actions have no branch concept.

**Decision**: Make `branchId` optional in hook payloads

**Resulting Change**: `branchId?: string` with JSDoc clarification

---

### 2.9 FDR-CRIT-009: Memory Disabled Behavior Undefined (v0.4.3)

**Problem**: When `memory: false`, behavior of `recall()`, `backfill()`, and `ActOptions.recall` was unspecified.

**Options Considered**:

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Strict failure | Throw errors, preparation_failed | ✅ Clear, prevents silent bugs |
| B. Graceful no-op | Return empty results | ❌ Masks configuration errors |

**Decision**: Option A - Strict failure mode

**Resulting Rules**: MEM-DIS-1~7, `MemoryDisabledError`

---

### 2.10 FDR-CRIT-010: ActionPhase Missing preparation_failed (v0.4.4)

**Problem**: `PreparationFailedActionResult` and ACT-PREP-5 exist, but `ActionPhase` union didn't include `preparation_failed`. Implementations would either map to `failed` (wrong semantics) or keep `preparing` (false state).

**Decision**: Add `preparation_failed` to ActionPhase and ActionUpdateDetail

**Resulting Changes**:
- `ActionPhase`: Added `'preparation_failed'`
- `ActionUpdateDetail`: Added `{ kind: 'preparation_failed'; error: ErrorValue }`
- World Protocol Mapping: Added row with "No World Created"

---

### 2.11 FDR-CRIT-011: MEM-DIS-6 Error Code Conflict (v0.4.4)

**Problem**: `ActionPreparationError.code = 'ACTION_PREPARATION'` (error class code) but MEM-DIS-6 required `code = 'MEMORY_DISABLED'`. Same field, two values = contradiction.

**Decision**: Separate exception code from result error code

**Resulting Change**:
- `ActionPreparationError.code` = `'ACTION_PREPARATION'` (exception type)
- `PreparationFailedActionResult.error.code` = `'MEMORY_DISABLED'` (specific cause)

---

### 2.12 FDR-CRIT-012: Standalone Recall Anchor Undefined (v0.4.5)

**Problem**: `app.memory.recall()` and `session.recall()` lacked explicit `atWorldId` determination rules. Implementations would diverge on which worldId to use.

**Decision**: Explicit anchor rules

**Resulting Rules**: MEM-REC-1~5
- `app.memory.recall()`: `ctx.branchId`'s head or `currentBranch().head()`
- `session.recall()`: Always `session.branchId`'s head
- Error on non-existent branchId

---

### 2.13 FDR-CRIT-013: system.get Override/Validation Unclear (v0.4.5)

**Problem**: `system.get` is Compiler-reserved effect, but:
1. Could user override via `services['system.get']`?
2. How does strict validation treat it?

**Decision**: Built-in handler, override forbidden, always satisfied

**Resulting Rules**: SYSGET-1~6
- Built-in handler provided by App/Host
- Registration in `services` throws `ReservedEffectTypeError`
- Strict validation treats as satisfied

---

### 2.14 FDR-CRIT-014: NS-EFF-2 vs SYSGET Rule Conflict (v0.4.6)

**Problem**: NS-EFF-2 prohibited `system.*` effects, but `system.get` is legitimate Compiler-generated effect. Literal reading would block valid MEL compilation.

**Decision**: Explicit exception for Compiler-generated system.get

**Resulting Change**: NS-EFF-2 revised with "(except `system.get` which is Compiler-generated)" + clarifying note

---

### 2.15 FDR-CRIT-015: system.get Override via ForkOptions Bypass (v0.4.6)

**Problem**: READY-5 blocked `system.get` in `CreateAppOptions.services`, but `ForkOptions.services` was unprotected. Fork could bypass the restriction.

**Decision**: Extend validation to all ServiceMap inputs

**Resulting Rules**: SYSGET-2 extended, SYSGET-6 added
- "Any `ServiceMap` provided to App" (both CreateAppOptions AND ForkOptions)
- Validation at both `ready()` and `fork()` time

---

### 2.16 FDR-CRIT-016: session.act() actorId Override (v0.4.6)

**Problem**: Session provides fixed (actorId + branchId) context, but `opts.actorId` handling was unspecified. Could enable actor spoofing, bypassing authority/audit boundaries.

**Decision**: Session ignores actorId override

**Resulting Rule**: SESS-ACT-4

**Rationale**: World Protocol binds Proposals to Actors for accountability. Session must preserve this binding. If override needed, use `app.act()`.

---

### 2.17 FDR-CRIT-017: NoneVerifier Security Vulnerability (v0.4.7)

**Problem**: NoneVerifier.verifyProof() returned `true` for `proof.method === 'none'`. If implementations computed `verified = verifier.verifyProof(proof)`, unverified memories would be marked as verified, defeating `SelectionConstraints.requireVerified`.

**Analysis**:
```typescript
// BEFORE (vulnerable)
verifyProof(proof) {
  return proof.method === 'none';  // Returns true!
}

// Implementation using this:
memory.verified = verifier.verifyProof(proof);  // verified = true for unverified!
```

**Security Impact**:
- `requireVerified` constraint becomes ineffective
- Unverified memories silently promoted to "verified" status
- §20.3 high-trust deployment requirements compromised

**Decision**: NoneVerifier.verifyProof() MUST always return `false`

**Resulting Rules**: VER-1~3
- VER-1: `verified = proveResult.valid && verifyProof(proof)`
- VER-2: NoneVerifier always produces `verified = false`
- VER-3: `requireVerified = true` filters all NoneVerifier results

**Rationale**: The only safe default is that unverified is never verified. Explicit verification requires a real Verifier implementation.

---

## 3. Architectural Decisions

### 3.1 FDR-ARCH-001: Dual Runtime Model

**Context**: Need to support both user domain actions and system operational actions while maintaining protocol compliance.

**Decision**: Two separate runtimes with independent worldlines

```
┌─────────────────────────────────────────┐
│            Manifesto App                │
│  ┌─────────────────┐  ┌─────────────────┐
│  │ Domain Runtime  │  │ System Runtime  │
│  │ (user schema)   │  │ (fixed schema)  │
│  │ - user actions  │  │ - system.* ops  │
│  │ - user state    │  │ - audit state   │
│  └─────────────────┘  └─────────────────┘
└─────────────────────────────────────────┘
```

**Benefits**:
- Clean separation of concerns
- Protocol compliance (each runtime has stable schemaHash)
- Independent audit trails
- No domain state pollution

---

### 3.2 FDR-ARCH-002: ActionHandle Lifecycle Model

**Context**: Actions have async preparation (recall, trace composition) before World Protocol submission.

**Decision**: Phased lifecycle with `preparing` → `submitted` → ... → terminal

**State Machine**:
```
preparing ──┬──→ preparation_failed (terminal, no World)
            │
            └──→ submitted → evaluating → pending → approved → executing
                                │            │         │          │
                                │            │         │          ├──→ completed (World)
                                │            │         │          │
                                └────────────┴─────────┴──────────┴──→ rejected (no World)
                                                                  │
                                                                  └──→ failed (World w/error)
```

**Key Invariants**:
- `proposalId` is stable throughout lifecycle
- Phase transitions are monotonic (no going back)
- World creation only on `completed`/`failed`

---

### 3.3 FDR-ARCH-003: Hook Mutation Guard Pattern

**Context**: Hooks observe state changes but must not cause uncontrolled mutations.

**Decision**: Direct mutations forbidden in hooks; use `enqueue()` for deferred execution

**Pattern**:
```typescript
app.hooks.on('action:completed', (payload, ctx) => {
  // ❌ FORBIDDEN - throws HookMutationError
  app.act('audit.log', payload);
  
  // ✅ CORRECT - deferred execution
  ctx.enqueue(() => app.act('audit.log', payload));
});
```

**Benefits**:
- Predictable execution order
- No recursive/reentrant mutations
- Aligns with World Event System's "handler non-interference"

---

### 3.4 FDR-ARCH-004: Reserved Namespace Strategy

**Context**: Need to prevent collisions between Compiler effects, System Actions, and user-defined types.

**Decision**: Multi-layer reservation with explicit exceptions

| Layer | Reserved | Exception |
|-------|----------|-----------|
| Effect Types | `system.*` | `system.get` (Compiler) |
| Action Types | `system.*` | None (all reserved for System Actions) |
| Services | `system.get` | None (built-in only) |

**Validation Points**:
- `ready()`: DomainSchema action types, services
- `fork()`: services
- Runtime: Effect execution, action routing

---

### 3.5 FDR-ARCH-005: Memory Integration Model

**Context**: Memory recall needs consistent anchor points and type compliance with Memory SPEC v1.2.

**Decision**: Domain-centric anchoring with explicit rules per context

| Context | atWorldId Source |
|---------|------------------|
| Domain Action | `branch.head()` |
| System Action | `currentBranch().head()` or `opts.branchId` head |
| `app.memory.recall()` | `ctx.branchId` head or `currentBranch().head()` |
| `session.recall()` | `session.branchId` head |

**Invariants**:
- `atWorldId` always refers to Domain Runtime worldId
- System Runtime head recorded separately for audit (`systemAtWorldId`)
- Memory ingest is Domain Worlds only by default

---

### 3.6 FDR-ARCH-006: Error Hierarchy Design

**Context**: Need consistent error handling across lifecycle phases and API surfaces.

**Decision**: Two-level error model

1. **Exception Classes** (thrown): Fixed `code` per class
    - `ActionPreparationError.code = 'ACTION_PREPARATION'`
    - `ActionRejectedError.code = 'ACTION_REJECTED'`

2. **ErrorValue in Results** (returned): Specific cause codes
    - `PreparationFailedActionResult.error.code = 'MEMORY_DISABLED'`
    - Enables cause inspection without exception type proliferation

---

### 3.7 FDR-ARCH-007: Session Context Immutability

**Context**: Sessions provide scoped execution context. Override behavior affects accountability model.

**Decision**: Session context is immutable; overrides ignored

| Field | session.act() Behavior |
|-------|------------------------|
| `opts.branchId` | Ignored (SESS-ACT-1) |
| `opts.actorId` | Ignored (SESS-ACT-4) |

**Rationale**: World Protocol binds Proposals to Actors. Session represents "this actor, this branch" contract. Allowing overrides would enable actor spoofing and break audit trail integrity.

---

## 4. Rule Justifications

### 4.1 Lifecycle Rules

| Rule | Justification |
|------|---------------|
| READY-1~5 | Prevent use of uninitialized state; validate reserved names early |
| DISPOSE-1~3 | Clean shutdown with deterministic termination |
| ACT-PREP-1~5 | Ensure Memory selection before submission (Memory SPEC M-3) |
| DONE-1~6 | Clear contract for success/failure handling |
| DETACH-1~5 | Enable long-running action monitoring without blocking |

### 4.2 Hook Rules

| Rule | Justification |
|------|---------------|
| HOOK-MUT-1~3 | Prevent reentrant mutations; maintain observation-only semantics |
| ENQ-1~6 | Predictable deferred execution; priority-based scheduling |

### 4.3 Memory Rules

| Rule | Justification |
|------|---------------|
| MEM-1~1b | Domain-only ingest prevents schema confusion in providers |
| MEM-SYS-1~5 | Domain anchor ensures type consistency with Memory SPEC |
| MEM-DIS-1~7 | Strict failure prevents silent configuration errors |
| MEM-REC-1~5 | Consistent anchor rules prevent implementation divergence |

### 4.4 System Rules

| Rule | Justification |
|------|---------------|
| SYSRT-1~9 | Dual runtime maintains protocol compliance |
| SYS-1~7 | System Actions create audit trail in System Runtime |
| SYS-INV-1~3 | Prevent routing ambiguity from branch/session context |

### 4.5 Namespace Rules

| Rule | Justification |
|------|---------------|
| NS-EFF-1~4 | Protect Compiler's system.get; prevent user collisions |
| NS-ACT-1~4 | Prevent routing conflicts; block invalid system.get action |
| SYSGET-1~6 | Built-in handler ensures determinism; block all override paths |

### 4.6 Session/Branch Rules

| Rule | Justification |
|------|---------------|
| SESS-ACT-1~4 | Session context immutability; prevent actor spoofing |
| CHECKOUT-1~3 | Schema/lineage integrity on branch operations |
| FORK-1~4 | MigrationLink audit trail for schema changes |

### 4.7 Service Rules

| Rule | Justification |
|------|---------------|
| SVC-1~5 | Validation modes for different deployment contexts |
| SVC-ERR-1~5 | Safety net for handler throws; consistent error handling |
| API-AUD-1~4 | Best-effort audit doesn't block user operations |

---

## 5. Cross-Reference Matrix

### 5.1 Critical Issue → Rules Mapping

| Critical Issue | Version | Rules Added/Modified |
|----------------|---------|---------------------|
| FDR-CRIT-001 | v0.4.0 | SYSRT-1~9 |
| FDR-CRIT-002 | v0.4.1 | SYS-3, SYS-4, SYS-6, SYS-7 |
| FDR-CRIT-003 | v0.4.1 | NS-ACT-1~3, READY-4 |
| FDR-CRIT-004 | v0.4.2 | MEM-SYS-1~5 |
| FDR-CRIT-005 | v0.4.2 | API-AUD-1~4 |
| FDR-CRIT-006 | v0.4.2 | SYS-INV-1~3 |
| FDR-CRIT-007 | v0.4.3 | ActOptions.branchId JSDoc |
| FDR-CRIT-008 | v0.4.3 | Hook payload branchId optional |
| FDR-CRIT-009 | v0.4.3 | MEM-DIS-1~7 |
| FDR-CRIT-010 | v0.4.4 | ActionPhase, ActionUpdateDetail |
| FDR-CRIT-011 | v0.4.4 | MEM-DIS-6 revision |
| FDR-CRIT-012 | v0.4.5 | MEM-REC-1~5 |
| FDR-CRIT-013 | v0.4.5 | SYSGET-1~5, READY-5 |
| FDR-CRIT-014 | v0.4.6 | NS-EFF-2 revision |
| FDR-CRIT-015 | v0.4.6 | SYSGET-2 extension, SYSGET-6 |
| FDR-CRIT-016 | v0.4.6 | SESS-ACT-4 |
| FDR-CRIT-017 | v0.4.7 | VER-1~3, NoneVerifier fix |

### 5.2 Architecture → Specification Sections

| Arch Decision | Spec Sections |
|---------------|---------------|
| FDR-ARCH-001 | §4, §16 |
| FDR-ARCH-002 | §8.1, §8.2, §8.3 |
| FDR-ARCH-003 | §11.2, §11.3, §11.4 |
| FDR-ARCH-004 | §18 |
| FDR-ARCH-005 | §14 |
| FDR-ARCH-006 | §19 |
| FDR-ARCH-007 | §10.2 |

### 5.3 Protocol Compliance Verification

| Protocol | Compliance Point | Verified Rules |
|----------|------------------|----------------|
| World Protocol | worldId = schemaHash + snapshotHash | SYSRT-1~9 |
| World Protocol | rejected → no World | SYS-3, SYS-4 |
| World Protocol | Proposal immutable after submit | ACT-PREP-2~3 |
| Memory SPEC v1.2 | SelectionRequest.atWorldId | MEM-SYS-1, MEM-REC-1~2 |
| Memory SPEC v1.2 | SelectionResult type | MEM-3 |
| Memory SPEC v1.2 | MemoryTrace type | MEM-4~5 |
| Compiler SPEC v0.4 | system.get effect | NS-EFF-1, SYSGET-1~6 |
| Core SPEC | Effect handlers don't throw | SVC-ERR-1~5 |

---

## Appendix A: Rejected Alternatives Summary

| Decision | Rejected Alternative | Reason |
|----------|---------------------|--------|
| Dual Runtime | Reserved audit path in domain | Pollutes domain state, requires Core change |
| system.get exception | User can define system.get | Breaks Compiler contract |
| Memory disabled graceful | Return empty results | Masks configuration errors |
| Session override allowed | Honor opts.actorId | Enables actor spoofing |
| System World on rejected | Create empty World | Violates World Protocol |

---

## Appendix B: Implementation Guidance

### B.1 Testing Priority (by Rule Criticality)

**P0 - Protocol Compliance**:
- SYSRT-1~9, SYS-3/4, ACT-PREP-2~3

**P1 - Security/Determinism**:
- SYSGET-1~6, SESS-ACT-4, NS-*

**P2 - Type Consistency**:
- MEM-SYS-*, MEM-REC-*, ActionPhase coverage

**P3 - DX/Robustness**:
- MEM-DIS-*, SVC-ERR-*, HOOK-MUT-*

### B.2 Common Implementation Pitfalls

1. **Forgetting fork() validation**: SYSGET-6 requires validation at both ready() and fork()
2. **Using System worldId for recall**: Always use Domain anchor (MEM-SYS-1)
3. **Creating World on rejected**: Check World Protocol state before World creation
4. **Allowing session overrides**: Both branchId AND actorId must be ignored
5. **Emitting hooks before ready()**: All hooks require ready state

---

## Appendix C: Agent-Assisted Implementation Guidelines

### C.1 Problem Statement

When providing this specification to coding agents (Claude Code, Cursor, etc.), there is a significant risk that the agent will:

1. **Ignore existing codebase** and design new types/architectures from scratch
2. **Violate upstream invariants** (Host, Core, World, Memory) by reimplementing their contracts
3. **Create drift** between App and the rest of the Manifesto ecosystem

This happens because a complete specification appears "self-sufficient" to an agent, reducing its motivation to search for and reuse existing code.

### C.2 Upstream Package Invariants (MUST NOT Violate)

These invariants are **constitutional** and MUST NOT be modified or bypassed by App implementation:

#### Host Contract Invariants

| Invariant | Description |
|-----------|-------------|
| HOST-INV-1 | Snapshot is the single channel between Core and Host |
| HOST-INV-2 | No resume - execution is atomic |
| HOST-INV-3 | Effect handlers express results as `Patch[]` (throw forbidden) |
| HOST-INV-4 | Translator output MUST go through Compiler: lower → evaluate → apply |

#### World Protocol Invariants

| Invariant | Description |
|-----------|-------------|
| WORLD-INV-1 | `worldId = hash(schemaHash + snapshotHash)` |
| WORLD-INV-2 | `rejected` proposals do NOT create Worlds |
| WORLD-INV-3 | Proposal is immutable after submission |
| WORLD-INV-4 | Authority evaluation is synchronous |

#### Memory SPEC v1.2 Invariants

| Invariant | Description |
|-----------|-------------|
| MEM-INV-1 | 4-Layer architecture (Broker → Provider → Verifier → Storage) |
| MEM-INV-2 | Selection MUST complete before Proposal submission |
| MEM-INV-3 | Verifier purity - no side effects |
| MEM-INV-4 | Type definitions are canonical (no redefinition) |

#### Compiler SPEC Invariants

| Invariant | Description |
|-----------|-------------|
| COMP-INV-1 | `system.get` is effect type, not action type |
| COMP-INV-2 | MEL source → DomainSchema transformation is Compiler's responsibility |
| COMP-INV-3 | Effect type extraction is static analysis |

### C.3 Three-Phase Implementation Process

To prevent "greenfield reimplementation", enforce this process:

#### Phase 1: Inventory Pass (Read-Only)

**Goal**: Identify reusable components before any code generation.

**Agent Instructions**:
```
DO NOT write any code yet.

1. Search the existing codebase for:
   - Types that match App SPEC interfaces
   - Functions that implement required behaviors
   - Patterns already established in Host/Core/World/Memory

2. Output a "Reuse Candidate List":
   | App SPEC Component | Existing Package | Existing Type/Function | Reuse Strategy |
   |--------------------|------------------|------------------------|----------------|
   | ActionHandle       | @manifesto/world | Proposal + Decision    | Thin wrapper   |
   | ServiceHandler     | @manifesto/effect-utils | EffectHandler   | Direct import  |
   | ...                | ...              | ...                    | ...            |

3. Only proceed to Phase 2 after completing this inventory.
```

#### Phase 2: Spec↔Code Mapping Table

**Goal**: Explicit mapping from every SPEC API to implementation location.

**Required Output Format**:
```markdown
## Spec↔Code Mapping

| SPEC Section | API/Type | Implementation File | Strategy | New Code Required? |
|--------------|----------|---------------------|----------|-------------------|
| §5.1 | createApp() | packages/app/src/createApp.ts | New file | Yes - facade only |
| §8.1 | ActionHandle | packages/app/src/ActionHandle.ts | Wraps World.Proposal | Thin wrapper |
| §13.1 | ServiceHandler | packages/effect-utils/src/types.ts | Direct import | No |
| §14.5 | MemoryFacade | packages/app/src/memory/facade.ts | Wraps Memory.Broker | Thin wrapper |
| ... | ... | ... | ... | ... |

## New Type Justification

For each "Yes" in "New Code Required?", provide:
1. Why no existing type can be reused
2. Which upstream types it wraps/extends
3. Proof that it doesn't violate upstream invariants
```

#### Phase 3: Diff-First Implementation

**Goal**: Minimal changes to existing codebase.

**Agent Instructions**:
```
Implementation Rules:
1. FORBIDDEN: Creating new packages
2. FORBIDDEN: Redefining types that exist in upstream packages
3. REQUIRED: Every new file must reference which existing files it integrates with
4. REQUIRED: Changes as unified diff format
5. REQUIRED: Each PR focuses on single SPEC section

Implementation Order:
1. Thin facade (compiles but minimal functionality)
2. Lifecycle (ready/dispose)
3. Action flow (act → ActionHandle → result)
4. Memory integration
5. System Runtime
6. Hooks
7. Conformance tests
```

### C.4 Agent Prompt Template

Use this prompt when delegating implementation to coding agents:

```markdown
# Role
You are a **legacy-reuse integration engineer**. Your primary goal is to implement 
App SPEC v0.4.6 by **maximally reusing existing code** from the Manifesto ecosystem.

# Absolute Rules
1. **NO new type definitions** unless existing types provably cannot be reused
2. **Read-only inventory FIRST** - search codebase before any code generation
3. **Spec↔Code mapping table REQUIRED** before implementation
4. **Diff-first** - modify existing files with minimal changes; new files require justification
5. **Upstream invariants are IMMUTABLE**:
   - Host: Snapshot channel, no-resume, Patch[] results, Compiler pipeline
   - World: worldId formula, rejected=no World, Proposal immutability
   - Memory: 4-Layer, selection-before-submission, Verifier purity
   - Compiler: system.get is effect type, static effect extraction

# Phase 1 Deliverable (NO CODE)
- Reuse Candidate List (table format)
- Upstream Integration Points (what existing code does App wrap?)

# Phase 2 Deliverable (NO CODE)
- Spec↔Code Mapping Table (every SPEC API → implementation location)
- New Type Justification (for each truly new type)
- Change Plan (files to modify, estimated diff summary)

# Phase 3 Deliverable (CODE)
- Thin facade PR
- Feature PRs (one per SPEC section)
- Conformance tests (especially: rejected=no World, system.get built-in, 
  preparing selection-before-submission)

# Key Integration Points
- `@manifesto-ai/effect-utils`: Base for services DX (DO NOT reinvent)
- `@manifesto-ai/world`: Proposal/Decision types (wrap, don't redefine)
- `@manifesto-ai/memory`: MemoryTrace/SelectionResult types (import directly)
- `@manifesto-ai/host`: Effect execution model (respect, don't bypass)
- `@manifesto-ai/core`: Snapshot/Patch types (canonical, no redefinition)
```

### C.5 Reuse Priority Matrix

When implementing App SPEC, prioritize reuse in this order:

| Priority | Package | What to Reuse | App's Role |
|----------|---------|---------------|------------|
| P0 | @manifesto-ai/core | Snapshot, Patch, AppState types | Direct import |
| P0 | @manifesto-ai/world | Proposal, Decision, Authority types | Thin wrapper |
| P0 | @manifesto-ai/memory | MemoryTrace, SelectionResult, Provider | Direct import |
| P1 | @manifesto-ai/host | Effect execution model | Respect contract |
| P1 | @manifesto-ai/effect-utils | Handler combinators | Build services DX on top |
| P2 | @manifesto-ai/compiler | DomainSchema, system.get handling | Integration point |
| P3 | @manifesto-ai/react | Factory patterns | Adapter or migration path |

### C.6 Anti-Patterns to Reject

If an agent produces any of these, **reject and restart**:

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| New `Proposal` type | World Protocol already defines it | Import from @manifesto-ai/world |
| New `Patch` type | Core SPEC canonical type | Import from @manifesto-ai/core |
| New effect execution loop | Host contract violation | Use Host's executor |
| `system.get` as action handler | Compiler contract violation | Built-in effect handler only |
| Memory type redefinition | Memory SPEC canonical | Import from @manifesto-ai/memory |
| New state management | Core already provides | Use Core's Snapshot model |

### C.7 Verification Checklist

Before accepting agent-generated code, verify:

- [ ] No new packages created
- [ ] All types from upstream packages are imported, not redefined
- [ ] Host invariants preserved (Patch[], no-resume, Snapshot channel)
- [ ] World invariants preserved (rejected=no World, worldId formula)
- [ ] Memory invariants preserved (selection-before-submission)
- [ ] Compiler invariants preserved (system.get is effect type)
- [ ] effect-utils used for services DX (not reinvented)
- [ ] Conformance tests cover P0/P1 rules

---

**End of FDR**
