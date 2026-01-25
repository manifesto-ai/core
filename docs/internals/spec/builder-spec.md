# @manifesto-ai/builder Specification v1.0

> **Status:** Release Candidate
> **Scope:** Normative
> **Applies to:** All `@manifesto-ai/builder` implementations
> **License:** MIT

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Design Goals](#2-design-goals)
3. [Public Exports](#3-public-exports)
4. [Core Types](#4-core-types)
5. [defineDomain](#5-definedomain)
6. [StateAccessor](#6-stateaccessor)
7. [ComputedBuilder](#7-computedbuilder)
8. [ActionsBuilder](#8-actionsbuilder)
9. [FlowBuilder](#9-flowbuilder)
10. [ExprBuilder](#10-exprbuilder)
11. [setupDomain / validateDomain](#11-setupdomain--validatedomain)
12. [Diagnostics](#12-diagnostics)
13. [Canonical Example](#13-canonical-example)
14. [Extension Points](#14-extension-points)
15. [Explicit Non-Goals](#15-explicit-non-goals)
16. [Package Boundary](#16-package-boundary)

---

## 1. Purpose

`@manifesto-ai/builder` is the **DX layer** for Manifesto.

Builder provides a type-safe DSL for **defining semantic spaces**. Each schema you create establishes the dimensions (state fields), constraints (types), and navigation rules (actions) of your domain's semantic space.

It provides:

- `defineDomain` to author `DomainSchema` with **Zod-first typing**
- `expr` builder with **no string-path authoring**
- `flow` builder with **re-entry safe patterns**
- `setup` utilities to **validate + canonicalize + hash** schemas

**Builder MUST NOT execute** computation or effects.
It only **produces Schema**.

---

## 2. Design Goals

### 2.1 DX Goals (MUST)

| Goal | Description |
|------|-------------|
| **No String Paths** | Users MUST NOT write semantic paths as raw strings in normal usage |
| **IDE Autocomplete** | All state field access MUST support autocomplete via Zod type inference |
| **Compile-time Safety** | Type mismatch MUST fail at compile time where possible |
| **JSON-serializable** | Generated output MUST be JSON-serializable |
| **Validated Output** | Generated schemas MUST be validated before emission |

### 2.2 Explainability Goal (MUST)

- Computed values MUST be named facts (e.g., `computed.canReceive`)
- Action availability SHOULD reference ComputedRef for meaningful explain paths
- Raw expressions in availability are allowed but discouraged

### 2.3 Re-entry Safety Goal (MUST)

- Flow definitions MUST be re-entry safe per Host Contract
- Builder MUST provide helpers to make re-entry safety easy

---

## 3. Public Exports

`@manifesto-ai/builder` MUST export:

### 3.1 Domain Authoring

```typescript
export { defineDomain } from './domain';
export { setupDomain, validateDomain } from './setup';
```

### 3.2 DSL Surfaces

```typescript
export { expr } from './expr';
export { flow } from './flow';
```

### 3.3 Typed References

```typescript
export type { FieldRef, ComputedRef, ActionRef, FlowRef } from './refs';
```

### 3.4 Type Utilities

```typescript
export type { DomainModule, DomainSchema, DomainDiagnostics } from './types';
```

---

## 4. Core Types

### 4.1 FieldRef

Typed pointer to a state field. Replaces string paths.

```typescript
type FieldRef<T> = {
  readonly __kind: 'FieldRef';
  readonly path: string;          // internal semantic path
  readonly _type?: T;             // phantom type (never used at runtime)
};
```

**Rules:**
- `FieldRef.path` MUST map to a valid StateSpec path
- End-user APIs MUST accept `FieldRef` instead of raw string paths
- Users SHOULD NOT access `.path` directly

### 4.2 ComputedRef

Typed pointer to a computed value.

```typescript
type ComputedRef<T> = {
  readonly __kind: 'ComputedRef';
  readonly path: `computed.${string}`;
  readonly _type?: T;
};
```

**Rules:**
- ComputedRef MUST be usable anywhere FieldRef is accepted
- When used in expressions, compiles to `['get', 'computed.<name>']`

### 4.3 ActionRef

Reference to a defined action with intent helper.

```typescript
type ActionRef<TInput = void> = {
  readonly __kind: 'ActionRef';
  readonly type: string;                    // action identifier
  readonly label?: string;
  readonly inputSchema?: z.ZodTypeAny;
  readonly available: ExpressionIR;         // compiled availability
  readonly flow: FlowIR;                    // compiled flow

  /**
   * Produce IntentBody for this action.
   * Does NOT produce IntentInstance (no intentId/intentKey/origin).
   */
  intent(input?: TInput): IntentBody;
};

type IntentBody = {
  readonly type: string;
  readonly input?: unknown;
  readonly scopeProposal?: IntentScope;
};
```

**Rules:**
- `intent()` MUST return IntentBody only
- IntentInstance creation (intentId, intentKey, origin) belongs to Bridge/Issuer

### 4.4 FlowRef

Reference to a reusable flow definition.

```typescript
type FlowRef = {
  readonly __kind: 'FlowRef';
  readonly name: string;
  readonly flow: FlowIR;
};
```

---

## 5. defineDomain

### 5.1 Signature

```typescript
function defineDomain
  TSchema extends z.ZodTypeAny,
  TOut extends DomainOutput
>(
  schema: TSchema,
  builder: (ctx: DomainContext<z.infer<TSchema>>) => TOut,
  options?: DomainOptions
): DomainModule<z.infer<TSchema>, TOut>;
```

### 5.2 DomainOptions

```typescript
type DomainOptions = {
  readonly id?: string;           // domain identifier; auto-generated if omitted
  readonly version?: string;      // semver; defaults to "0.0.0-dev"
  readonly meta?: Record<string, unknown>;
};
```

### 5.3 DomainOutput

```typescript
type DomainOutput = {
  readonly computed?: Record<string, ComputedRef<any>>;
  readonly actions?: Record<string, ActionRef<any>>;
  readonly flows?: Record<string, FlowRef>;
};
```

### 5.4 DomainContext

```typescript
type DomainContext<TState> = {
  readonly state: StateAccessor<TState>;
  readonly computed: ComputedBuilder;
  readonly actions: ActionsBuilder;
  readonly flow: FlowBuilder;
  readonly expr: ExprBuilder;
};
```

### 5.5 DomainModule

```typescript
type DomainModule<TState, TOut extends DomainOutput> = {
  readonly schema: DomainSchema;
  readonly state: StateAccessor<TState>;
  readonly computed: TOut['computed'] extends Record<string, any> 
    ? TOut['computed'] 
    : {};
  readonly actions: TOut['actions'] extends Record<string, any> 
    ? TOut['actions'] 
    : {};
  readonly diagnostics: DomainDiagnostics;
};
```

---

## 6. StateAccessor

### 6.1 Type Definition

```typescript
type StateAccessor<T> = {
  readonly [K in keyof T]:
    T[K] extends (infer U)[]
      ? ArrayFieldRef<U>
      : T[K] extends Record<string, infer V>
        ? RecordFieldRef<V>
        : T[K] extends object
          ? StateAccessor<T[K]>
          : FieldRef<T[K]>;
};

type ArrayFieldRef<T> = FieldRef<T[]> & {
  readonly __arrayItem: T;  // phantom for future array helpers
};

type RecordFieldRef<T> = FieldRef<Record<string, T>> & {
  readonly __recordValue: T;
};
```

### 6.2 Usage Rules

- Property access MUST be type-safe and IDE-autocompletable
- Nested access (`state.user.profile.name`) MUST work
- Users MUST NOT provide string paths in normal usage

### 6.3 Array Modeling Guidance

For v1.0, Builder RECOMMENDS **record-by-id** modeling for mutable collections:

```typescript
// ❌ Discouraged: Array with index access
const schema = z.object({
  items: z.array(z.object({ id: z.string(), done: z.boolean() }))
});
// Problem: patch(state.items[0].done) requires index paths

// ✅ Recommended: Record by ID
const schema = z.object({
  items: z.record(z.string(), z.object({ done: z.boolean() }))
});
// patch(state.items).merge({ [itemId]: { done: true } })
```

---

## 7. ComputedBuilder

### 7.1 Purpose

Define computed values as **named facts** for:
- Meaningful explain paths (`computed.canReceive` vs raw expression)
- Reusability across availability and flows
- Automatic dependency extraction

### 7.2 API

```typescript
type ComputedBuilder = {
  define<T extends Record<string, Expr<any>>>(
    definitions: T
  ): { [K in keyof T]: ComputedRef<ExprResultType<T[K]>> };
};
```

### 7.3 Example

```typescript
const { isClosed, canReceive } = computed.define({
  isClosed: expr.eq(state.status, 'closed'),
  canReceive: expr.and(
    expr.not(isClosed),  // reference another computed
    expr.isNull(state.receivedAt)
  ),
});
```

### 7.4 Rules

- Returned `ComputedRef` compiles to `['get', 'computed.<name>']` when used
- Builder MUST auto-extract dependencies from expression IR
- Circular dependencies MUST be detected and reported

---

## 8. ActionsBuilder

### 8.1 API

```typescript
type ActionsBuilder = {
  define<T extends Record<string, ActionSpec<any>>>(
    definitions: T
  ): { [K in keyof T]: ActionRef<ActionInputType<T[K]>> };
};

type ActionSpec<TInput = void> = {
  readonly label?: string;
  readonly input?: z.ZodType<TInput>;
  readonly available?: Expr<boolean> | ComputedRef<boolean>;
  readonly scopeProposal?: IntentScope;
  readonly flow: FlowNode;
};
```

### 8.2 Availability Rules

- `available` SHOULD reference `ComputedRef<boolean>` for explainability
- Raw `Expr<boolean>` is allowed but discouraged
- If omitted, defaults to `expr.lit(true)` (always available)

### 8.3 ActionRef.intent()

```typescript
// Usage
const body = actions.receive.intent({ requesterId: 'user-123' });
// Returns: { type: 'receive', input: { requesterId: 'user-123' } }

// IntentInstance creation is Bridge responsibility:
// bridge.dispatch(body) → Issuer adds intentId, intentKey, origin
```

---

## 9. FlowBuilder

### 9.1 Purpose

Build FlowSpec-compliant IR with:
- Type-safe patch operations
- Re-entry safety helpers
- Flow composition

### 9.2 Core API

```typescript
type FlowBuilder = {
  // Sequencing
  seq(...steps: FlowNode[]): FlowNode;

  // Conditional
  when(
    condition: Expr<boolean> | ComputedRef<boolean>,
    then: FlowNode,
    otherwise?: FlowNode
  ): FlowNode;

  // Patch operations
  patch<T>(ref: FieldRef<T>): PatchOps<T>;

  // Effects
  effect(
    type: string,
    params: Record<string, ExprLike<any>>
  ): FlowNode;

  // Terminal
  halt(reason?: string): FlowNode;
  fail(code: string, message?: string): FlowNode;

  // Composition
  call(ref: FlowRef): FlowNode;

  // Re-entry safety helpers
  guard(
    condition: Expr<boolean> | ComputedRef<boolean>,
    body: FlowNode | ((ctx: FlowStepContext) => void)
  ): FlowNode;

  onceNull<T>(
    ref: FieldRef<T | null | undefined>,
    body: FlowNode | ((ctx: FlowStepContext) => void)
  ): FlowNode;
};
```

### 9.3 PatchOps

```typescript
type PatchOps<T> = {
  set(value: ExprLike<T>): FlowNode;
  unset(): FlowNode;
  merge(value: ExprLike<Partial<T>>): FlowNode;  // object types only
};

type ExprLike<T> = Expr<T> | T | FieldRef<T> | ComputedRef<T>;
```

### 9.4 FlowStepContext

For callback-style flow building:

```typescript
type FlowStepContext = {
  patch<T>(ref: FieldRef<T>): PatchOps<T>;
  effect(type: string, params: Record<string, ExprLike<any>>): void;
  when(
    condition: Expr<boolean> | ComputedRef<boolean>,
    then: () => void,
    otherwise?: () => void
  ): void;
};
```

### 9.5 Re-entry Safety Helpers (MUST)

#### 9.5.1 guard(condition, body)

Executes body **only if condition is true**. Most general form.

```typescript
flow.guard(expr.not(state.submitted), ({ patch, effect }) => {
  patch(state.submitted).set(true);
  effect('api.submit', { data: state.formData });
});

// Compiles to:
// { kind: 'when', condition: ['not', ['get', 'submitted']], then: [...], otherwise: null }
```

#### 9.5.2 onceNull(field, body)

Executes body **only if field is null/undefined**. Common pattern shorthand.

```typescript
flow.onceNull(state.receivedAt, ({ patch, effect }) => {
  patch(state.receivedAt).set(state.currentTime);  // set via input
  effect('api.receive', { id: state.id });
});

// Compiles to:
// { kind: 'when', condition: ['isNull', ['get', 'receivedAt']], then: [...] }
```

#### 9.5.3 Why These Exist

Host Contract re-invokes flow from the beginning on each compute cycle. Without guards:

```typescript
// ❌ Dangerous: runs every cycle
flow.seq(
  flow.patch(state.status).set('received'),
  flow.effect('api.receive', { id: state.id })  // called multiple times!
)

// ✅ Safe: only runs once (when condition met)
flow.onceNull(state.receivedAt, ...)
```

---

## 10. ExprBuilder

### 10.1 Core API

```typescript
type ExprBuilder = {
  // Literals
  lit<T>(value: T): Expr<T>;

  // Comparison
  eq<T>(a: ExprLike<T>, b: ExprLike<T>): Expr<boolean>;
  neq<T>(a: ExprLike<T>, b: ExprLike<T>): Expr<boolean>;
  gt(a: ExprLike<number>, b: ExprLike<number>): Expr<boolean>;
  gte(a: ExprLike<number>, b: ExprLike<number>): Expr<boolean>;
  lt(a: ExprLike<number>, b: ExprLike<number>): Expr<boolean>;
  lte(a: ExprLike<number>, b: ExprLike<number>): Expr<boolean>;

  // Logical
  and(...conditions: ExprLike<boolean>[]): Expr<boolean>;
  or(...conditions: ExprLike<boolean>[]): Expr<boolean>;
  not(condition: ExprLike<boolean>): Expr<boolean>;

  // Null handling
  isNull(value: ExprLike<any>): Expr<boolean>;
  isNotNull(value: ExprLike<any>): Expr<boolean>;
  coalesce<T>(...values: ExprLike<T | null | undefined>[]): Expr<T | null>;

  // String/Array
  len(value: ExprLike<string | unknown[]>): Expr<number>;

  // Type checking
  typeOf(value: ExprLike<any>): Expr<string>;
};
```

### 10.2 Expr Type

```typescript
// Phantom-typed expression IR
type Expr<T = unknown> = {
  readonly __expr: true;
  readonly _type?: T;
  readonly ir: ExpressionIR;  // internal; not accessed by users
};
```

### 10.3 Dependency Extraction

Builder MUST extract semantic path dependencies from expressions:

```typescript
const canReceive = expr.and(
  expr.not(isClosed),           // depends on computed.isClosed
  expr.isNull(state.receivedAt) // depends on receivedAt
);

// Extracted deps: ['computed.isClosed', 'receivedAt']
```

---

## 11. setupDomain / validateDomain

### 11.1 validateDomain

Validates a domain definition and returns diagnostics.

```typescript
function validateDomain(module: DomainModule<any, any>): DomainDiagnostics;
```

**Validation Rules (MUST):**

| Check | Description |
|-------|-------------|
| Path Existence | All FieldRef paths exist in schema |
| Computed Deps | All computed dependencies exist |
| Computed DAG | No circular computed dependencies |
| Flow DAG | No circular flow.call() references |
| Availability Type | action.available must be boolean expression |
| Patch Paths | All patch targets exist in schema |

### 11.2 setupDomain

Validates, canonicalizes, and hashes the schema.

```typescript
function setupDomain(module: DomainModule<any, any>): {
  readonly schema: DomainSchema;
  readonly schemaHash: string;
  readonly diagnostics: DomainDiagnostics;
};
```

**Rules:**
- MUST run all validations
- MUST compute deterministic schemaHash (per Schema Spec)
- MUST throw in production mode if diagnostics.valid === false

---

## 12. Diagnostics

```typescript
type DomainDiagnostics = {
  readonly valid: boolean;
  readonly errors: DiagnosticItem[];
  readonly warnings: DiagnosticItem[];
  readonly schemaHash?: string;  // present only if valid
};

type DiagnosticItem = {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly path?: string;
  readonly suggestion?: string;
};

type DiagnosticCode =
  | 'INVALID_PATH'
  | 'MISSING_DEPENDENCY'
  | 'CIRCULAR_COMPUTED'
  | 'CIRCULAR_FLOW'
  | 'TYPE_MISMATCH'
  | 'INVALID_AVAILABILITY'
  | 'UNREACHABLE_CODE';
```

**Rules:**
- Builder MUST NOT silently emit invalid schemas
- In development: return diagnostics, log warnings
- In production: throw on errors

---

## 13. Canonical Example

This example is the **normative DX target** for "FE가 욕 안 하는" design.

```typescript
import { defineDomain } from '@manifesto-ai/builder';
import { z } from 'zod';

// 1. Define state schema with Zod
const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['pending', 'received', 'completed', 'cancelled', 'closed']),
  receivedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  cancelledAt: z.number().nullable(),
});

// 2. Define domain with type-safe builders
const EventDomain = defineDomain(EventSchema, ({ state, computed, actions, flow, expr }) => {
  
  // 3. Computed: named facts for explainability
  const { isClosed, isReceived, canReceive, canComplete, canCancel } = computed.define({
    isClosed: expr.eq(state.status, 'closed'),
    isReceived: expr.isNotNull(state.receivedAt),
    canReceive: expr.and(
      expr.not(isClosed),
      expr.not(isReceived)
    ),
    canComplete: expr.and(
      expr.not(isClosed),
      isReceived,
      expr.isNull(state.completedAt)
    ),
    canCancel: expr.and(
      expr.not(isClosed),
      expr.isNull(state.completedAt),
      expr.isNull(state.cancelledAt)
    ),
  });

  // 4. Actions: intent + flow with re-entry safety
  const { receive, complete, cancel } = actions.define({
    receive: {
      label: '접수',
      input: z.object({ 
        requesterId: z.string(),
        timestamp: z.number(),
      }),
      available: canReceive,
      flow: flow.onceNull(state.receivedAt, ({ patch, effect }) => {
        patch(state.status).set('received');
        patch(state.receivedAt).set(expr.input('timestamp'));
        effect('api.receive', { 
          eventId: state.id,
          requesterId: expr.input('requesterId'),
        });
      }),
    },

    complete: {
      label: '완료',
      input: z.object({ timestamp: z.number() }),
      available: canComplete,
      flow: flow.onceNull(state.completedAt, ({ patch, effect }) => {
        patch(state.status).set('completed');
        patch(state.completedAt).set(expr.input('timestamp'));
        effect('api.complete', { eventId: state.id });
      }),
    },

    cancel: {
      label: '취소',
      input: z.object({ 
        reason: z.string(),
        timestamp: z.number(),
      }),
      available: canCancel,
      flow: flow.guard(canCancel, ({ patch, effect }) => {
        patch(state.status).set('cancelled');
        patch(state.cancelledAt).set(expr.input('timestamp'));
        effect('api.cancel', { 
          eventId: state.id,
          reason: expr.input('reason'),
        });
      }),
    },
  });

  // 5. Return exports
  return {
    computed: { isClosed, isReceived, canReceive, canComplete, canCancel },
    actions: { receive, complete, cancel },
  };
});

// 6. Usage
const { schema, actions, diagnostics } = EventDomain;

// Create intent body (for Bridge to issue)
const intentBody = actions.receive.intent({ 
  requesterId: 'user-123',
  timestamp: Date.now(),
});
// → { type: 'receive', input: { requesterId: 'user-123', timestamp: 1704067200000 } }
```

**Key Points Illustrated:**

| Aspect | How It's Achieved |
|--------|-------------------|
| No string paths | `state.status`, `state.receivedAt` |
| IDE autocomplete | Zod inference → StateAccessor |
| Named facts | `computed.define({ canReceive: ... })` |
| Explainable availability | `available: canReceive` (not raw expr) |
| Re-entry safety | `flow.onceNull`, `flow.guard` |
| Input handling | `expr.input('timestamp')` for action input |
| IntentBody only | `actions.receive.intent(...)` returns body |

---

## 14. Extension Points

### 14.1 Typed Effect Registry (v1.1)

```typescript
// Future: type-safe effect definitions
const effects = defineEffects({
  'api.receive': z.object({ eventId: z.string(), requesterId: z.string() }),
  'api.complete': z.object({ eventId: z.string() }),
});

// Usage with type checking
effect(effects['api.receive'], { eventId: state.id, requesterId: expr.input('requesterId') });
```

### 14.2 Array Helpers (v1.1)

```typescript
// Future: array expression helpers
expr.includes(state.tags, 'urgent');
expr.some(state.items, item => expr.eq(item.status, 'done'));
expr.every(state.items, item => expr.isNotNull(item.completedAt));
expr.find(state.items, item => expr.eq(item.id, expr.input('itemId')));
expr.filter(state.items, item => expr.not(item.archived));
```

### 14.3 Async Flow Patterns (v1.1)

```typescript
// Future: async effect handling patterns
flow.await(
  flow.effect('api.fetch', { id: state.id }),
  (result) => flow.patch(state.data).set(result)
);
```

---

## 15. Explicit Non-Goals

`@manifesto-ai/builder` v1.0 does **NOT**:

| Non-Goal | Reason |
|----------|--------|
| Run compute/apply | That's Core |
| Execute effects | That's Host |
| Issue IntentInstance | That's Bridge/Issuer |
| Implement Authority/World | That's World Protocol |
| Provide UI hooks | That's Bridge (React/Vue/etc) |
| Array index paths | Use record-by-id pattern |
| Complex array expressions | v1.1 extension |
| Typed effect registry | v1.1 extension |

---

## 16. Package Boundary

### 16.1 Dependency Direction

```
@manifesto-ai/builder
        │
        ▼ (types only)
@manifesto-ai/core
```

### 16.2 What Builder Imports from Core

- `DomainSchema` type
- `ExpressionIR` type
- `FlowIR` type
- `IntentBody` type
- Validation utilities (optional)

### 16.3 What Builder MUST NOT Import

- `compute()`, `apply()` functions
- Host loop
- Effect handlers
- World Protocol types

### 16.4 Package Overview

```
@manifesto-ai/core      — IR types + compute/apply (pure, DX-agnostic)
@manifesto-ai/builder   — DX layer (this spec)
@manifesto-ai/host      — Execution loop
@manifesto-ai/bridge    — Projection + Issuer + Framework hooks
@manifesto-ai/react     — React bindings (useManifesto)
@manifesto-ai/vue       — Vue bindings
@manifesto-ai/world     — World Protocol implementation
```

---

## Appendix A: expr.input()

### A.1 Purpose

Access action input within flow definitions.

```typescript
type ExprBuilder = {
  // ... other methods
  
  /**
   * Reference action input field.
   * Only valid within action flow context.
   */
  input<T>(field: string): Expr<T>;
};
```

### A.2 Usage

```typescript
actions.define({
  receive: {
    input: z.object({ requesterId: z.string(), timestamp: z.number() }),
    flow: flow.seq(
      flow.patch(state.receivedAt).set(expr.input('timestamp')),
      flow.effect('api.receive', { requesterId: expr.input('requesterId') }),
    ),
  },
});
```

### A.3 Compilation

```typescript
expr.input('timestamp')
// Compiles to: ['get', 'input.timestamp']
```

---

## Appendix B: Quick Reference

### B.1 Import Pattern

```typescript
import { defineDomain, setupDomain } from '@manifesto-ai/builder';
import { z } from 'zod';
```

### B.2 Definition Pattern

```typescript
const MyDomain = defineDomain(MySchema, ({ state, computed, actions, flow, expr }) => {
  const computeds = computed.define({ ... });
  const acts = actions.define({ ... });
  return { computed: computeds, actions: acts };
});
```

### B.3 Flow Patterns

```typescript
// Guard: general condition
flow.guard(condition, body)

// OnceNull: null check shorthand
flow.onceNull(field, body)

// Sequence
flow.seq(step1, step2, step3)

// Conditional
flow.when(condition, thenFlow, elseFlow)

// Patch
flow.patch(field).set(value)
flow.patch(field).unset()
flow.patch(field).merge(partialValue)

// Effect
flow.effect('type', { param: value })

// Terminal
flow.halt('reason')
flow.fail('CODE', 'message')
```

### B.4 Expression Patterns

```typescript
// Comparison
expr.eq(a, b), expr.neq(a, b)
expr.gt(a, b), expr.gte(a, b), expr.lt(a, b), expr.lte(a, b)

// Logical
expr.and(...), expr.or(...), expr.not(x)

// Null
expr.isNull(x), expr.isNotNull(x), expr.coalesce(a, b, c)

// Utility
expr.len(str), expr.lit(value), expr.input('field')
```

---

*End of @manifesto-ai/builder Specification v1.0*
