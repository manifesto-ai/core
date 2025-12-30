# Core Guide

> **Purpose:** Practical guide for using @manifesto-ai/core
> **Prerequisites:** Basic understanding of Manifesto concepts
> **Time to complete:** ~15 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/core
```

### Minimal Setup

```typescript
import { createCore, createSnapshot, createIntent } from "@manifesto-ai/core";
import type { DomainSchema } from "@manifesto-ai/core";

// 1. Create core instance
const core = createCore();

// 2. Define a minimal schema
const schema: DomainSchema = {
  version: "1.0.0",
  state: {
    count: { type: "number", default: 0 },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "/data/count",
        value: { kind: "add", left: { kind: "get", path: "/data/count" }, right: 1 },
      },
    },
  },
};

// 3. Create initial snapshot
const snapshot = createSnapshot(schema);

// 4. Verify
console.log(snapshot.data.count);
// → 0
```

---

## Basic Usage

### Use Case 1: Computing a State Transition

**Goal:** Dispatch an intent and get the resulting patches.

```typescript
import { createCore, createSnapshot, createIntent } from "@manifesto-ai/core";

const core = createCore();

// Create initial snapshot
const snapshot = createSnapshot(schema);
console.log(snapshot.data.count); // → 0

// Create intent
const intent = createIntent("increment");

// Compute result
const result = await core.compute(schema, snapshot, intent);

// Check result
console.log(result.status);           // → "completed"
console.log(result.patches.length);   // → 1
console.log(result.snapshot.data.count); // → 1
```

### Use Case 2: Applying Patches Manually

**Goal:** Apply patches to a snapshot without full compute.

```typescript
import { createCore, createSnapshot } from "@manifesto-ai/core";
import type { Patch } from "@manifesto-ai/core";

const core = createCore();
const snapshot = createSnapshot(schema);

// Define patches
const patches: Patch[] = [
  { op: "set", path: "/data/count", value: 10 },
  { op: "set", path: "/data/name", value: "Alice" },
];

// Apply patches
const newSnapshot = core.apply(schema, snapshot, patches);

console.log(newSnapshot.data.count); // → 10
console.log(newSnapshot.data.name);  // → "Alice"
```

### Use Case 3: Handling Effects

**Goal:** Understand how effects are declared (not executed).

```typescript
const schemaWithEffect: DomainSchema = {
  version: "1.0.0",
  state: {
    user: { type: "object", default: null },
  },
  actions: {
    fetchUser: {
      input: { type: "object", properties: { id: { type: "string" } } },
      flow: {
        kind: "effect",
        type: "api.fetch",
        params: {
          url: { kind: "concat", args: ["/api/users/", { kind: "get", path: "/input/id" }] },
        },
      },
    },
  },
};

const result = await core.compute(schemaWithEffect, snapshot, {
  type: "fetchUser",
  input: { id: "123" },
  intentId: "i_1",
});

// Effect is recorded as a requirement, not executed
console.log(result.status); // → "pending"
console.log(result.requirements.length); // → 1
console.log(result.requirements[0].effect.type); // → "api.fetch"
```

---

## Common Patterns

### Pattern 1: Conditional Patches

**When to use:** Apply different patches based on state conditions.

```typescript
const flow = {
  kind: "if",
  condition: { kind: "gt", left: { kind: "get", path: "/data/count" }, right: 10 },
  then: { kind: "patch", op: "set", path: "/data/status", value: "high" },
  else: { kind: "patch", op: "set", path: "/data/status", value: "low" },
};
```

### Pattern 2: Sequential Operations

**When to use:** Execute multiple steps in order.

```typescript
const flow = {
  kind: "seq",
  steps: [
    { kind: "patch", op: "set", path: "/data/loading", value: true },
    { kind: "effect", type: "api.fetch", params: { url: "/data" } },
  ],
};
```

### Pattern 3: Early Termination

**When to use:** Stop flow execution based on conditions.

```typescript
const flow = {
  kind: "seq",
  steps: [
    // Halt if already processed
    {
      kind: "if",
      condition: { kind: "get", path: "/data/processed" },
      then: { kind: "halt" },
    },
    // Continue with processing
    { kind: "patch", op: "set", path: "/data/processed", value: true },
  ],
};
```

---

## Advanced Usage

### Explaining Values

**Prerequisites:** Understanding of computed values.

```typescript
const schema: DomainSchema = {
  version: "1.0.0",
  state: {
    items: { type: "array", default: [] },
  },
  computed: {
    total: {
      deps: ["/data/items"],
      expr: { kind: "length", arg: { kind: "get", path: "/data/items" } },
    },
  },
};

