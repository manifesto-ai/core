# @manifesto-ai/core

> Pure semantic calculator for deterministic state computation.

## Role

Core computes meaning. It must not perform IO, access wall-clock time, execute effects, or know about Host or World policy.

## Public API

### `createCore(): ManifestoCore`

```typescript
interface ManifestoCore {
  compute(schema, snapshot, intent, context): Promise<ComputeResult>;
  computeSync(schema, snapshot, intent, context): ComputeResult;
  apply(schema, snapshot, patches, context): Snapshot;
  applySystemDelta(snapshot, delta): Snapshot;
  validate(schema): ValidationResult;
  explain(schema, snapshot, path): ExplainResult;
  isActionAvailable(schema, snapshot, actionName): boolean;
  getAvailableActions(schema, snapshot): readonly string[];
}
```

Also exported as standalone functions:

- `compute`
- `computeSync`
- `apply`
- `applySystemDelta`
- `validate`
- `explain`

## Key Types

### Snapshot

```typescript
type Snapshot = {
  data: unknown;
  computed: Record<string, unknown>;
  system: {
    status: "idle" | "computing" | "pending" | "error";
    lastError: ErrorValue | null;
    pendingRequirements: Requirement[];
    currentAction: string | null;
  };
  input: unknown;
  meta: {
    version: number;
    timestamp: number;
    randomSeed: string;
    schemaHash: string;
  };
};
```

### Patch

```typescript
type Patch =
  | { op: "set"; path: PatchPath; value: unknown }
  | { op: "unset"; path: PatchPath }
  | { op: "merge"; path: PatchPath; value: Record<string, unknown> };
```

### ComputeResult

```typescript
type ComputeResult = {
  patches: Patch[];
  systemDelta: SystemDelta;
  trace: TraceGraph;
  status: "complete" | "pending" | "halted" | "error";
};
```

### SystemDelta

```typescript
type SystemDelta = {
  status?: SystemState["status"];
  currentAction?: string | null;
  lastError?: ErrorValue | null;
  addRequirements?: readonly Requirement[];
  removeRequirementIds?: readonly string[];
};
```

## Common factories and helpers

- `createSnapshot`
- `createIntent`
- `createCore`
- `isActionAvailable`
- `getAvailableActions`
- schema and evaluator re-exports

## Notes

- Core owns semantic meaning and validation.
- Host owns execution.
- World owns governance and proposal flow around execution.
- Current Core v4 keeps `lastError` as the sole current error surface.
