# Manifesto Translator Specification v0.1.1

> **Status:** Draft  
> **Version:** 0.1.1  
> **Authors:** Manifesto Contributors  
> **License:** MIT  
> **Companion:** ADR-TRANSLATOR-001, ADR-TRANSLATOR-002, ADR-TRANSLATOR-003  
> **Depends On:** Intent IR v0.1 (historical; current canonical is v0.2.0)

---

> **Alignment Note (2026-01-30)**
>
> This spec describes Translator v0.1 and was authored against Intent IR v0.1.
> The current canonical Intent IR spec is v0.2.0, which adds ListTerm,
> QuantitySpec, `in` predicate support, term-level `ext`, and canonicalization
> refinements without changing the role enum or lowering contract.
> For current Translator behavior, see `translator-SPEC-v1.0.3.md`.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Philosophy](#3-core-philosophy)
4. [Axioms](#4-axioms)
5. [Architecture](#5-architecture)
6. [Intent Graph](#6-intent-graph)
7. [Type Definitions](#7-type-definitions)
8. [Invariants](#8-invariants)
9. [Validation](#9-validation)
10. [Public API](#10-public-api)
11. [Output Artifacts](#11-output-artifacts)
12. [Lowering Semantics](#12-lowering-semantics)
13. [Error Handling](#13-error-handling)
14. [Examples](#14-examples)
15. [Conformance](#15-conformance)
16. [Extension Points](#16-extension-points)
17. [Versioning](#17-versioning)

---

## 1. Introduction

### 1.1 What is Translator?

Translator is a **semantic bridge** that transforms natural language into structured Intent representations. It provides:

- **Natural Language → Intent Graph** transformation (LLM-assisted)
- **Complex intent decomposition** into dependency-aware DAG structures
- **Ambiguity measurement** without policy decisions
- **Manifesto-compatible output** generation (InvocationPlan, MelCandidate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Natural Language  ────►  Intent Graph  ────►  ManifestoBundle            │
│   "Create a project        (DAG of IntentIR     (InvocationPlan +          │
│    and add tasks"           nodes)               MelCandidates)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Translator is NOT

Translator is NOT:

- An execution engine (execution is Host/App responsibility)
- A governance system (governance is World responsibility)
- A replacement for Intent IR (Translator composes with Intent IR)
- A policy decision maker (ambiguity triage is consumer responsibility)
- Part of Manifesto runtime (Translator is an independent package)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Independence** | No runtime dependency on Core/Host/World/App |
| **Composition** | Builds on Intent IR v0.1, does not replace it |
| **Measurement over Decision** | Produces ambiguity scores, not triage decisions |
| **Deferred Lowering** | Supports runtime-resolved discourse references |
| **Manifesto-First** | Optimized for Manifesto consumption (InvocationPlan + MEL) |

### 1.4 Relationship to Intent IR

Translator **composes with** Intent IR v0.1:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Translator                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Intent Graph                                    │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐                      │   │
│  │   │ IntentIR │───►│ IntentIR │───►│ IntentIR │   (DAG of nodes)     │   │
│  │   │  (v0.1)  │    │  (v0.1)  │    │  (v0.1)  │                      │   │
│  │   └──────────┘    └──────────┘    └──────────┘                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Each Intent Graph **node wraps** an IntentIR instance
- Intent IR's lowering contract (`IntentIR → IntentBody`) applies **per node**
- Translator does not modify Intent IR semantics

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Core Philosophy

### 3.1 The Translator Constitution

```
1. Independence is sacred. No runtime coupling to Core/Host/World/App.
2. Composition over replacement. Intent IR is wrapped, not superseded.
3. Measurement is pure. Ambiguity is scored, not judged.
4. Lowering is deferrable. Discourse refs may resolve at execution time.
5. Terminology is guarded. Internal concepts stay internal.
6. Graphs are acyclic. Cycles are errors, not features.
7. Status is orthogonal. Resolution status ≠ lowering capability.
```

### 3.2 The Separation Principle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Responsibility Boundaries                            │
│                                                                             │
│   Translator              │  Consumer (App/Agent/UI)                        │
│   ────────────────────────┼─────────────────────────────────────────────    │
│   Produces Intent Graph   │  Receives Intent Graph                          │
│   Measures ambiguity      │  Decides triage (auto/ask/reject)               │
│   Emits InvocationPlan    │  Executes InvocationPlan                        │
│   Suggests MelCandidates  │  Applies schema extensions                      │
│   Marks deferred lowering │  Resolves at execution time                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 The Two-Status Model

Translator distinguishes two orthogonal status dimensions:

| Dimension | Meaning | Values |
|-----------|---------|--------|
| **resolution.status** | Semantic completeness | `Resolved`, `Ambiguous`, `Abstract` |
| **lowering.status** | Execution readiness | `ready`, `deferred`, `failed` |

These are **independent**:
- A `Resolved` intent may have `lowering.status = "failed"` (schema doesn't support it)
- An `Ambiguous` intent may have `lowering.status = "ready"` (can execute with defaults)

---

## 4. Axioms

```
A1. Intent Graph nodes contain IntentIR instances (v0.1).
A2. Intent Graph is a DAG; cycles are structural errors.
A3. Every node has a resolution status and ambiguity score.
A4. Translator does not generate Proposal, Authority, ExecutionKey, or intentId.
A5. Translator does not invoke Host dispatch or World sealing.
A6. Ambiguity scores are measurements (0..1), not policy decisions.
A7. Lowering may be deferred when discourse refs are unresolvable at emit time.
A8. "Semantic Projection" is internal terminology, not exposed in public API.
A9. resolution.status and lowering.status are orthogonal dimensions.
```

---

## 5. Architecture

### 5.1 Package Boundary

Translator is published as `@manifesto-ai/translator`.

**Dependencies:**

| Package | Relationship |
|---------|--------------|
| `@manifesto-ai/intent-ir` | REQUIRED (peer dependency) |
| `@manifesto-ai/core` | NOT allowed (runtime) |
| `@manifesto-ai/host` | NOT allowed |
| `@manifesto-ai/world` | NOT allowed |
| `@manifesto-ai/app` | NOT allowed |

> **Note:** Type-only imports from `@manifesto-ai/core` are permitted for structural compatibility (e.g., `SnapshotLike`).

### 5.2 "Does NOT Know" Matrix

| Translator Does NOT Know |
|--------------------------|
| Execution loops |
| Host dispatch options |
| TraceEvent structure |
| World sealing |
| Proposal lifecycle |
| Authority deliberation |
| ExecutionKey generation |

### 5.3 Layer Position

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              App Layer                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │  Translator │  │    Host     │  │    World    │  │     UI      │       │
│   │  (Semantic  │  │ (Execution) │  │(Governance) │  │             │       │
│   │   Bridge)   │  │             │  │             │  │             │       │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘       │
│          │                │                │                                │
│          │                └────────────────┘                                │
│          │                         │                                        │
│          ▼                         ▼                                        │
│   ┌─────────────┐           ┌─────────────┐                                │
│   │  Intent IR  │           │    Core     │                                │
│   └─────────────┘           └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

Translator is **orthogonal** to Host↔World integration. It can be added or removed independently.

---

## 6. Intent Graph

### 6.1 Overview

Intent Graph is a **Directed Acyclic Graph (DAG)** where:
- **Nodes** represent individual intents (wrapping IntentIR)
- **Edges** represent logical dependencies (not temporal order)

### 6.2 Why DAG?

| Property | Benefit |
|----------|---------|
| **Termination** | Guaranteed traversal completion |
| **Determinism** | Topological sort yields consistent order |
| **Static Verification** | Cycle detection at construction time |
| **Parallel Execution** | Independent nodes can execute concurrently |

This aligns with Core's "computed as DAG" stability guarantees.

### 6.3 Node Structure

Each node wraps an IntentIR instance and adds metadata:

```typescript
type IntentNode = {
  /** Unique node identifier within the graph */
  id: IntentNodeId;
  
  /** The wrapped IntentIR (v0.1) instance */
  ir: IntentIR;
  
  /** IDs of nodes this node depends on */
  dependsOn: IntentNodeId[];
  
  /** Resolution state and ambiguity measurement */
  resolution: Resolution;
};
```

### 6.4 Graph Structure

```typescript
type IntentGraph = {
  /** All nodes in the graph */
  nodes: IntentNode[];
  
  /** Graph-level metadata */
  meta?: {
    sourceText: string;
    translatedAt: string;  // ISO 8601
  };
};
```

### 6.5 Edge Semantics

Edges are implicit in `dependsOn` arrays:

```typescript
// Node n2 depends on node n1
const n1: IntentNode = { id: "n1", dependsOn: [], ... };
const n2: IntentNode = { id: "n2", dependsOn: ["n1"], ... };

// Dependency edge (for topological sort): n1 → n2
// Read as: "n1 must complete before n2" (standard DAG semantics)
// Note: dependsOn points backward (n2 lists n1), edge points forward (n1 → n2)
```

**Convention:**
- `dependsOn[i]` means "this node depends on node with id `dependsOn[i]`"
- For topological sort, the **dependency edge direction** is `dependency → dependent` (i.e., `n1 → n2`)
- This ensures `topologicalSort(G)` returns nodes in execution order (dependencies first)

---

## 7. Type Definitions

### 7.1 Core Types

```typescript
/** Unique identifier for a node within an Intent Graph */
type IntentNodeId = string;

/** Resolution status - semantic completeness */
type ResolutionStatus = "Resolved" | "Ambiguous" | "Abstract";

/** Lowering status - execution readiness */
type LoweringStatus = "ready" | "deferred" | "failed";
```

### 7.2 Resolution

```typescript
type Resolution = {
  /** Semantic completeness status */
  status: ResolutionStatus;
  
  /** 
   * Ambiguity score (0..1).
   * 0 = fully unambiguous, 1 = maximally ambiguous.
   */
  ambiguityScore: number;
  
  /** 
   * Missing required θ-roles (role names only).
   * Values MUST be from Role enum: TARGET, THEME, SOURCE, DEST, INSTRUMENT, BENEFICIARY.
   * MUST be empty if status is "Resolved".
   * 
   * Note: Detailed information (e.g., "ref not resolved") goes in:
   * - lowering.status="deferred" with reason, OR
   * - questions[] for user clarification
   */
  missing?: Role[];
  
  /** Suggested clarifying questions for the user */
  questions?: string[];
};

/** θ-role names from Intent IR v0.1 */
type Role = "TARGET" | "THEME" | "SOURCE" | "DEST" | "INSTRUMENT" | "BENEFICIARY";
```

### 7.3 IntentNode

```typescript
type IntentNode = {
  /** Unique node identifier */
  id: IntentNodeId;
  
  /** Wrapped IntentIR instance (v0.1) */
  ir: IntentIR;
  
  /** Dependencies (node IDs this node depends on) */
  dependsOn: IntentNodeId[];
  
  /** Resolution state */
  resolution: Resolution;
};
```

### 7.4 IntentGraph

```typescript
type IntentGraph = {
  /** All nodes in the graph */
  nodes: IntentNode[];
  
  /** Optional metadata */
  meta?: {
    sourceText: string;
    translatedAt: string;
  };
};
```

### 7.5 Lowering Types

```typescript
type LoweringResult = 
  | { status: "ready"; intentBody: IntentBody }
  | { status: "deferred"; reason: string }  // ir is at InvocationStep level
  | { status: "failed"; reason: LoweringFailureReason };

type LoweringFailureReason = {
  kind: "action_not_found" | "role_mapping_failed" | "type_mismatch";
  details: string;
};
```

### 7.6 Snapshot-like (Structural Type)

```typescript
/**
 * Structural type for snapshot compatibility.
 * Translator does not depend on Core at runtime,
 * but accepts structurally compatible snapshots.
 */
type SnapshotLike = {
  data: Record<string, unknown>;
  computed?: Record<string, unknown>;
};
```

---

## 8. Invariants

### 8.1 Graph-Level Invariants

Translator MUST enforce these invariants on every Intent Graph:

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| **I1. Causal Integrity** | Graph is acyclic; topological sort is possible | `translate()` MUST verify |
| **I2. Referential Identity** | Entity refs within graph maintain identity | `translate()` MUST verify structural; `validate()` verifies type |
| **I3-S. Conceptual Completeness (Structural)** | Internal consistency: R1/R2 rules | `translate()` MUST verify |
| **I3-L. Conceptual Completeness (Lexicon)** | Missing roles match Lexicon theta frame | `validate()` MUST verify |
| **I4. Intent Statefulness** | Every node has `resolution.status` | `translate()` MUST verify |

### 8.2 Invariant Details

#### I1. Causal Integrity

```
INVARIANT: For all nodes n in graph G:
  - The transitive closure of dependsOn contains no cycles
  - topologicalSort(G) terminates successfully
  
Topological Sort Edge Convention:
  - For n2.dependsOn = ["n1"], the dependency edge is n1 → n2
  - topologicalSort returns nodes where dependencies come before dependents
  - Result: execution order (n1 before n2)
```

Violation → `TranslatorError: CYCLE_DETECTED`

#### I2. Referential Identity

```
INVARIANT: For all entity references r1, r2 in graph G:
  - If r1.ref.kind = "id" and r2.ref.kind = "id" and r1.ref.id = r2.ref.id:
    - r1 and r2 MUST refer to the same entity
  - Discourse refs (this/that/last) are deferred bindings:
    - Identity is resolved at Resolver/execution time, NOT at translate time
    - Translator MAY mark such nodes as Ambiguous or lowering.status="deferred"
```

| Ref Kind | Identity Enforcement | Resolution Point |
|----------|---------------------|------------------|
| `{ kind: "id", id: "..." }` | MUST: same ID = same entity | translate() |
| `{ kind: "this" \| "that" \| "last" }` | Deferred binding | Resolver/emit |

**Entity ID Uniqueness Rule (Translator-level constraint):**

> **Note:** This rule is a Translator-level assumption layered on top of Intent IR.
> Intent IR itself allows `entityType`-scoped IDs. Translator requires global uniqueness
> for simpler graph semantics. Integrators with type-scoped IDs should use namespaced
> IDs (e.g., `"Project:123"` instead of `"123"`).

- Entity IDs are globally unique within a graph (cross-entityType)
- If two refs have `kind: "id"` with the same `id` value, they MUST have the same `entityType`
- Violation → structural validation error

**Decompose+Merge Note:** Discourse refs do NOT create cross-chunk identity links. Cross-chunk entity unification (if needed) is consumer responsibility, not Translator core.

#### I3. Conceptual Completeness

I3 is split into two levels to match the two-phase validation model:

**I3-S (Structural) — Verified by translate():**
```
INVARIANT: For all nodes n in graph G:
  - R1: If status = "Resolved", then missing MUST be empty or undefined
  - R2: If missing is non-empty, then status MUST be "Ambiguous" or "Abstract"
  
This is internal consistency only. translate() does NOT know the authoritative
required roles (Lexicon is not available), so it enforces consistency rules,
not completeness against Lexicon.
```

**I3-L (Lexicon-Verified) — Verified by validate():**
```
INVARIANT: For all nodes n in graph G:
  - Let requiredRoles = lexicon.resolveEvent(n.ir.event.lemma).thetaFrame.required
  - Let missingRoles = requiredRoles \ keys(n.ir.args)
  - If missingRoles is non-empty:
    - n.resolution.missing MUST contain those role names
    - n.resolution.status MUST NOT be "Resolved"
    
This is the authoritative completeness check. Only validate() with Lexicon
can determine the true required roles for each event.
```

**strictMissingCheck Policy:**
| Mode | MISSING_MISMATCH | Behavior |
|------|------------------|----------|
| `strictMissingCheck: true` (default) | MUST | Returns `{ valid: false, error: "MISSING_MISMATCH" }` |
| `strictMissingCheck: false` (lenient) | MAY | Records as warning, returns `{ valid: true, warnings: [...] }` |

Lenient mode is for cases where translator may have incomplete role knowledge (e.g., heuristic/deterministic translation). The MUST in I3-L applies to the **strict (default) mode**; lenient mode relaxes this to a warning.

#### I4. Intent Statefulness

```
INVARIANT: For all nodes n in graph G:
  - n.resolution.status ∈ {"Resolved", "Ambiguous", "Abstract"}
  - n.resolution.ambiguityScore ∈ [0, 1]
```

### 8.3 Resolution Consistency Rules

| Rule | Condition | Requirement |
|------|-----------|-------------|
| **R1** | `status = "Resolved"` | `missing` MUST be empty or undefined |
| **R2** | `missing` is non-empty | `status` MUST be `"Ambiguous"` or `"Abstract"` |
| **R3** | `ambiguityScore = 0` | `status` SHOULD be `"Resolved"` |

---

## 9. Validation

### 9.1 Two-Phase Validation

Validation is split into two phases with different requirements:

| Phase | When | Requires Lexicon | Checks |
|-------|------|------------------|--------|
| **Structural** | `translate()` return | No | I1, I2-S, I3-S, I4 |
| **Lexicon-Verified** | `validate()` call | Yes | I2-L, I3-L, Feature Checking |

**Scope Clarification:**
- **I2-S (Structural):** Same symbolic ref used consistently within graph
- **I2-L (Lexicon-Verified):** `entityType` exists in Lexicon's entity registry
- **I3-S (Structural):** Internal consistency only (R1: Resolved → no missing; R2: missing → not Resolved)
- **I3-L (Lexicon-Verified):** `missing` matches Lexicon's `thetaFrame.required`, selectional restrictions satisfied

### 9.2 Structural Validation

Performed automatically by `translate()`. MUST pass before return.

```typescript
function validateStructural(graph: IntentGraph): ValidationResult {
  const nodeIds = new Set<string>();
  const entityIdToType = new Map<string, string>();  // For I2-S check
  
  for (const node of graph.nodes) {
    // Check: No duplicate node IDs
    if (nodeIds.has(node.id)) {
      return { valid: false, error: "DUPLICATE_NODE_ID", nodeId: node.id };
    }
    nodeIds.add(node.id);
    
    // Check: No self-dependency
    if (node.dependsOn.includes(node.id)) {
      return { valid: false, error: "SELF_DEPENDENCY", nodeId: node.id };
    }
    
    // Check I4: Statefulness
    if (!isValidResolutionStatus(node.resolution.status)) {
      return { valid: false, error: "INVALID_STATUS", nodeId: node.id };
    }
    if (typeof node.resolution.ambiguityScore !== "number" ||
        node.resolution.ambiguityScore < 0 ||
        node.resolution.ambiguityScore > 1) {
      return { valid: false, error: "INVALID_SCORE", nodeId: node.id };
    }
    
    // Check I3-S: R1 - Resolved implies no missing
    // Note: R2 (missing → not Resolved) is logically equivalent, so single check suffices
    if (node.resolution.status === "Resolved" && 
        node.resolution.missing && 
        node.resolution.missing.length > 0) {
      return { valid: false, error: "R1_VIOLATION", nodeId: node.id };
    }
    
    // Check: missing[] values are valid Role enum
    if (node.resolution.missing) {
      const validRoles = ["TARGET", "THEME", "SOURCE", "DEST", "INSTRUMENT", "BENEFICIARY"];
      for (const role of node.resolution.missing) {
        if (!validRoles.includes(role)) {
          return { valid: false, error: "INVALID_ROLE", nodeId: node.id, details: role };
        }
      }
    }
    
    // Check I2-S: Entity ID consistency (same id → same entityType)
    // Scope: Scans ir.args only (per Intent IR v0.1, args is the sole location for entity terms)
    // If future IR versions add entity terms elsewhere, extend this check accordingly.
    for (const term of Object.values(node.ir.args)) {
      if (term.kind === "entity" && term.ref?.kind === "id") {
        const existingType = entityIdToType.get(term.ref.id);
        if (existingType && existingType !== term.entityType) {
          return { 
            valid: false, 
            error: "ENTITY_TYPE_CONFLICT", 
            nodeId: node.id,
            details: `ID "${term.ref.id}" has conflicting types: ${existingType} vs ${term.entityType}`
          };
        }
        entityIdToType.set(term.ref.id, term.entityType);
      }
    }
  }
  
  // Check I1: Acyclicity
  if (hasCycle(graph)) {
    return { valid: false, error: "CYCLE_DETECTED" };
  }
  
  // Check: Edge integrity (all dependsOn targets exist)
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      if (!nodeIds.has(dep)) {
        return { valid: false, error: "BROKEN_EDGE", nodeId: node.id, details: dep };
      }
    }
  }
  
  // Check C-ABS-1: Non-Abstract nodes cannot depend on Abstract nodes
  const abstractNodes = new Set(
    graph.nodes.filter(n => n.resolution.status === "Abstract").map(n => n.id)
  );
  for (const node of graph.nodes) {
    if (node.resolution.status !== "Abstract") {
      for (const dep of node.dependsOn) {
        if (abstractNodes.has(dep)) {
          return { 
            valid: false, 
            error: "ABSTRACT_DEPENDENCY", 
            nodeId: node.id,
            details: `Non-Abstract node depends on Abstract node "${dep}"`
          };
        }
      }
    }
  }
  
  return { valid: true };
}
```

### 9.3 Lexicon-Verified Validation

Performed by explicit `validate()` call. Requires Lexicon.

Translator's `validate()` implements Intent IR v0.1's **Feature Checking** rules (§14), excluding actionType resolution (which is a lowering concern):

| Check | Intent IR Rule | Method |
|-------|----------------|--------|
| Lemma Exists | `resolveEvent(lemma)` returns entry | ERROR if undefined |
| Class Matches | `entry.eventClass === ir.event.class` | ERROR if mismatch |
| Required Roles | All `thetaFrame.required` in `args` | Check node.resolution.missing |
| Selectional Restrictions | `term.kind` in `restrictions[role].termKinds` | TYPE_MISMATCH if violated |
| Entity Type Valid | `entityType` in `restrictions[role].entityTypes` | TYPE_MISMATCH if violated |

> **Note:** `lexicon.resolveActionType()` is NOT used here. ActionType resolution is a lowering concern, determining whether the intent can be executed—not whether it's semantically valid.

```typescript
function validate(
  graph: IntentGraph,
  ctx: ValidateContext
): ValidationResult {
  const warnings: ValidationWarning[] = [];
  
  for (const node of graph.nodes) {
    // 1. Lemma exists
    const entry = ctx.lexicon.resolveEvent(node.ir.event.lemma);
    if (!entry) {
      return { valid: false, error: "EVENT_NOT_FOUND", nodeId: node.id };
    }
    
    // 2. Class matches (Intent IR §14.2)
    if (entry.eventClass !== node.ir.event.class) {
      return { 
        valid: false, 
        error: "CLASS_MISMATCH", 
        nodeId: node.id,
        details: `Expected ${entry.eventClass}, got ${node.ir.event.class}`
      };
    }
    
    // 3. Required roles present
    const missingRoles = findMissingRequiredRoles(node.ir, entry.thetaFrame);
    if (missingRoles.length > 0) {
      if (node.resolution.status === "Resolved") {
        return { valid: false, error: "COMPLETENESS_VIOLATION", nodeId: node.id };
      }
      
      // Check if translator's missing[] matches lexicon's required roles
      const translatorMissing = node.resolution.missing ?? [];
      if (!setsEqual(translatorMissing, missingRoles)) {  // Set comparison, order-independent
        if (ctx.strictMissingCheck !== false) {
          return { 
            valid: false, 
            error: "MISSING_MISMATCH", 
            nodeId: node.id,
            details: `Translator reported [${translatorMissing}], lexicon requires [${missingRoles}]`
          };
        }
        // Lenient mode: record warning, continue validation
        warnings.push({
          code: "MISSING_MISMATCH",
          nodeId: node.id,
          details: `Translator reported [${translatorMissing}], lexicon requires [${missingRoles}]`
        });
      }
    }
    
    // 4. Selectional restrictions (Intent IR §14.2)
    for (const [role, term] of Object.entries(node.ir.args)) {
      const restriction = entry.thetaFrame.restrictions?.[role as Role];
      if (restriction) {
        // Check term kind
        if (!restriction.termKinds.includes(term.kind)) {
          return {
            valid: false,
            error: "TYPE_MISMATCH",
            nodeId: node.id,
            details: `Role ${role}: expected term kind in [${restriction.termKinds}], got ${term.kind}`
          };
        }
        // Check entity type (if applicable)
        if (term.kind === "entity" && restriction.entityTypes) {
          if (!restriction.entityTypes.includes(term.entityType)) {
            return {
              valid: false,
              error: "TYPE_MISMATCH",
              nodeId: node.id,
              details: `Role ${role}: entity type ${term.entityType} not in allowed types`
            };
          }
        }
        // Check value type (if applicable)
        if (term.kind === "value" && restriction.valueTypes) {
          if (!restriction.valueTypes.includes(term.valueType)) {
            return {
              valid: false,
              error: "TYPE_MISMATCH",
              nodeId: node.id,
              details: `Role ${role}: value type ${term.valueType} not in allowed types`
            };
          }
        }
      }
    }
  }
  
  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}
```

// Helper: Set equality (order-independent)
function setsEqual<T>(a: T[], b: T[]): boolean {
const setA = new Set(a);
const setB = new Set(b);
return setA.size === setB.size && [...setA].every(x => setB.has(x));
}
```

> **Alignment Note:** This validation follows Intent IR v0.1 §14 "Feature Checking" exactly, with one deliberate omission: `policyHints` are surfaced as warnings but do not cause validation failure (policy decisions are consumer responsibility).

### 9.4 Invocation Options

```typescript
// Option 1: Separate calls
const graph = await translate(text);
const validation = validate(graph, { lexicon });

// Option 2: Combined call (implementation choice)
const graph = await translate(text, { validateWith: lexicon });
```

---

## 10. Public API

### 10.1 translate()

Transforms natural language into an Intent Graph.

```typescript
/**
 * Translates natural language to Intent Graph.
 * 
 * ASYNC RATIONALE:
 * - LLM calls are inherently async (network I/O)
 * - Enables timeout, cancellation, retry, streaming
 * - Even deterministic mode may need async for extensibility
 */
function translate(
  text: string,
  options?: TranslateOptions
): Promise<TranslateResult>;

type TranslateOptions = {
  /** Language hint (ISO 639-1) */
  language?: string;
  
  /** Domain context for disambiguation */
  domainHint?: string;
  
  /** Lexicon for integrated validation */
  validateWith?: Lexicon;
  
  /** Maximum nodes to generate */
  maxNodes?: number;
  
  /**
   * Translation mode (default: "llm").
   * - "llm": Uses LLM for translation (requires provider config)
   * - "deterministic": Heuristic-only, no LLM (may produce empty/minimal graph)
   */
  mode?: "llm" | "deterministic";
};

type TranslateResult = {
  /** The generated Intent Graph */
  graph: IntentGraph;
  
  /** Non-fatal warnings during translation */
  warnings: TranslateWarning[];
};

type TranslateWarning = {
  code: string;
  message: string;
  nodeId?: IntentNodeId;
};
```

**Mode Behavior:**
- `mode: "llm"` (default): Requires LLM provider. Throws `CONFIGURATION_ERROR` if not configured.
- `mode: "deterministic"`: No LLM required. Uses heuristic decomposition only. MAY return minimal/empty graph for complex inputs (this is expected, not an error).

**Guarantees:**
- Returned graph passes Structural Validation (MUST)
- If `validateWith` provided, also passes Lexicon-Verified Validation (MUST)

### 10.2 validate()

Performs Lexicon-Verified Validation on an Intent Graph.

```typescript
function validate(
  graph: IntentGraph,
  ctx: ValidateContext
): ValidationResult;

type ValidateContext = {
  /** Lexicon for feature checking (REQUIRED) */
  lexicon: Lexicon;
  
  /** 
   * If true (default), MISSING_MISMATCH is an error.
   * If false, mismatch is recorded as warning and validation continues.
   * Useful when translator may have incomplete role knowledge.
   */
  strictMissingCheck?: boolean;
};

type ValidationResult = 
  | { valid: true; warnings?: ValidationWarning[] }
  | { valid: false; error: string; nodeId?: IntentNodeId; details?: string };

type ValidationWarning = {
  code: "MISSING_MISMATCH";  // Currently only warning type
  nodeId: IntentNodeId;
  details: string;
};
```

### 10.3 emitForManifesto()

Generates Manifesto-compatible output artifacts.

```typescript
function emitForManifesto(
  graph: IntentGraph,
  ctx: EmitContext
): ManifestoBundle;

type EmitContext = {
  /** Lexicon for lowering (REQUIRED) */
  lexicon: Lexicon;
  
  /** 
   * Resolver for discourse references (REQUIRED).
   * Resolver is expected to maintain its own snapshot reference internally.
   * See §10.4 for Resolver interface and StatefulResolver example.
   */
  resolver: Resolver;
  
  /** Schema hash for intentKey calculation */
  schemaHash: string;
};
```

### 10.4 Resolver Interface

```typescript
/**
 * Resolver resolves discourse references (this/that/last) to concrete IDs.
 * Resolver MAY be stateful, maintaining execution context internally.
 * 
 * SNAPSHOT RESPONSIBILITY:
 * - Resolver owns snapshot access (not EmitContext)
 * - Resolver is constructed with initial snapshot reference
 * - Resolver.updateSnapshot() is called after each step execution
 * - This keeps snapshot management encapsulated within Resolver
 */
interface Resolver {
  /**
   * Resolves discourse references in an IntentIR.
   * 
   * @param ir - The IntentIR to resolve
   * @returns Resolved IR or deferred marker
   */
  resolveReferences(ir: IntentIR): 
    | ResolvedIntentIR 
    | { deferred: true; reason: string };
  
  /**
   * Updates snapshot after step execution (optional).
   * Called by consumer after each successful step to enable
   * cross-step reference resolution (e.g., "that project" → just-created project).
   */
  updateSnapshot?(snapshot: SnapshotLike): void;
}
```

**Stateful Resolver:**

Resolver MAY maintain internal state (e.g., snapshot, execution results) to resolve cross-step references:

```typescript
class StatefulResolver implements Resolver {
  private snapshot: SnapshotLike;
  private executionResults: Map<IntentNodeId, unknown> = new Map();
  
  constructor(initialSnapshot: SnapshotLike) {
    this.snapshot = initialSnapshot;
  }
  
  updateSnapshot(snapshot: SnapshotLike): void {
    this.snapshot = snapshot;
  }
  
  recordResult(nodeId: IntentNodeId, result: unknown): void {
    this.executionResults.set(nodeId, result);
  }
  
  resolveReferences(ir: IntentIR): ResolvedIntentIR | { deferred: true; reason: string } {
    // Use this.snapshot + this.executionResults to resolve
    // "that project" → concrete ID from just-created entity
  }
}

// Usage in execution loop:
const resolver = new StatefulResolver(initialSnapshot);
const bundle = emitForManifesto(graph, { lexicon, resolver, schemaHash });

for (const step of bundle.invocationPlan.steps) {
  // ... execute step ...
  resolver.recordResult(step.nodeId, result);
  resolver.updateSnapshot(newSnapshot);
}
```

### 10.5 Error Handling Policy

**Normative error handling behavior:**

| Function | Success | Failure |
|----------|---------|---------|
| `translate()` | Resolves to `TranslateResult` | Rejects with `TranslatorError` |
| `validate()` | Returns `{ valid: true, warnings? }` | Returns `{ valid: false, error, ... }` (no throw) |
| `emitForManifesto()` | Returns `ManifestoBundle` | Throws `TranslatorError` |

**translate() with validateWith option:**
- If Lexicon-Verified Validation fails: Rejects with `TranslatorError` (not resolves with warnings)
- Rationale: Caller explicitly requested validation; silent failure would violate expectation
- **Warnings merge policy (MAY):** If validation produces warnings (e.g., `MISSING_MISMATCH` in lenient mode), implementations MAY merge them into `TranslateResult.warnings` with a distinguishable prefix (e.g., `validation:MISSING_MISMATCH`)

**TranslatorError structure:**

```typescript
class TranslatorError extends Error {
  readonly code: TranslatorErrorCode;
  readonly nodeId?: IntentNodeId;
  readonly details?: Record<string, unknown>;
}

/**
 * SINGLE SOURCE OF TRUTH for error codes.
 * Other sections reference this enum; do not define separately.
 */
type TranslatorErrorCode =
  // === Structural Validation (translate) ===
  | "CYCLE_DETECTED"       // I1: Graph contains cycle
  | "DUPLICATE_NODE_ID"    // Node ID appears more than once
  | "SELF_DEPENDENCY"      // Node depends on itself
  | "INVALID_STATUS"       // I4: Invalid resolution.status
  | "INVALID_SCORE"        // I4: ambiguityScore out of [0,1]
  | "R1_VIOLATION"         // I3-S: Resolved but missing non-empty (covers R1 and R2)
  | "INVALID_ROLE"         // missing[] contains invalid role name
  | "BROKEN_EDGE"          // dependsOn references non-existent node
  | "ENTITY_TYPE_CONFLICT" // I2-S: Same entity ID with different entityTypes
  | "ABSTRACT_DEPENDENCY"  // C-ABS-1: Non-Abstract node depends on Abstract node
  
  // === Lexicon-Verified Validation (validate) ===
  | "EVENT_NOT_FOUND"      // Lexicon lookup failed for lemma
  | "CLASS_MISMATCH"       // IR class vs Lexicon eventClass mismatch
  | "TYPE_MISMATCH"        // Selectional restriction violated
  | "COMPLETENESS_VIOLATION" // I3-L: Required role missing on Resolved node
  | "MISSING_MISMATCH"     // I3-L: missing[] doesn't match Lexicon (strict mode)
  
  // === Emit/Lowering ===
  | "EMIT_FAILED"          // emitForManifesto internal error
  | "RESOLVER_ERROR"       // Resolver failed during lowering
  
  // === Configuration ===
  | "CONFIGURATION_ERROR"  // Required provider/config missing (e.g., LLM)
  
  // === Catch-all ===
  | "INTERNAL_ERROR";      // Unexpected error
```

**Configuration Error Policy (mode-based):**

| Mode | LLM Provider Missing | Behavior |
|------|---------------------|----------|
| `"llm"` (default) | Yes | Throws `CONFIGURATION_ERROR` |
| `"llm"` | No | Normal LLM-assisted translation |
| `"deterministic"` | N/A | Heuristic-only (may return minimal graph) |

- `mode: "llm"` + no LLM provider → MUST throw `CONFIGURATION_ERROR`
- `mode: "deterministic"` → LLM provider ignored, heuristic decomposition only
- Silent no-op (empty graph without explicit deterministic mode) is NOT ALLOWED
- Rationale: Explicit mode prevents production bugs where "no intents found" appears normal

**validate() returns result, not throws:**
- Rationale: Validation failure is an expected outcome, not an exception
- Consumer can inspect `error` and `nodeId` to decide how to proceed
- Exception: If Lexicon itself crashes (e.g., network error), MAY wrap in `TranslatorError`

---

## 11. Output Artifacts

### 11.1 ManifestoBundle

The primary output of `emitForManifesto()`.

```typescript
type ManifestoBundle = {
  /** Executable invocation plan */
  invocationPlan: InvocationPlan;
  
  /** Schema extension candidates for unsupported intents */
  melCandidates: MelCandidate[];
  
  /** Emission metadata */
  meta: {
    sourceText: string;
    translatedAt: string;
    emittedAt: string;
    graphNodeCount: number;
    resolvedCount: number;
    ambiguousCount: number;
    abstractCount: number;
    deferredCount: number;
  };
};
```

### 11.2 InvocationPlan

A sequence of executable steps derived from the Intent Graph.

```typescript
type InvocationPlan = {
  /**
   * Execution steps in topologically-sorted order.
   * MUST: steps[i] depends on steps[j] implies i > j.
   */
  steps: InvocationStep[];
  
  /**
   * Dependency edges among steps (C-EDGES-1).
   * MUST contain only edges where BOTH from and to are nodeIds in steps[].
   * 
   * Convention: from=dependency, to=dependent.
   * Edge direction: "from must complete before to" (standard topological sort semantics)
   * 
   * Example: If n2 depends on n1, edge is { from: "n1", to: "n2" }
   */
  dependencyEdges?: Array<{
    /** The dependency node (must complete first, MUST be in steps) */
    from: IntentNodeId;
    /** The dependent node (executes after from, MUST be in steps) */
    to: IntentNodeId;
  }>;
};

type InvocationStep = {
  /** Original node ID */
  nodeId: IntentNodeId;
  
  /** 
   * Original IntentIR (always included).
   * Enables re-lowering, debugging, and standalone plan serialization.
   */
  ir: IntentIR;
  
  /** Lowering result */
  lowering: LoweringResult;
  
  /** 
   * Resolution state (copied from node).
   * Note: "Abstract" is excluded because Abstract nodes are NOT included in steps.
   */
  resolution: {
    status: "Resolved" | "Ambiguous";  // Abstract excluded (see §11.5)
    ambiguityScore: number;
    missing?: Role[];
  };
};
```

### 11.3 Lowering Result States

| Status | Meaning | Consumer Action |
|--------|---------|-----------------|
| `ready` | IntentBody available | Execute immediately |
| `deferred` | Needs runtime resolution | Call `lower(step.ir, lexicon, resolver)` with updated resolver context |
| `failed` | Cannot lower to IntentBody | Check MelCandidate or error |

```typescript
type LoweringResult = 
  | { 
      status: "ready"; 
      intentBody: IntentBody;
    }
  | { 
      status: "deferred"; 
      reason: string;
      // Note: ir is at step level, not here
    }
  | { 
      status: "failed"; 
      reason: LoweringFailureReason;
    };
```

### 11.4 MelCandidate

Suggested schema extensions for intents that cannot be lowered.

```typescript
type MelCandidate = {
  /** Original node ID */
  nodeId: IntentNodeId;
  
  /** Original IntentIR (for reference) */
  ir: IntentIR;
  
  /** Suggested MEL code */
  suggestedMel: string;
  
  /** Why lowering failed */
  reason: LoweringFailureReason;
  
  /** Nodes that would become lowerable if this MEL is applied */
  wouldEnable?: IntentNodeId[];
};

type LoweringFailureReason = {
  kind: "action_not_found" | "role_mapping_failed" | "type_mismatch";
  details: string;
};
```

**MelCandidate Generation Rules:**
- Generated ONLY when `lexicon.resolveActionType()` fails
- OR when required role mapping fails
- NOT generated for `Abstract` nodes (insufficient information)

### 11.5 Step Ordering Guarantee

**Abstract Node Exclusion:**
Nodes with `resolution.status = "Abstract"` are NOT included in `steps[]`. They represent vague or high-level intents that cannot be directly executed. This is why `InvocationStep.resolution.status` is typed as `"Resolved" | "Ambiguous"` (excluding `"Abstract"`).

**C-ABS-1 (MUST): Abstract Dependency Constraint**
```
If node `a` has resolution.status = "Abstract", then no non-Abstract node
may include `a.id` in its dependsOn array.

Equivalently: Abstract nodes MUST NOT be dependencies of executable nodes.
```

This constraint ensures that when Abstract nodes are excluded from `steps[]`, no executable step loses its dependency. The allowed dependency direction is:

| From | To | Allowed | Rationale |
|------|------|---------|-----------|
| Concrete | Concrete | ✅ | Normal execution dependency |
| Abstract | Concrete | ✅ | High-level goal depends on subtasks |
| Concrete | Abstract | ❌ | Would break execution plan |
| Abstract | Abstract | ✅ | Hierarchy among abstract goals |

Violation → `TranslatorError: ABSTRACT_DEPENDENCY` (structural validation)

**C-EDGES-1 (MUST): Dependency Edges Closure**
```
If invocationPlan.dependencyEdges is present, it MUST contain only edges
where BOTH from and to are nodeIds included in invocationPlan.steps[].
```

This ensures consumers can use `dependencyEdges` directly for parallel execution planning without filtering out non-existent nodes.

> **Note:** If full graph edges are needed for debugging/visualization, use a separate field (e.g., `meta.graphEdges`), not `dependencyEdges`.

**Topological Sort Guarantee:**
```
INVARIANT: For all i, j where steps[i].nodeId depends on steps[j].nodeId:
  j < i (dependencies come before dependents in the array)
  
In other words: steps is in topological order where dependency edges are
  (dependency → dependent), i.e., (steps[j] → steps[i]) for j < i.
```

**Tie-Break Rule (RECOMMENDED):**
When multiple independent nodes could occupy the same position in topological sort, implementations SHOULD use lexicographic ordering by `nodeId` for reproducibility and audit purposes.

```typescript
// Example: n1 and n3 are independent (no dependency between them)
// Both depend on n0
// Tie-break: "n1" < "n3" lexicographically
steps = [
  { nodeId: "n0", ... },  // no dependencies
  { nodeId: "n1", ... },  // depends on n0
  { nodeId: "n3", ... },  // depends on n0, comes after n1 due to tie-break
]
```

This allows simple sequential execution:

```typescript
for (const step of plan.steps) {
  await executeStep(step);
}
```

---

## 12. Lowering Semantics

### 12.1 Lowering Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          emitForManifesto()                                 │
│                                                                             │
│   For each node in topological order:                                       │
│                                                                             │
│   1. Check resolution.status                                                │
│      ├─ "Abstract" → Skip (not in InvocationPlan)                          │
│      └─ "Resolved" | "Ambiguous" → Continue                                │
│                                                                             │
│   2. Try to resolve discourse refs                                          │
│      ├─ Success → Continue to lowering                                     │
│      └─ Needs runtime data → Mark as "deferred"                            │
│                                                                             │
│   3. Try to lower IntentIR → IntentBody                                    │
│      ├─ resolveActionType() succeeds → "ready"                             │
│      └─ resolveActionType() fails → "failed" + MelCandidate               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Deferred Lowering

When discourse references (this/that/last) cannot be resolved at emit time:

```typescript
// At emit time
const step: InvocationStep = {
  nodeId: "n2",
  ir: node.ir,  // Always at step level
  lowering: {
    status: "deferred",
    reason: "Discourse ref 'that' (Project) requires n1 execution result"
  },
  resolution: node.resolution
};

// At execution time (consumer responsibility)
async function executeStep(step: InvocationStep, resolver: Resolver, lexicon: Lexicon) {
  if (step.lowering.status === "deferred") {
    // Intent IR v0.1 §13.3: lower(ir, lexicon, resolver)
    // Resolver already has updated context from previous steps
    const intentBody = lower(step.ir, lexicon, resolver);
    await execute(intentBody);
  } else if (step.lowering.status === "ready") {
    await execute(step.lowering.intentBody);
  } else {
    throw new Error("Cannot execute failed step");
  }
}
```

### 12.3 Lowering vs Resolution Independence

| Scenario | resolution.status | lowering.status |
|----------|-------------------|-----------------|
| Clear intent, supported action | `Resolved` | `ready` |
| Clear intent, unsupported action | `Resolved` | `failed` |
| Ambiguous intent, supported action | `Ambiguous` | `ready` |
| Ambiguous intent, needs runtime ref | `Ambiguous` | `deferred` |
| Vague intent, no action mapping | `Abstract` | (not in plan) |

---

## 13. Error Handling

### 13.1 Error Types

> **Reference:** `TranslatorErrorCode` is defined in §10.5 (single source of truth).

```typescript
class TranslatorError extends Error {
  code: TranslatorErrorCode;  // See §10.5 for full enum
  nodeId?: IntentNodeId;
  details?: Record<string, unknown>;
}
```

### 13.2 Error Message Guidelines

**DO:**
- Use user-action perspective
- Reference specific nodes when applicable
- Suggest corrective actions

**DON'T:**
- Expose internal terminology ("SemanticProjection")
- Use implementation details in messages

```typescript
// ✅ Good
throw new TranslatorError(
  "Cannot generate invocation plan: missing DEST role for 'add' action",
  { code: "COMPLETENESS_VIOLATION", nodeId: "n2" }
);

// ❌ Bad
throw new SemanticProjectionError("Projection target mismatch in node n2");
```

### 13.3 Warning vs Error

| Severity | Behavior | Example |
|----------|----------|---------|
| **Warning** | Included in result, processing continues | "Ambiguous entity reference, using first match" |
| **Error** | Throws, processing stops | "Cycle detected in intent graph" |

---

## 14. Examples

### 14.1 Simple Single Intent

**Input:** `"Cancel the order"`

**Intent Graph:**
```json
{
  "nodes": [{
    "id": "n1",
    "ir": {
      "v": "0.1",
      "force": "DO",
      "event": { "lemma": "CANCEL", "class": "CONTROL" },
      "args": {
        "TARGET": { 
          "kind": "entity", 
          "entityType": "Order", 
          "ref": { "kind": "that" }
        }
      }
    },
    "dependsOn": [],
    "resolution": {
      "status": "Ambiguous",
      "ambiguityScore": 0.3,
      "questions": ["Which order would you like to cancel?"]
    }
  }],
  "meta": {
    "sourceText": "Cancel the order",
    "translatedAt": "2026-01-26T10:00:00Z"
  }
}
```

> **Note:** `missing` is empty because TARGET role IS bound (to an entity with `ref.kind="that"`). The ambiguity comes from the unresolved discourse reference, which is handled by `lowering.status="deferred"` and `questions[]`, not by `missing[]`.

**ManifestoBundle:**
```json
{
  "invocationPlan": {
    "steps": [{
      "nodeId": "n1",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "CANCEL", "class": "CONTROL" },
        "args": {
          "TARGET": { "kind": "entity", "entityType": "Order", "ref": { "kind": "that" } }
        }
      },
      "lowering": {
        "status": "deferred",
        "reason": "Discourse ref 'that' requires context to resolve to concrete order ID"
      },
      "resolution": {
        "status": "Ambiguous",
        "ambiguityScore": 0.3
      }
    }]
  },
  "melCandidates": [],
  "meta": {
    "sourceText": "Cancel the order",
    "translatedAt": "2026-01-26T10:00:00Z",
    "emittedAt": "2026-01-26T10:00:01Z",
    "graphNodeCount": 1,
    "resolvedCount": 0,
    "ambiguousCount": 1,
    "abstractCount": 0,
    "deferredCount": 1
  }
}
```

### 14.2 Complex Multi-Intent with Dependencies

**Input:** `"Create a new project and add three tasks to it"`

**Intent Graph:**
```json
{
  "nodes": [
    {
      "id": "n1",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "CREATE", "class": "CREATE" },
        "args": {
          "THEME": { "kind": "entity", "entityType": "Project" }
        }
      },
      "dependsOn": [],
      "resolution": {
        "status": "Resolved",
        "ambiguityScore": 0.1
      }
    },
    {
      "id": "n2",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "ADD", "class": "TRANSFORM" },
        "args": {
          "THEME": { 
            "kind": "value", 
            "valueType": "number", 
            "shape": { "count": 3, "entityType": "Task" },
            "raw": 3
          },
          "DEST": { 
            "kind": "entity", 
            "entityType": "Project",
            "ref": { "kind": "that" }
          }
        }
      },
      "dependsOn": ["n1"],
      "resolution": {
        "status": "Resolved",
        "ambiguityScore": 0.15
      }
    }
  ],
  "meta": {
    "sourceText": "Create a new project and add three tasks to it",
    "translatedAt": "2026-01-26T10:00:00Z"
  }
}
```

**InvocationPlan.steps (topologically sorted):**
```json
[
  {
    "nodeId": "n1",
    "ir": {
      "v": "0.1",
      "force": "DO",
      "event": { "lemma": "CREATE", "class": "CREATE" },
      "args": { "THEME": { "kind": "entity", "entityType": "Project" } }
    },
    "lowering": {
      "status": "ready",
      "intentBody": {
        "type": "project:create",
        "input": {}
      }
    },
    "resolution": { "status": "Resolved", "ambiguityScore": 0.1 }
  },
  {
    "nodeId": "n2",
    "ir": {
      "v": "0.1",
      "force": "DO",
      "event": { "lemma": "ADD", "class": "TRANSFORM" },
      "args": {
        "THEME": { "kind": "value", "valueType": "number", "shape": { "count": 3, "entityType": "Task" }, "raw": 3 },
        "DEST": { "kind": "entity", "entityType": "Project", "ref": { "kind": "that" } }
      }
    },
    "lowering": {
      "status": "deferred",
      "reason": "Discourse ref 'that' (Project) resolves to n1 execution result"
    },
    "resolution": { "status": "Resolved", "ambiguityScore": 0.15 }
  }
]
```

**Consumer Execution:**
```typescript
// Step 1: Execute n1 (ready)
const project = await execute(steps[0].lowering.intentBody);

// Step 2: Resolve and execute n2 (deferred)
// Update resolver context with n1's result
resolver.recordResult("n1", project);

// Option A: Full lowering with resolver (Intent IR v0.1 §13.3 signature)
const intentBody = lower(steps[1].ir, lexicon, resolver);

// Option B: Two-step (resolve first, then lower)
// const resolved = resolver.resolveReferences(steps[1].ir);
// const intentBody = lowerResolved(resolved, lexicon);

// intentBody = { type: "task:add", input: { projectId: project.id, count: 3 } }
await execute(intentBody);
```

> **Lowering Signature Note:** Intent IR v0.1 §13.3 defines `lower(ir, lexicon, resolver)` as the canonical signature. Implementations MAY also provide `lowerResolved(resolvedIR, lexicon)` for pre-resolved IRs, but the former is normative.

### 14.3 Unsupported Action (MelCandidate)

**Input:** `"Archive the completed tasks"`

**Intent Graph:**
```json
{
  "nodes": [{
    "id": "n1",
    "ir": {
      "v": "0.1",
      "force": "DO",
      "event": { "lemma": "ARCHIVE", "class": "CONTROL" },
      "args": {
        "TARGET": { "kind": "entity", "entityType": "Task" }
      },
      "cond": [
        { "lhs": "target.status", "op": "=", "rhs": { "kind": "value", "valueType": "enum", "shape": { "value": "completed" } } }
      ]
    },
    "dependsOn": [],
    "resolution": {
      "status": "Resolved",
      "ambiguityScore": 0.05
    }
  }]
}
```

**ManifestoBundle (when "ARCHIVE" is not in schema):**
```json
{
  "invocationPlan": {
    "steps": [{
      "nodeId": "n1",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "ARCHIVE", "class": "CONTROL" },
        "args": { "TARGET": { "kind": "entity", "entityType": "Task" } },
        "cond": [{ "lhs": "target.status", "op": "=", "rhs": { "kind": "value", "valueType": "enum", "shape": { "value": "completed" } } }]
      },
      "lowering": {
        "status": "failed",
        "reason": {
          "kind": "action_not_found",
          "details": "No action type found for lemma 'ARCHIVE'"
        }
      },
      "resolution": { "status": "Resolved", "ambiguityScore": 0.05 }
    }]
  },
  "melCandidates": [{
    "nodeId": "n1",
    "ir": {
      "v": "0.1",
      "force": "DO",
      "event": { "lemma": "ARCHIVE", "class": "CONTROL" },
      "args": { "TARGET": { "kind": "entity", "entityType": "Task" } },
      "cond": [{ "lhs": "target.status", "op": "=", "rhs": { "kind": "value", "valueType": "enum", "shape": { "value": "completed" } } }]
    },
    "suggestedMel": "action archive(target: Task[]) {\n  set target.*.status = \"archived\"\n}",
    "reason": {
      "kind": "action_not_found",
      "details": "No action type found for lemma 'ARCHIVE'"
    }
  }],
  "meta": {
    "sourceText": "Archive the completed tasks",
    "translatedAt": "2026-01-26T10:00:00Z",
    "emittedAt": "2026-01-26T10:00:01Z",
    "graphNodeCount": 1,
    "resolvedCount": 1,
    "ambiguousCount": 0,
    "abstractCount": 0,
    "deferredCount": 0
  }
}
```

---

## 15. Conformance

### 15.1 Conformance Levels

| Level | Requirements |
|-------|--------------|
| **Minimal** | `translate()` resolves to valid IntentGraph |
| **Standard** | Minimal + `validate()` + `emitForManifesto()` |
| **Full** | Standard + all extension points |

### 15.2 Minimal Conformance

An implementation is **minimally conformant** if:

1. `translate(text)` resolves to `TranslateResult` with valid `IntentGraph`
2. Returned graph satisfies all Structural Validation checks
3. Returned graph satisfies all Invariants (I1-I4)
4. Resolution consistency rules (R1-R3) are enforced
5. C-ABS-1 (Abstract dependency constraint) is enforced

### 15.3 Standard Conformance

An implementation is **standard conformant** if:

1. It is minimally conformant
2. `validate(graph, { lexicon })` correctly validates against Lexicon
3. `emitForManifesto(graph, ctx)` produces valid `ManifestoBundle`
4. Lowering semantics (§12) are correctly implemented
5. Deferred lowering is supported
6. C-EDGES-1 (dependency edges closure) is enforced in `emitForManifesto()`

### 15.4 Test Vectors

Conformant implementations MUST pass all test vectors in the companion test suite:

- `test/structural-validation.json`
- `test/abstract-dependency.json`  <!-- C-ABS-1 -->
- `test/lexicon-validation.json`
- `test/lowering.json`
- `test/deferred-lowering.json`
- `test/mel-candidate.json`

---

## 16. Extension Points

### 16.1 Reserved for Future Versions

| Extension | Description | Target Version |
|-----------|-------------|----------------|
| Streaming translation | Incremental graph construction | v0.2 |
| Confidence calibration | LLM confidence → ambiguityScore mapping | v0.2 |
| Multi-modal input | Image/audio → Intent | v0.3 |
| LLVM IR output | Low-level compilation target | v1.0 |
| Human-readable plan | Natural language execution plan | v1.0 |

### 16.2 Custom Resolver

Implementations MAY provide custom Resolver implementations:

```typescript
interface CustomResolver extends Resolver {
  /** Additional context injection */
  setContext(ctx: Record<string, unknown>): void;
  
  /** Clear execution history */
  reset(): void;
}
```

### 16.3 Decompose Strategy (Pipeline Extension)

For extreme complex inputs where single-pass translation degrades, consumers MAY compose a Decompose Layer as a pre-pass:

```
text → decompose(text) → chunks[]
     → for each chunk: translate(chunk) + validate(chunkGraph)
     → merge(chunkGraphs) → mergedGraph
     → validate(mergedGraph)
```

**Strategy Interface:**

```typescript
interface DecomposeStrategy {
  decompose(input: string, ctx?: DecomposeContext): DecomposeResult;
}

type DecomposeContext = {
  language?: string;       // hint only
  maxChunkChars?: number;  // soft budget
  maxChunks?: number;      // soft budget
};

type DecomposeResult = {
  chunks: Array<{
    id: string;
    text: string;            // MUST be contiguous substring of input
    span?: [number, number]; // offsets in original string
  }>;
  warnings?: Array<{ code: string; message: string }>;
};
```

**Normative Constraints:**
- Decompose is a pipeline concern, NOT Translator core responsibility
- `chunk.text` MUST be a contiguous substring (no paraphrasing)
- Chunks MUST preserve original order
- Merge MUST produce a valid DAG (no cycles)

**Reference Implementations:**
- `DeterministicDecompose`: Punctuation-based splitting (no LLM)
- `ShallowLLMDecompose`: LLM for boundary tagging only (not intent analysis)

> **See:** ADR-TRANSLATOR-003 for full specification.

### 16.4 Custom Lowering Targets

The `emitForManifesto()` function is Manifesto-specific. Future versions MAY add:

```typescript
function emitForTarget(graph: IntentGraph, target: EmitTarget): unknown;

type EmitTarget = "manifesto" | "llvm" | "human" | "json-patch";
```

---

## 17. Versioning

### 17.1 Version Format

Translator follows Semantic Versioning 2.0.0:

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes to public API or type definitions
MINOR: New features, backward compatible
PATCH: Bug fixes, backward compatible
```

### 17.2 Compatibility Matrix

| Translator | Intent IR | Core (type-only) |
|------------|-----------|------------------|
| 0.1.x | 0.1.x | 2.0.x |
| 0.2.x | 0.1.x - 0.2.x | 2.0.x - 2.1.x |

### 17.3 Migration Guide

When upgrading between versions, consult:
- `CHANGELOG.md` for detailed changes
- `MIGRATION.md` for step-by-step upgrade instructions

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Intent Graph** | DAG of IntentIR nodes representing complex intent |
| **IntentNode** | Single node in Intent Graph, wrapping IntentIR |
| **Resolution** | Semantic completeness assessment |
| **Lowering** | IntentIR → IntentBody transformation |
| **Deferred Lowering** | Lowering postponed to execution time |
| **MelCandidate** | Suggested schema extension for unsupported intent |
| **Discourse Reference** | Contextual reference (this/that/last/it) |

---

## Appendix B: Reference Implementation

A reference implementation is available at:

```
packages/manifesto-ai-translator/
├── src/
│   ├── translate.ts      # translate() implementation
│   ├── validate.ts       # validate() implementation
│   ├── emit.ts           # emitForManifesto() implementation
│   ├── graph/            # IntentGraph utilities
│   ├── lowering/         # Lowering logic
│   └── types/            # Type definitions
├── test/
│   └── vectors/          # Conformance test vectors
└── package.json
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.1 | 2026-01-27 | **Critical fixes:** C-ABS-1 (Abstract dependency constraint), C-EDGES-1 (dependency edges closure), `translate()` async, `mode` option, `CONFIGURATION_ERROR`, `ABSTRACT_DEPENDENCY` error code. **Improvements:** ValidationResult.warnings, setsEqual comparison, I2-S entity check, conservativeMerge C-ABS-1 compliance, strictMissingCheck policy clarification. |
| 0.1.0 | 2026-01-26 | Initial specification |