const snapshot = createSnapshot(schema);
const explanation = core.explain(schema, snapshot, "/computed/total");

console.log(explanation);
// → { value: 0, deps: ["/data/items"], trace: [...] }
```

### Validating Schemas

```typescript
const result = core.validate(schema);

if (!result.valid) {
  console.error("Schema errors:", result.errors);
}
```

---

## Common Mistakes

### Mistake 1: Expecting Effects to Execute

**What people do:**

```typescript
// Wrong: Expecting the API call to happen
const result = await core.compute(schema, snapshot, intent);
console.log(result.snapshot.data.user); // → undefined (effect not executed!)
```

**Why it's wrong:** Core only declares effects as requirements. It never executes them.

**Correct approach:**

```typescript
// Right: Check for requirements and use Host to execute
const result = await core.compute(schema, snapshot, intent);

if (result.requirements.length > 0) {
  // Use Host to execute effects
  // Host will call core.apply() with resulting patches
}
```

### Mistake 2: Mutating Snapshots

**What people do:**

```typescript
// Wrong: Direct mutation
snapshot.data.count = 5;
```

**Why it's wrong:** Snapshots are immutable. Direct mutation breaks determinism.

**Correct approach:**

```typescript
// Right: Use patches
const newSnapshot = core.apply(schema, snapshot, [
  { op: "set", path: "/data/count", value: 5 },
]);
```

### Mistake 3: Using Async in Expressions

**What people do:**

```typescript
// Wrong: Async expression
const expr = {
  kind: "custom",
  fn: async () => await fetchData(), // NO!
};
```

**Why it's wrong:** Expressions must be pure and synchronous. Async operations are effects.

**Correct approach:**

```typescript
// Right: Use effect for async, expression for sync
const flow = {
  kind: "seq",
  steps: [
    { kind: "effect", type: "api.fetch", params: { url: "/data" } },
    // After Host executes effect and applies patches:
    { kind: "patch", op: "set", path: "/data/processed", value: true },
  ],
};
```

---

## Troubleshooting

### Error: "Invalid path"

**Cause:** Path doesn't match schema structure.

**Solution:**

```typescript
// Check your path format
// Correct: "/data/todos/0/title"
// Wrong: "data.todos[0].title"

const patch = { op: "set", path: "/data/count", value: 5 }; // Use JSON Pointer format
```

### Error: "Schema validation failed"

**Cause:** Schema structure is invalid.

**Diagnosis:**

```typescript
const result = core.validate(schema);
console.log(result.errors);
// → [{ path: "/actions/foo", message: "Missing flow" }]
```

**Solution:** Fix the schema according to error messages.

### Computed value is undefined

**Cause:** Dependencies not properly declared or path is wrong.

**Solution:**

```typescript
// Ensure deps are correct
const computed = {
  total: {
    deps: ["/data/items"],  // Must match actual paths
    expr: { kind: "length", arg: { kind: "get", path: "/data/items" } },
  },
};
```

---

## Testing

### Unit Testing

```typescript
import { createCore, createSnapshot, createIntent } from "@manifesto-ai/core";
import { describe, it, expect } from "vitest";

describe("Counter domain", () => {
  it("increments count", async () => {
    // Arrange
    const core = createCore();
    const snapshot = createSnapshot(schema);

    // Act
    const result = await core.compute(schema, snapshot, createIntent("increment"));

    // Assert
    expect(result.status).toBe("completed");
    expect(result.snapshot.data.count).toBe(1);
  });

  it("handles effects correctly", async () => {
    // Arrange
    const core = createCore();
    const snapshot = createSnapshot(schemaWithEffect);

    // Act
    const result = await core.compute(schemaWithEffect, snapshot, {
      type: "fetchUser",
      input: { id: "123" },
      intentId: "i_1",
    });

    // Assert
    expect(result.status).toBe("pending");
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].effect.type).toBe("api.fetch");
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createCore()` | Create core instance | `const core = createCore()` |
| `core.compute()` | Compute state transition | `await core.compute(schema, snapshot, intent)` |
| `core.apply()` | Apply patches | `core.apply(schema, snapshot, patches)` |
| `core.validate()` | Validate schema | `core.validate(schema)` |
| `core.explain()` | Explain value | `core.explain(schema, snapshot, path)` |

### ComputeResult Status

| Status | Meaning |
|--------|---------|
| `completed` | All done, no pending effects |
| `pending` | Has pending requirements (effects) |
| `failed` | Error occurred during computation |

---

*End of Guide*
