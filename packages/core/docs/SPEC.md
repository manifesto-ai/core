# Manifesto Schema Specification v1.0

> **Status:** Draft
> **Authors:** eggplantiny
> **License:** MIT

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Philosophy](#3-core-philosophy)
4. [DomainSchema](#4-domainschema)
5. [StateSpec](#5-statespec)
6. [ComputedSpec](#6-computedspec)
7. [ExprSpec](#7-exprspec)
8. [FlowSpec](#8-flowspec)
9. [ActionSpec](#9-actionspec)
10. [RequirementSpec](#10-requirementspec)
11. [ErrorSpec](#11-errorspec)
12. [TraceSpec](#12-tracespec)
13. [Snapshot](#13-snapshot)
14. [Validation Rules](#14-validation-rules)
15. [Canonical Form](#15-canonical-form)
16. [Host Interface](#16-host-interface)

---

## 1. Introduction

### 1.1 What is Manifesto?

Manifesto is a **deterministic semantic calculator** for domain state. It defines:

- **What** the domain looks like (StateSpec)
- **What** can be derived (ComputedSpec)
- **How** state transitions occur (FlowSpec)
- **Why** any value is what it is (TraceSpec)

### 1.2 What Manifesto is NOT

Manifesto is NOT:

- An execution runtime
- A UI framework
- An agent framework
- A database or persistence layer
- A workflow orchestrator

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Determinism** | Same input always produces same output |
| **Explainability** | Every value can answer "why?" |
| **Schema-first** | All semantics expressed as data |
| **Host-agnostic** | No assumptions about execution environment |

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Core Philosophy

### 3.1 The Manifesto Constitution

```
1. Core is a calculator, not an executor.
2. Schema is the single source of truth.
3. Snapshot is the only medium of communication.
4. Effects are declarations, not executions.
5. Errors are values, not exceptions.
6. Everything is explainable.
7. There is no suspended execution context.
```

### 3.2 Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                         HOST                                 │
│  - Effect execution                                         │
│  - IO / Network / Storage                                   │
│  - Loop control                                             │
│  - User interaction                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ compute(snapshot, intent, context)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         CORE                                 │
│  - Pure computation                                         │
│  - State transitions                                        │
│  - Requirement declarations                                 │
│  - Trace generation                                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 The Snapshot Principle

> **All communication happens through Snapshot. There is no other channel.**

- Effects do NOT "return" values to Flows.
- Effects produce Patches that modify Snapshot.
- The next computation reads from the modified Snapshot.
- **There is no suspended execution context.**
- **All continuity is expressed exclusively through Snapshot.**

```
WRONG:  result ← effect('api:call')    // Implies value passing
        if result.ok then ...

RIGHT:  effect('api:call')             // Declares requirement
        // Host fulfills requirement by patching snapshot
        // Next compute() reads snapshot.api.result
        if snapshot.api.result.ok then ...
```

### 3.4 Computation Model

Each `compute()` call is **complete and independent**:

```
compute(snapshot₀, intent, context) → (snapshot₁, requirements[], trace)
```

- If `requirements` is empty: computation is **complete**.
- If `requirements` is non-empty: Host MUST fulfill them, then call `compute()` **again**.
- There is no "resume". Each `compute()` is a fresh calculation.

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPUTATION CYCLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Host calls: compute(snapshot, intent, context)             │
│                     │                                       │
│                     ▼                                       │
│  ┌─────────────────────────────────────┐                   │
│  │ Core evaluates Flow until:          │                   │
│  │   - Flow completes (requirements=[])│                   │
│  │   - Effect encountered (req=[...])  │                   │
│  │   - Error occurs                    │                   │
│  └─────────────────────────────────────┘                   │
│                     │                                       │
│                     ▼                                       │
│  Returns: (snapshot', requirements, trace)                  │
│                     │                                       │
│         ┌──────────┴──────────┐                            │
│         ▼                     ▼                            │
│   requirements=[]       requirements=[r1,r2]               │
│   (DONE)                      │                            │
│                               ▼                            │
│                    Host executes effects                   │
│                    Host applies patches                    │
│                               │                            │
│                               ▼                            │
│                    Host calls compute() AGAIN              │
│                    with same intent + context              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. DomainSchema

### 4.1 Structure

```typescript
type DomainSchema = {
  /** Unique identifier for this schema */
  readonly id: string;
  
  /** Semantic version */
  readonly version: string;
  
  /** Content hash for integrity verification */
  readonly hash: string;

  /** Named type declarations (compiler v0.3.3) */
  readonly types: Record<string, TypeSpec>;

  /** State structure definition */
  readonly state: StateSpec;
  
  /** Computed values (DAG) */
  readonly computed: ComputedSpec;
  
  /** Intent-to-Flow mappings */
  readonly actions: Record<string, ActionSpec>;
  
  /** Schema metadata */
  readonly meta?: {
    readonly name?: string;
    readonly description?: string;
    readonly authors?: string[];
  };
};
```

### 4.2 Requirements

- `id` MUST be a valid URI or UUID.
- `version` MUST follow [Semantic Versioning 2.0](https://semver.org/).
- `hash` MUST be computed using the [Canonical Form](#15-canonical-form) algorithm
  over the full schema (excluding the `hash` field), including `types`.
- `state`, `computed`, and `actions` MUST NOT be empty.

### 4.3 Types (Compiler v0.3.3)

`types` carries **named type declarations** produced by the compiler.
They are **schema metadata** only; Core does not interpret them during compute/apply,
but they are part of the schema hash.

```typescript
type TypeSpec = {
  readonly name: string;
  readonly definition: TypeDefinition;
};

type TypeDefinition =
  | { kind: "primitive"; type: string }
  | { kind: "array"; element: TypeDefinition }
  | { kind: "record"; key: TypeDefinition; value: TypeDefinition }
  | { kind: "object"; fields: Record<string, { type: TypeDefinition; optional: boolean }> }
  | { kind: "union"; types: TypeDefinition[] }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string };
```

---

## 5. StateSpec

### 5.1 Purpose

StateSpec defines the **shape** of domain state. It contains only structural information, no logic.

### 5.2 Structure

```typescript
type StateSpec = {
  /** Root fields of the state */
  readonly fields: Record<string, FieldSpec>;
};

type FieldSpec = {
  /** Field type */
  readonly type: FieldType;
  
  /** Whether this field is required */
  readonly required: boolean;
  
  /** Default value (if not required) */
  readonly default?: unknown;
  
  /** Human-readable description */
  readonly description?: string;
  
  /** Nested fields (for object type) */
  readonly fields?: Record<string, FieldSpec>;
  
  /** Item spec (for array type) */
  readonly items?: FieldSpec;
};

type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array'
  | { enum: readonly unknown[] };
```

### 5.3 Example

```json
{
  "fields": {
    "todos": {
      "type": "array",
      "required": true,
      "default": [],
      "items": {
        "type": "object",
        "required": true,
        "fields": {
          "id": { "type": "string", "required": true },
          "title": { "type": "string", "required": true },
          "completed": { "type": "boolean", "required": true, "default": false },
          "syncStatus": { 
            "type": { "enum": ["synced", "pending", "error"] },
            "required": true,
            "default": "pending"
          }
        }
      }
    },
    "filter": {
      "type": { "enum": ["all", "active", "completed"] },
      "required": true,
      "default": "all"
    }
  }
}
```

### 5.4 Requirements

- StateSpec MUST NOT contain any expressions or logic.
- All `FieldSpec` with `required: false` MUST have a `default` value.
- Circular references in object fields are NOT ALLOWED.

---

## 6. ComputedSpec

### 6.1 Purpose

ComputedSpec defines **derived values** that are always computable from state. Computed values form a Directed Acyclic Graph (DAG).

### 6.2 Structure

```typescript
type ComputedSpec = {
  /** Computed field definitions */
  readonly fields: Record<SemanticPath, ComputedFieldSpec>;
};

type ComputedFieldSpec = {
  /** Paths this computed depends on */
  readonly deps: readonly SemanticPath[];
  
  /** Expression to compute the value */
  readonly expr: ExprNode;
  
  /** Human-readable description */
  readonly description?: string;
};

/** Dot-separated path (e.g., "user.profile.name", "computed.isValid") */
type SemanticPath = string;
```

### 6.3 Example

```json
{
  "fields": {
    "computed.activeCount": {
      "deps": ["todos"],
      "expr": {
        "kind": "len",
        "arg": {
          "kind": "filter",
          "array": { "kind": "get", "path": "todos" },
          "predicate": {
            "kind": "not",
            "arg": { "kind": "get", "path": "$item.completed" }
          }
        }
      }
    },
    "computed.canClearCompleted": {
      "deps": ["todos"],
      "expr": {
        "kind": "gt",
        "left": {
          "kind": "len",
          "arg": {
            "kind": "filter",
            "array": { "kind": "get", "path": "todos" },
            "predicate": { "kind": "get", "path": "$item.completed" }
          }
        },
        "right": { "kind": "lit", "value": 0 }
      }
    }
  }
}
```

### 6.4 Requirements

- The dependency graph MUST be acyclic (DAG).
- All paths in `deps` MUST exist in StateSpec or ComputedSpec.
- `deps` MUST accurately reflect all paths referenced in `expr`.
- Computed values MUST be **total** (always produce a value, never throw).

---

## 7. ExprSpec

### 7.1 Purpose

ExprSpec defines the **pure expression language** used in ComputedSpec and FlowSpec. Expressions are deterministic and side-effect free.

### 7.2 Node Types

```typescript
type ExprNode =
  // Literals
  | { kind: 'lit'; value: unknown }
  
  // Path access
  | { kind: 'get'; path: SemanticPath }
  
  // Comparison
  | { kind: 'eq'; left: ExprNode; right: ExprNode }
  | { kind: 'neq'; left: ExprNode; right: ExprNode }
  | { kind: 'gt'; left: ExprNode; right: ExprNode }
  | { kind: 'gte'; left: ExprNode; right: ExprNode }
  | { kind: 'lt'; left: ExprNode; right: ExprNode }
  | { kind: 'lte'; left: ExprNode; right: ExprNode }
  
  // Logical
  | { kind: 'and'; args: readonly ExprNode[] }
  | { kind: 'or'; args: readonly ExprNode[] }
  | { kind: 'not'; arg: ExprNode }
  
  // Conditional
  | { kind: 'if'; cond: ExprNode; then: ExprNode; else: ExprNode }
  
  // Arithmetic
  | { kind: 'add'; left: ExprNode; right: ExprNode }
  | { kind: 'sub'; left: ExprNode; right: ExprNode }
  | { kind: 'mul'; left: ExprNode; right: ExprNode }
  | { kind: 'div'; left: ExprNode; right: ExprNode }
  | { kind: 'mod'; left: ExprNode; right: ExprNode }
  | { kind: 'neg'; arg: ExprNode }
  | { kind: 'abs'; arg: ExprNode }
  | { kind: 'min'; args: readonly ExprNode[] }
  | { kind: 'max'; args: readonly ExprNode[] }
  | { kind: 'sumArray'; array: ExprNode }
  | { kind: 'minArray'; array: ExprNode }
  | { kind: 'maxArray'; array: ExprNode }
  | { kind: 'floor'; arg: ExprNode }
  | { kind: 'ceil'; arg: ExprNode }
  | { kind: 'round'; arg: ExprNode }
  | { kind: 'sqrt'; arg: ExprNode }
  | { kind: 'pow'; base: ExprNode; exponent: ExprNode }
  
  // String
  | { kind: 'concat'; args: readonly ExprNode[] }
  | { kind: 'substring'; str: ExprNode; start: ExprNode; end?: ExprNode }
  | { kind: 'trim'; str: ExprNode }
  | { kind: 'toLowerCase'; str: ExprNode }
  | { kind: 'toUpperCase'; str: ExprNode }
  | { kind: 'strLen'; str: ExprNode }
  
  // Collection
  | { kind: 'len'; arg: ExprNode }
  | { kind: 'at'; array: ExprNode; index: ExprNode }
  | { kind: 'first'; array: ExprNode }
  | { kind: 'last'; array: ExprNode }
  | { kind: 'slice'; array: ExprNode; start: ExprNode; end?: ExprNode }
  | { kind: 'includes'; array: ExprNode; item: ExprNode }
  | { kind: 'filter'; array: ExprNode; predicate: ExprNode }
  | { kind: 'map'; array: ExprNode; mapper: ExprNode }
  | { kind: 'find'; array: ExprNode; predicate: ExprNode }
  | { kind: 'every'; array: ExprNode; predicate: ExprNode }
  | { kind: 'some'; array: ExprNode; predicate: ExprNode }
  | { kind: 'append'; array: ExprNode; items: readonly ExprNode[] }
  
  // Object
  | { kind: 'object'; fields: Record<string, ExprNode> }
  | { kind: 'keys'; obj: ExprNode }
  | { kind: 'values'; obj: ExprNode }
  | { kind: 'entries'; obj: ExprNode }
  | { kind: 'merge'; objects: readonly ExprNode[] }
  
  // Type
  | { kind: 'typeof'; arg: ExprNode }
  | { kind: 'isNull'; arg: ExprNode }
  | { kind: 'coalesce'; args: readonly ExprNode[] }
  
  // Conversion
  | { kind: 'toString'; arg: ExprNode };
```

### 7.3 Special Variables

Within collection operations (`filter`, `map`, `find`, `every`, `some`):

| Variable | Description |
|----------|-------------|
| `$item` | Current item being processed |
| `$index` | Current index (0-based) |
| `$array` | The entire array being processed |

### 7.4 Example

```json
{
  "kind": "filter",
  "array": { "kind": "get", "path": "todos" },
  "predicate": {
    "kind": "and",
    "args": [
      { "kind": "not", "arg": { "kind": "get", "path": "$item.completed" } },
      { "kind": "gt", 
        "left": { "kind": "len", "arg": { "kind": "get", "path": "$item.title" } },
        "right": { "kind": "lit", "value": 0 }
      }
    ]
  }
}
```

### 7.5 Requirements

- Expressions MUST be **pure** (no side effects).
- Expressions MUST be **total** (always return a value).
- Division by zero MUST return `null`, not throw.
- Out-of-bounds array access MUST return `null`, not throw.
- `null` in boolean context MUST be treated as `false`.

---

## 8. FlowSpec

### 8.1 Purpose

FlowSpec defines **state transition programs**. A Flow is a declarative description of how state changes in response to an intent.

### 8.2 Design Principles

```
1. Flows do NOT execute; they describe.
2. Flows do NOT return values; they modify Snapshot.
3. Flows are NOT Turing-complete; they always terminate.
4. Flows are data, not code.
5. There is no suspended Flow context.
```

### 8.3 Node Types

```typescript
type FlowNode =
  // Sequencing
  | { kind: 'seq'; steps: readonly FlowNode[] }
  
  // Conditional
  | { kind: 'if'; cond: ExprNode; then: FlowNode; else?: FlowNode }
  
  // State mutation
  | { kind: 'patch'; op: 'set' | 'unset' | 'merge'; path: SemanticPath; value?: ExprNode }
  
  // Requirement declaration
  | { kind: 'effect'; type: string; params: Record<string, ExprNode> }
  
  // Flow composition
  | { kind: 'call'; flow: string }
  
  // Termination
  | { kind: 'halt'; reason?: string }
  
  // Error
  | { kind: 'fail'; code: string; message?: ExprNode };
```

### 8.4 Semantics

#### 8.4.1 `seq`

Executes steps in order. Each step sees the Snapshot as modified by previous steps.

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "patch", "op": "set", "path": "a", "value": { "kind": "lit", "value": 1 } },
    { "kind": "patch", "op": "set", "path": "b", "value": { "kind": "get", "path": "a" } }
  ]
}
// Result: a = 1, b = 1
```

#### 8.4.2 `if`

Evaluates condition against current Snapshot. Executes `then` or `else` branch.

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "user.isAdmin" },
  "then": { "kind": "patch", "op": "set", "path": "access", "value": { "kind": "lit", "value": "full" } },
  "else": { "kind": "patch", "op": "set", "path": "access", "value": { "kind": "lit", "value": "limited" } }
}
```

#### 8.4.3 `patch`

Declares a state change. Three operations:

| Operation | Description |
|-----------|-------------|
| `set` | Set value at path |
| `unset` | Remove value at path |
| `merge` | Shallow merge object at path |

```json
{ "kind": "patch", "op": "set", "path": "user.name", "value": { "kind": "get", "path": "input.name" } }
{ "kind": "patch", "op": "unset", "path": "user.tempData" }
{ "kind": "patch", "op": "merge", "path": "user", "value": { "kind": "get", "path": "input.updates" } }
```

#### 8.4.4 `effect`

Declares that an external operation is required.

**Critical:** Effects are NOT executed by Core. They are **declarations recorded in Snapshot**.

When Core encounters an `effect` node:

1. Core **records a Requirement** in `snapshot.system.pendingRequirements`.
2. Core **terminates the current computation**.
3. Core returns with `status: 'pending'`.

**There is no suspended execution context.**

The Host is responsible for:

1. Executing the effect (IO, network, etc.)
2. Applying result Patches to Snapshot
3. Calling `compute()` **again** with the new Snapshot

**All continuity is expressed exclusively through Snapshot.**

```json
{
  "kind": "effect",
  "type": "api:createTodo",
  "params": {
    "localId": { "kind": "get", "path": "input.localId" },
    "title": { "kind": "get", "path": "input.title" }
  }
}
```

#### 8.4.5 `call`

Invokes another Flow by name. Enables composition.

```json
{
  "kind": "call",
  "flow": "shared.validateInput"
}
```

**Important:** `call` does NOT pass arguments or return values.

- The called Flow reads from the same Snapshot.
- The called Flow writes to the same Snapshot.
- There is no parameter passing mechanism.

If you need to pass context to a called Flow, write it to Snapshot first:

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "patch", "op": "set", "path": "system.callContext", "value": { "kind": "get", "path": "input" } },
    { "kind": "call", "flow": "shared.processWithContext" }
  ]
}
```

#### 8.4.6 `halt`

Stops Flow execution normally. Not an error.

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "alreadyProcessed" },
  "then": { "kind": "halt", "reason": "Already processed, skipping" }
}
```

#### 8.4.7 `fail`

Stops Flow execution with an error. The error is recorded in Snapshot.

```json
{
  "kind": "if",
  "cond": { "kind": "not", "arg": { "kind": "get", "path": "computed.isValid" } },
  "then": { 
    "kind": "fail", 
    "code": "VALIDATION_ERROR",
    "message": { "kind": "lit", "value": "Input validation failed" }
  }
}
```

### 8.5 Example: Complete Flow

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "if",
      "cond": { "kind": "lte", 
        "left": { "kind": "len", "arg": { "kind": "get", "path": "input.title" } },
        "right": { "kind": "lit", "value": 0 }
      },
      "then": { "kind": "fail", "code": "EMPTY_TITLE" }
    },
    {
      "kind": "patch",
      "op": "set",
      "path": "todos",
      "value": {
        "kind": "concat",
        "args": [
          { "kind": "get", "path": "todos" },
          [{
            "id": { "kind": "get", "path": "input.localId" },
            "title": { "kind": "get", "path": "input.title" },
            "completed": false,
            "syncStatus": "pending"
          }]
        ]
      }
    },
    {
      "kind": "effect",
      "type": "api:createTodo",
      "params": {
        "localId": { "kind": "get", "path": "input.localId" },
        "title": { "kind": "get", "path": "input.title" }
      }
    }
  ]
}
```

### 8.6 Requirements

- Flows MUST NOT contain unbounded loops (`while`, `for`, recursion).
- All Flow execution MUST terminate in finite steps.
- `call` references MUST NOT form cycles.
- `effect` MUST terminate computation (no continuation in same compute cycle).

---

## 9. ActionSpec

### 9.1 Purpose

ActionSpec maps **intents** to **flows**. An action defines what happens when a particular intent is dispatched.

### 9.2 Structure

```typescript
type ActionSpec = {
  /** The flow to execute */
  readonly flow: FlowNode;
  
  /** Input schema (for validation) */
  readonly input?: FieldSpec;
  
  /** Availability condition (when can this action be dispatched?) */
  readonly available?: ExprNode;
  
  /** Human-readable description */
  readonly description?: string;
};
```

### 9.3 Example

```json
{
  "addTodo": {
    "description": "Add a new todo item",
    "input": {
      "type": "object",
      "required": true,
      "fields": {
        "title": { "type": "string", "required": true },
        "localId": { "type": "string", "required": true }
      }
    },
    "available": {
      "kind": "and",
      "args": [
        { "kind": "get", "path": "computed.canAddTodo" },
        { "kind": "not", "arg": { "kind": "get", "path": "isLoading" } }
      ]
    },
    "flow": { "kind": "seq", "steps": ["..."] }
  },
  
  "clearCompleted": {
    "description": "Remove all completed todos",
    "available": { "kind": "get", "path": "computed.canClearCompleted" },
    "flow": { "kind": "seq", "steps": ["..."] }
  }
}
```

### 9.4 Requirements

- Each action MUST have a unique name within the schema.
- If `available` is defined, Core MUST check it before executing the flow.
- If `input` is defined, Core MUST validate input against the schema.

---

## 10. RequirementSpec

### 10.1 Purpose

RequirementSpec defines **what Core needs from Host** to continue computation. Requirements are generated when a Flow encounters an `effect` node.

### 10.2 Structure

```typescript
type Requirement = {
  /** Unique identifier for this requirement */
  readonly id: string;
  
  /** Effect type that generated this requirement */
  readonly type: string;
  
  /** Resolved parameters */
  readonly params: Record<string, unknown>;
  
  /** The action that was being computed */
  readonly actionId: string;
  
  /** Position in the flow where effect was encountered */
  readonly flowPosition: FlowPosition;
  
  /** Timestamp when requirement was created */
  readonly createdAt: number;
};

type FlowPosition = {
  /** Path to the effect node in the flow */
  readonly nodePath: string;
  
  /** Snapshot version at time of effect */
  readonly snapshotVersion: number;
};
```

### 10.3 How Requirements Work

```
┌─────────────────────────────────────────────────────────────┐
│                   REQUIREMENT LIFECYCLE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Host calls compute(snapshot, intent, context)           │
│                                                             │
│  2. Core evaluates Flow                                     │
│     - Applies patches to snapshot                           │
│     - Encounters effect node                                │
│     - Records Requirement in snapshot.system                │
│     - Terminates computation                                │
│                                                             │
│  3. Core returns:                                           │
│     {                                                       │
│       snapshot: snapshot',    // With pendingRequirements   │
│       status: 'pending',                                    │
│       trace: ...                                            │
│     }                                                       │
│                                                             │
│  4. Host reads pendingRequirements from snapshot            │
│                                                             │
│  5. Host executes effect (IO, network, etc.)                │
│                                                             │
│  6. Host applies result patches to snapshot:                │
│     snapshot'' = apply(snapshot', resultPatches, context)   │
│                                                             │
│  7. Host calls compute(snapshot'', intent, context) AGAIN   │
│     - This is a NEW computation, not a resume               │
│     - Flow will check snapshot state and proceed            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.4 Effect Handler Contract

Effect handlers (implemented by Host) MUST:

1. Accept `(type: string, params: Record<string, unknown>, context: EffectContext)`.
2. Return `Patch[]` (success case) or `Patch[]` with error info (failure case).
3. **Never throw.** Errors are expressed as Patches.

```typescript
// Host-side effect handler
type EffectContext = {
  snapshot: Readonly<Snapshot>;
  requirement: Requirement;
};

type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;

// Example handler
const handlers: Record<string, EffectHandler> = {
  'api:createTodo': async (type, params, context) => {
    const { snapshot } = context;
    try {
      const result = await api.createTodo(params.title);
      return [
        { op: 'set', path: `todos.${params.localId}.serverId`, value: result.id },
        { op: 'set', path: `todos.${params.localId}.syncStatus`, value: 'synced' },
      ];
    } catch (error) {
      return [
        { op: 'set', path: `todos.${params.localId}.syncStatus`, value: 'error' },
        { op: 'set', path: `todos.${params.localId}.errorMessage`, value: error.message },
      ];
    }
  },
};
```

---

## 11. ErrorSpec

### 11.1 Purpose

Errors in Manifesto are **values, not exceptions**. When something fails, the failure is recorded in Snapshot.

### 11.2 Structure

```typescript
type ErrorValue = {
  /** Error code */
  readonly code: string;
  
  /** Human-readable message */
  readonly message: string;
  
  /** Where the error occurred */
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
  
  /** When the error occurred */
  readonly timestamp: number;
  
  /** Additional context */
  readonly context?: Record<string, unknown>;
};
```

### 11.3 Error Recording

When a `fail` node is executed:

```typescript
// Core automatically patches:
{ op: 'set', path: 'system.lastError', value: errorValue }
{ op: 'set', path: 'system.errors', value: [...existing, errorValue] }
{ op: 'set', path: 'system.status', value: 'error' }
```

### 11.4 Error Handling Pattern

Since there is no exception mechanism, errors are handled by checking Snapshot:

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "effect", "type": "api:riskyOperation", "params": {} }
  ]
}
```

After Host fulfills the effect and calls `compute()` again:

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "system.lastError" },
  "then": {
    "kind": "seq",
    "steps": [
      { "kind": "patch", "op": "set", "path": "ui.showErrorModal", "value": { "kind": "lit", "value": true } },
      { "kind": "patch", "op": "set", "path": "system.lastError", "value": { "kind": "lit", "value": null } }
    ]
  },
  "else": {
    "kind": "patch", "op": "set", "path": "ui.showSuccess", "value": { "kind": "lit", "value": true }
  }
}
```

---

## 12. TraceSpec

### 12.1 Purpose

TraceSpec enables **explainability**. Every computation produces a trace that explains how the result was derived.

### 12.2 Structure

```typescript
type TraceNode = {
  /** Unique identifier for this trace node */
  readonly id: string;
  
  /** Type of trace node */
  readonly kind: TraceNodeKind;
  
  /** Path in the schema that produced this trace */
  readonly sourcePath: string;
  
  /** Input values at this point */
  readonly inputs: Record<string, unknown>;
  
  /** Output value produced */
  readonly output: unknown;
  
  /** Child trace nodes */
  readonly children: readonly TraceNode[];
  
  /** Timestamp */
  readonly timestamp: number;
};

type TraceNodeKind =
  | 'expr'        // Expression evaluation
  | 'computed'    // Computed field evaluation
  | 'flow'        // Flow execution
  | 'patch'       // State mutation
  | 'effect'      // Effect declaration
  | 'branch'      // Conditional branch taken
  | 'call'        // Flow call
  | 'halt'        // Normal termination
  | 'error';      // Error occurred
```

### 12.3 Trace Graph

```typescript
type TraceGraph = {
  /** Root trace node */
  readonly root: TraceNode;
  
  /** All nodes indexed by ID */
  readonly nodes: Record<string, TraceNode>;
  
  /** The intent that triggered this computation */
  readonly intent: { type: string; input: unknown };
  
  /** Snapshot version at start */
  readonly baseVersion: number;
  
  /** Snapshot version at end */
  readonly resultVersion: number;
  
  /** Total computation time (ms) */
  readonly duration: number;
  
  /** Termination reason */
  readonly terminatedBy: 'complete' | 'effect' | 'halt' | 'error';
};
```

---

## 13. Snapshot

### 13.1 Purpose

Snapshot is the **immutable, point-in-time representation** of world state. It is the **only medium of communication** between computations.

### 13.2 Structure

```typescript
type Snapshot<TData = unknown> = {
  /** Domain data (matches StateSpec) */
  readonly data: TData;
  
  /** Computed values (matches ComputedSpec) */
  readonly computed: Record<SemanticPath, unknown>;
  
  /** System state */
  readonly system: SystemState;
  
  /** Input for current action (if any) */
  readonly input: unknown;
  
  /** Snapshot metadata */
  readonly meta: SnapshotMeta;
};

type SystemState = {
  /** Current status */
  readonly status: 'idle' | 'computing' | 'pending' | 'error';
  
  /** Last error (null if none) */
  readonly lastError: ErrorValue | null;
  
  /** Error history */
  readonly errors: readonly ErrorValue[];
  
  /** Pending requirements waiting for Host */
  readonly pendingRequirements: readonly Requirement[];
  
  /** Current action being processed (if any) */
  readonly currentAction: string | null;
};

type SnapshotMeta = {
  /** Monotonically increasing version */
  readonly version: number;
  
  /** Timestamp of last modification */
  readonly timestamp: number;

  /** Deterministic random seed from Host context */
  readonly randomSeed: string;
  
  /** Hash of the schema this snapshot conforms to */
  readonly schemaHash: string;
};
```

### 13.3 Requirements

- Snapshots MUST be immutable.
- `version` MUST be incremented on every change.
- `computed` MUST be consistent with `data` (no stale values).
- All communication between Host and Core happens through Snapshot.

---

## 14. Validation Rules

### 14.1 Schema Validation

| Rule ID | Description |
|---------|-------------|
| V-001 | All paths in ComputedSpec.deps MUST exist |
| V-002 | ComputedSpec dependency graph MUST be acyclic |
| V-003 | All paths in ExprNode.get MUST exist |
| V-004 | All `call` references in FlowSpec MUST exist |
| V-005 | FlowSpec `call` graph MUST be acyclic |
| V-006 | ActionSpec.available expression MUST return boolean |
| V-007 | ActionSpec.input MUST be valid FieldSpec |
| V-008 | Schema hash MUST match canonical hash |

### 14.2 Runtime Validation

| Rule ID | Description |
|---------|-------------|
| R-001 | Intent input MUST match ActionSpec.input |
| R-002 | ActionSpec.available MUST evaluate to true |
| R-003 | Patch paths MUST exist in StateSpec |
| R-004 | Patch values MUST match field types |

---

## 15. Canonical Form

### 15.1 Purpose

Canonical form enables **content-addressable storage** and **deterministic hashing**.

### 15.2 Algorithm

1. **Sort** all object keys alphabetically (recursive).
2. **Remove** all keys with `undefined` value.
3. **Preserve** keys with `null` value.
4. **Serialize** using JSON with no whitespace.
5. **Encode** as UTF-8.
6. **Hash** using SHA-256.

### 15.3 Example

```typescript
// Input
{
  "b": 2,
  "a": 1,
  "c": undefined,
  "d": null,
  "e": { "y": 2, "x": 1 }
}

// Canonical Form
{"a":1,"b":2,"d":null,"e":{"x":1,"y":2}}

// Hash
sha256(canonical) = "..."
```

### 15.4 Benefits

- **Deduplication**: Same content → same hash
- **Integrity**: Detect tampering
- **Caching**: Memoize computation results
- **Versioning**: Track schema evolution
- **Comparison**: Diff between schemas

### 15.5 Browser Compatibility

The hashing implementation MUST be browser-compatible.

**Requirements:**

- Implementations MUST NOT use Node.js-specific crypto APIs (e.g., `crypto.createHash`).
- Implementations SHOULD use Web Crypto API (`crypto.subtle.digest`) when available.
- Implementations MAY use a pure JavaScript SHA-256 fallback for synchronous operations.

**Reference Implementation:**

`@manifesto-ai/core` provides two browser-compatible hash utilities:

| Function | Async | Description |
|----------|-------|-------------|
| `sha256(data)` | Yes | Uses Web Crypto API (`crypto.subtle.digest`) |
| `sha256Sync(data)` | No | Pure JavaScript implementation for synchronous contexts |

**Rationale:**

Core and its dependent packages (Host, Compiler, App) must work in browsers for client-side React applications. Using Node.js `crypto` would cause runtime errors in browser environments. See [FDR-014](#fdr-014-browser-compatibility) for the design decision.

---

## 16. Host Interface

### 16.1 Purpose

The Host interface defines how external systems interact with Core.

### 16.2 Core API

```typescript
interface ManifestoCore {
  /**
   * Compute the result of dispatching an intent.
   * 
   * This is the ONLY entry point for computation.
   * Each call is independent - there is no suspended context.
   */
  compute(
    schema: DomainSchema,
    snapshot: Snapshot,
    intent: Intent,
    context: HostContext
  ): Promise<ComputeResult>;
  
  /**
   * Apply patches to a snapshot.
   * Returns new snapshot with recomputed values.
   */
  apply(
    schema: DomainSchema,
    snapshot: Snapshot,
    patches: readonly Patch[],
    context: HostContext
  ): Snapshot;
  
  /**
   * Validate a schema.
   */
  validate(schema: DomainSchema): ValidationResult;
  
  /**
   * Explain why a value is what it is.
   */
  explain(
    schema: DomainSchema,
    snapshot: Snapshot,
    path: SemanticPath
  ): ExplainResult;
}

type Intent = {
  readonly type: string;
  readonly input?: unknown;
  readonly intentId: string;
};

type HostContext = {
  /** Logical time provided by Host */
  readonly now: number;

  /** Deterministic random seed provided by Host */
  readonly randomSeed: string;

  /** Optional host environment metadata */
  readonly env?: Record<string, unknown>;

  /** Optional measured compute duration (ms) */
  readonly durationMs?: number;
};

type ComputeResult = {
  /** New snapshot after computation */
  readonly snapshot: Snapshot;

  /** Pending requirements (effects) declared by the flow */
  readonly requirements: readonly Requirement[];
  
  /** Computation trace */
  readonly trace: TraceGraph;
  
  /** Computation status */
  readonly status: ComputeStatus;
};

type ComputeStatus =
  | 'complete'    // Flow finished, no pending requirements
  | 'pending'     // Flow encountered effect, waiting for Host
  | 'halted'      // Flow explicitly halted
  | 'error';      // Flow encountered error
```

### 16.3 Host Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Effect Execution** | Execute effects recorded in pendingRequirements |
| **Patch Application** | Apply result patches via `core.apply()` |
| **Loop Control** | Call `compute()` again after fulfilling requirements |
| **Persistence** | Store/retrieve snapshots |
| **User Interaction** | Render UI, capture user input |
| **Error Policy** | Decide how to handle errors |

### 16.4 Host Loop Pattern

```typescript
async function processIntent(
  core: ManifestoCore,
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: HostContext
): Promise<Snapshot> {
  let current = snapshot;
  
  while (true) {
    // Compute
    const result = await core.compute(schema, current, intent, context);
    current = result.snapshot;
    
    // Check status
    switch (result.status) {
      case 'complete':
      case 'halted':
        return current;
        
      case 'error':
        // Policy decision: retry, abort, or handle
        console.error('Computation error:', current.system.lastError);
        return current;
        
      case 'pending':
        // Fulfill requirements
        for (const req of result.requirements) {
          const patches = await executeEffect(req, current, context);
          current = core.apply(schema, current, patches, context);
        }
        // Clear pending requirements
        current = core.apply(schema, current, [
          { op: 'set', path: 'system.pendingRequirements', value: [] }
        ], context);
        // Loop continues - compute() will be called again
        break;
    }
  }
}

async function executeEffect(
  requirement: Requirement,
  snapshot: Snapshot,
  context: HostContext
): Promise<Patch[]> {
  const handler = effectHandlers[requirement.type];
  if (!handler) {
    return [
      { op: 'set', path: 'system.lastError', value: {
        code: 'UNKNOWN_EFFECT',
        message: `No handler for effect type: ${requirement.type}`,
        source: { actionId: snapshot.system.currentAction, nodePath: '' },
        timestamp: context.now
      }}
    ];
  }
  return handler(requirement.type, requirement.params, {
    snapshot,
    requirement,
  });
}
```

### 16.5 Important: No Resume API

There is intentionally **no `resume()` API**.

When computation yields due to an effect:

1. Host reads `snapshot.system.pendingRequirements`.
2. Host executes effects and collects result patches.
3. Host applies patches via `core.apply()`.
4. Host calls `core.compute()` **again** with the new snapshot.

The Flow will naturally proceed because:

- The effect's purpose was to change Snapshot.
- The changed Snapshot now reflects the effect's result.
- The Flow checks Snapshot state to decide what to do next.

**All continuity is expressed exclusively through Snapshot.**

---

## Appendix A: Complete Example

### Todo Application Schema

```json
{
  "id": "urn:manifesto:example:todo-app",
  "version": "1.0.0",
  "hash": "sha256:...",
  
  "state": {
    "fields": {
      "todos": {
        "type": "array",
        "required": true,
        "default": [],
        "items": {
          "type": "object",
          "required": true,
          "fields": {
            "id": { "type": "string", "required": true },
            "title": { "type": "string", "required": true },
            "completed": { "type": "boolean", "required": true, "default": false },
            "syncStatus": {
              "type": { "enum": ["synced", "pending", "error"] },
              "required": true,
              "default": "pending"
            },
            "serverId": { "type": "string", "required": false },
            "errorMessage": { "type": "string", "required": false }
          }
        }
      },
      "filter": {
        "type": { "enum": ["all", "active", "completed"] },
        "required": true,
        "default": "all"
      }
    }
  },
  
  "computed": {
    "fields": {
      "computed.activeCount": {
        "deps": ["todos"],
        "expr": {
          "kind": "len",
          "arg": {
            "kind": "filter",
            "array": { "kind": "get", "path": "todos" },
            "predicate": { "kind": "not", "arg": { "kind": "get", "path": "$item.completed" } }
          }
        }
      },
      "computed.completedCount": {
        "deps": ["todos"],
        "expr": {
          "kind": "len",
          "arg": {
            "kind": "filter",
            "array": { "kind": "get", "path": "todos" },
            "predicate": { "kind": "get", "path": "$item.completed" }
          }
        }
      },
      "computed.canClearCompleted": {
        "deps": ["computed.completedCount"],
        "expr": {
          "kind": "gt",
          "left": { "kind": "get", "path": "computed.completedCount" },
          "right": { "kind": "lit", "value": 0 }
        }
      }
    }
  },
  
  "actions": {
    "addTodo": {
      "description": "Add a new todo item",
      "input": {
        "type": "object",
        "required": true,
        "fields": {
          "localId": { "type": "string", "required": true },
          "title": { "type": "string", "required": true }
        }
      },
      "flow": {
        "kind": "seq",
        "steps": [
          {
            "kind": "if",
            "cond": {
              "kind": "lte",
              "left": { "kind": "len", "arg": { "kind": "get", "path": "input.title" } },
              "right": { "kind": "lit", "value": 0 }
            },
            "then": { "kind": "fail", "code": "EMPTY_TITLE" }
          },
          {
            "kind": "patch",
            "op": "set",
            "path": "todos",
            "value": {
              "kind": "concat",
              "args": [
                { "kind": "get", "path": "todos" },
                [
                  {
                    "kind": "merge",
                    "objects": [
                      { "kind": "lit", "value": { "completed": false, "syncStatus": "pending" } },
                      {
                        "kind": "lit",
                        "value": {
                          "id": { "kind": "get", "path": "input.localId" },
                          "title": { "kind": "get", "path": "input.title" }
                        }
                      }
                    ]
                  }
                ]
              ]
            }
          },
          {
            "kind": "effect",
            "type": "api:createTodo",
            "params": {
              "localId": { "kind": "get", "path": "input.localId" },
              "title": { "kind": "get", "path": "input.title" }
            }
          }
        ]
      }
    },
    
    "clearCompleted": {
      "description": "Remove all completed todos",
      "available": { "kind": "get", "path": "computed.canClearCompleted" },
      "flow": {
        "kind": "seq",
        "steps": [
          {
            "kind": "patch",
            "op": "set",
            "path": "todos",
            "value": {
              "kind": "filter",
              "array": { "kind": "get", "path": "todos" },
              "predicate": { "kind": "not", "arg": { "kind": "get", "path": "$item.completed" } }
            }
          },
          {
            "kind": "effect",
            "type": "api:batchDelete",
            "params": {
              "ids": {
                "kind": "map",
                "array": {
                  "kind": "filter",
                  "array": { "kind": "get", "path": "todos" },
                  "predicate": { "kind": "get", "path": "$item.completed" }
                },
                "mapper": { "kind": "get", "path": "$item.serverId" }
              }
            }
          }
        ]
      }
    }
  },
  
  "meta": {
    "name": "Todo Application",
    "description": "A simple todo application demonstrating Manifesto patterns",
    "authors": ["Manifesto Contributors"]
  }
}
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Core** | The pure computation engine that evaluates Flows |
| **Host** | The external system that executes effects and controls the loop |
| **Snapshot** | Immutable point-in-time state; the only communication medium |
| **Intent** | A request to perform an action |
| **Flow** | A declarative state transition program |
| **Effect** | A declaration that external work is needed |
| **Requirement** | A recorded effect waiting for Host fulfillment |
| **Patch** | A single state modification operation |
| **Trace** | Explanation of how a result was computed |

---

## Appendix C: Design Rationale

### Why no `resume()`?

The absence of a `resume()` API is intentional and reflects a core design principle:

1. **Simplicity**: No need to track suspended execution contexts.
2. **Serialization**: Snapshot is the complete state; nothing else to persist.
3. **Determinism**: Same snapshot + same intent = same result.
4. **Debugging**: Easy to reproduce any computation by replaying snapshot + intent.

### Why no value passing between effects?

Traditional patterns:
```typescript
const result = await api.call();  // Value returned
if (result.ok) { ... }            // Value used
```

Manifesto pattern:
```typescript
effect('api:call', params);       // Declaration only
// Host patches: snapshot.api.result = { ok: true, ... }
// Next compute reads: snapshot.api.result.ok
```

Benefits:
1. **Traceability**: All intermediate values are in Snapshot.
2. **Replayability**: No hidden state in closures or continuations.
3. **Debuggability**: Snapshot is the complete picture at any point.

### Why Flows are not Turing-complete?

1. **Guaranteed termination**: All Flows finish in finite steps.
2. **Static analysis**: Can verify properties without execution.
3. **Explainability**: Trace is always finite and complete.

For unbounded iteration, Host controls the loop by repeatedly calling `compute()`.

---

*End of Specification*
