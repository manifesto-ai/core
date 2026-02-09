# @manifesto-ai/core v2.3.0

> Pure semantic calculator for deterministic state computation.

## Role

Core computes meaning. It MUST NOT perform IO, access time, execute effects, or know about Host/World.

## Dependencies

- Zero runtime dependencies (only `zod` peer)

## Public API

### `createCore(): ManifestoCore`

```typescript
interface ManifestoCore {
  compute(schema, snapshot, intent, context): Promise<ComputeResult>;
  computeSync(schema, snapshot, intent, context): ComputeResult;
  apply(schema, snapshot, patches, context): Snapshot;
  validate(schema): ValidationResult;
  explain(schema, snapshot, path): ExplainResult;
}
```

Also available as standalone functions: `compute`, `computeSync`, `apply`, `validate`, `explain`.

### Factories

```typescript
createSnapshot<T>(data: T, schemaHash: string, context: HostContext): Snapshot
createIntent(type: string, input?: unknown, intentId: string): Intent
createError(code, message, actionId, nodePath, timestamp, context?): ErrorValue
```

## Key Types

### Snapshot

```typescript
type Snapshot = {
  data: unknown;
  computed: Record<string, unknown>;   // Always recalculated
  system: {
    status: 'idle' | 'computing' | 'pending' | 'error';
    lastError: ErrorValue | null;
    errors: readonly ErrorValue[];
    pendingRequirements: readonly Requirement[];
    currentAction: string | null;
  };
  input: unknown;
  meta: { version: number; timestamp: number; randomSeed: string; schemaHash: string };
};
```

### Patch (3 ops only)

```typescript
type Patch =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'unset'; path: string }
  | { op: 'merge'; path: string; value: Record<string, unknown> };
```

### ComputeResult

```typescript
type ComputeResult = {
  snapshot: Snapshot;
  requirements: Requirement[];
  trace: TraceGraph;
  status: 'complete' | 'pending' | 'halted' | 'error';
};
```

### Requirement (Effect declaration)

```typescript
type Requirement = {
  id: string;               // Deterministic hash
  type: string;             // Effect type
  params: Record<string, unknown>;
  actionId: string;
  flowPosition: { nodePath: string; snapshotVersion: number };
  createdAt: number;
};
```

### DomainSchema

Produced by compiler from MEL source. Contains:
- `name`, `version`, `state` (StateSpec), `computed` (ComputedSpec), `actions`, `flows`, `availableWhen`
- Used as first argument to `compute()`, `apply()`, `validate()`

### Expression System

Kinds: `lit`, `get`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`, `if`, `add`, `sub`, `mul`, `div`, `mod`, `min`, `max`, `abs`, `neg`, `concat`, `substring`, `trim`, `len`, `at`, `first`, `last`, `slice`, `includes`, `filter`, `map`, `find`, `every`, `some`, `append`, `object`, `keys`, `values`, `entries`, `merge`, `typeof`, `isNull`, `coalesce`

All expressions: deterministic, pure, total (never throw).

### Flow System

Kinds: `seq`, `if`, `patch`, `effect`, `call`, `halt`, `fail`

Flows: NOT Turing-complete, always terminate in finite steps.

## Re-exports

Core re-exports schema types, utils, evaluator, errors, and factories from internal modules. Key re-exports: `DomainSchema`, `Snapshot`, `Intent`, `Patch`, `SemanticPath`, `ComputeResult`, `ValidationResult`, `ExplainResult`, `Requirement`, `TraceGraph`.

## Error Codes

`VALIDATION_ERROR`, `PATH_NOT_FOUND`, `TYPE_MISMATCH`, `DIVISION_BY_ZERO`, `INDEX_OUT_OF_BOUNDS`, `UNKNOWN_ACTION`, `ACTION_UNAVAILABLE`, `INVALID_INPUT`, `CYCLIC_DEPENDENCY`, `UNKNOWN_FLOW`, `CYCLIC_CALL`, `UNKNOWN_EFFECT`, `INTERNAL_ERROR`
