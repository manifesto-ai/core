# @manifesto-ai/core

> Pure computation engine for domain state

---

## Overview

`@manifesto-ai/core` is the **deterministic semantic calculator** at the heart of Manifesto. It computes state transitions without performing any side effects.

**Core computes. Host executes. These concerns never mix.**

---

## Design Principles

| Principle | Description |
|-----------|-------------|
| **Determinism** | Same input always produces same output |
| **Purity** | No side effects, no IO, no time dependency |
| **Explainability** | Every value can answer "why?" |
| **Schema-first** | All semantics expressed as data |

---

## Main Exports

### createCore()

Creates a ManifestoCore instance.

```typescript
import { createCore } from "@manifesto-ai/core";

const core = createCore();
```

### ManifestoCore Interface

```typescript
interface ManifestoCore {
  /** Compute state transition (async) */
  compute(
    schema: DomainSchema,
    snapshot: Snapshot,
    intent: Intent,
    context: HostContext
  ): Promise<ComputeResult>;

  /** Compute state transition (sync) */
  computeSync(
    schema: DomainSchema,
    snapshot: Snapshot,
    intent: Intent,
    context: HostContext
  ): ComputeResult;

  /** Apply patches to snapshot */
  apply(
    schema: DomainSchema,
    snapshot: Snapshot,
    patches: readonly Patch[],
    context: HostContext
  ): Snapshot;

  /** Validate a schema */
  validate(schema: unknown): ValidationResult;

  /** Explain why a value is what it is */
  explain(
    schema: DomainSchema,
    snapshot: Snapshot,
    path: SemanticPath
  ): ExplainResult;
}
```

---

## Key Types

### ComputeResult

```typescript
interface ComputeResult {
  snapshot: Snapshot;
  patches: readonly Patch[];
  requirements: readonly Requirement[];
  trace: TraceGraph;
  status: "complete" | "pending";
}
```

### Snapshot

```typescript
interface Snapshot {
  data: Record<string, unknown>;
  computed: Record<string, unknown>;
  system: SystemState;
  input: Record<string, unknown>;
  meta: SnapshotMeta;
}
```

### Patch

```typescript
type Patch =
  | { op: "set"; path: string; value: unknown }
  | { op: "unset"; path: string }
  | { op: "merge"; path: string; value: Record<string, unknown> };
```

---

## Basic Usage

```typescript
import { createCore, createSnapshot, createIntent } from "@manifesto-ai/core";

const core = createCore();

// Create initial snapshot
const snapshot = createSnapshot({
  data: { count: 0 },
  schemaHash: "counter-v1",
});

// Compute transition
const result = core.computeSync(
  schema,
  snapshot,
  createIntent("increment", {}),
  { intentId: "int_001", timestamp: Date.now() }
);

console.log(result.snapshot.data.count); // 1
console.log(result.patches);             // [{ op: "set", path: "count", value: 1 }]
```

---

## When to Use Directly

Most applications should use `@manifesto-ai/app` instead. Use Core directly when:

- Building custom Host implementations
- Creating testing infrastructure
- Implementing specialized computation pipelines
- Building Manifesto tooling

---

## Specification

For the complete normative specification, see:

- [Specifications Hub](/internals/spec/) - Links to all package specs
- [Core SPEC v2.0.0](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/core/docs/SPEC-v2.0.0.md) - Latest package spec

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/host](./host) | Executes effects declared by Core |
| [@manifesto-ai/compiler](/mel/) | Compiles MEL to DomainSchema |
| [@manifesto-ai/app](./app) | High-level facade using Core |
