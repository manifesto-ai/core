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
  id: "example:counter",
  version: "1.0.0",
  hash: "example-hash",
  types: {},
  state: {
    fields: {
      count: { type: "number", required: true, default: 0 },
    },
  },
  computed: {
    fields: {
      "computed.count": {
        deps: ["count"],
        expr: { kind: "get", path: "count" },
      },
    },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: {
          kind: "add",
          left: { kind: "get", path: "count" },
          right: { kind: "lit", value: 1 },
        },
      },
    },
  },
};

// 3. Provide host context (deterministic inputs)
const context = { now: 0, randomSeed: "seed" };

// 4. Create initial snapshot
const snapshot = createSnapshot({ count: 0 }, schema.hash, context);

// 5. Verify
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
const context = { now: 0, randomSeed: "seed" };

// Create initial snapshot
const snapshot = createSnapshot({ count: 0 }, schema.hash, context);
console.log(snapshot.data.count); // → 0

// Create intent
const intent = createIntent("increment", "intent-1");

// Compute result
const result = await core.compute(schema, snapshot, intent, context);

// Check result
console.log(result.status);           // → "complete"
console.log(result.requirements.length); // → 0
console.log(result.snapshot.data.count); // → 1
```

### Use Case 2: Applying Patches Manually

**Goal:** Apply patches to a snapshot without full compute.

```typescript
import { createCore, createSnapshot } from "@manifesto-ai/core";
import type { Patch } from "@manifesto-ai/core";

const core = createCore();
const context = { now: 0, randomSeed: "seed" };
const snapshot = createSnapshot({ count: 0 }, schema.hash, context);

// Define patches
const patches: Patch[] = [
  { op: "set", path: "count", value: 10 },
  { op: "set", path: "name", value: "Alice" },
];

// Apply patches
const newSnapshot = core.apply(schema, snapshot, patches, context);

console.log(newSnapshot.data.count); // → 10
console.log(newSnapshot.data.name);  // → "Alice"
```

### Use Case 3: Handling Effects

**Goal:** Understand how effects are declared (not executed).

```typescript
const schemaWithEffect: DomainSchema = {
  id: "example:fetch-user",
  version: "1.0.0",
  hash: "example-fetch-hash",
  types: {},
  state: {
    fields: {
      user: {
        type: "object",
        required: false,
        default: null,
        fields: {
          id: { type: "string", required: true },
        },
      },
    },
  },
  computed: {
    fields: {
      "computed.user": {
        deps: ["user"],
        expr: { kind: "get", path: "user" },
      },
    },
  },
  actions: {
    fetchUser: {
      input: {
        type: "object",
        required: true,
        fields: {
          id: { type: "string", required: true },
        },
      },
      flow: {
        kind: "effect",
        type: "api.fetch",
        params: {
          url: {
            kind: "concat",
            args: [
              { kind: "lit", value: "/api/users/" },
              { kind: "get", path: "input.id" },
            ],
          },
        },
      },
    },
  },
};

const context = { now: 0, randomSeed: "seed" };
const snapshot = createSnapshot({ user: null }, schemaWithEffect.hash, context);
const intent = createIntent("fetchUser", { id: "123" }, "intent-1");

const result = await core.compute(schemaWithEffect, snapshot, intent, context);

// Effect is recorded as a requirement, not executed
console.log(result.status); // → "pending"
console.log(result.requirements.length); // → 1
console.log(result.requirements[0].type); // → "api.fetch"
```

---

## Common Patterns

### Pattern 1: Conditional Patches

**When to use:** Apply different patches based on state conditions.

```typescript
const flow = {
  kind: "if",
  cond: {
    kind: "gt",
    left: { kind: "get", path: "count" },
    right: { kind: "lit", value: 10 },
  },
  then: { kind: "patch", op: "set", path: "status", value: { kind: "lit", value: "high" } },
  else: { kind: "patch", op: "set", path: "status", value: { kind: "lit", value: "low" } },
};
```

### Pattern 2: Sequential Operations

**When to use:** Execute multiple steps in order.

```typescript
const flow = {
  kind: "seq",
  steps: [
    { kind: "patch", op: "set", path: "loading", value: { kind: "lit", value: true } },
    { kind: "effect", type: "api.fetch", params: { url: { kind: "lit", value: "/data" } } },
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
      cond: { kind: "get", path: "processed" },
      then: { kind: "halt" },
    },
    // Continue with processing
    { kind: "patch", op: "set", path: "processed", value: { kind: "lit", value: true } },
  ],
};
```

---

## Advanced Usage

### Explaining Values

**Prerequisites:** Understanding of computed values.

```typescript
const schema: DomainSchema = {
  id: "example:items",
  version: "1.0.0",
  hash: "example-items-hash",
  types: {},
  state: {
    fields: {
      items: {
        type: "array",
        required: true,
        default: [],
        items: { type: "string", required: true },
      },
    },
  },
  computed: {
    fields: {
      "computed.total": {
        deps: ["items"],
        expr: { kind: "length", arg: { kind: "get", path: "items" } },
      },
    },
  },
  actions: {
    noop: { flow: { kind: "halt", reason: "noop" } },
  },
};

const context = { now: 0, randomSeed: "seed" };
const snapshot = createSnapshot({ items: [] }, schema.hash, context);
const explanation = core.explain(schema, snapshot, "computed.total");

console.log(explanation);
// → { value: 0, deps: ["items"], trace: [...] }
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
const context = { now: 0, randomSeed: "seed" };
const intent = createIntent("fetchUser", { id: "123" }, "intent-1");
const result = await core.compute(schema, snapshot, intent, context);
console.log(result.snapshot.data.user); // → undefined (effect not executed!)
```

**Why it's wrong:** Core only declares effects as requirements. It never executes them.

**Correct approach:**

```typescript
// Right: Check for requirements and use Host to execute
const result = await core.compute(schema, snapshot, intent, context);

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
  { op: "set", path: "count", value: 5 },
], context);
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
    { kind: "effect", type: "api.fetch", params: { url: { kind: "lit", value: "/data" } } },
    // After Host executes effect and applies patches:
    { kind: "patch", op: "set", path: "processed", value: { kind: "lit", value: true } },
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
// Correct: "todos.0.title"
// Wrong: "/data/todos/0/title"

const patch = { op: "set", path: "count", value: 5 }; // Use dot-separated semantic paths
```

### Error: "Schema validation failed"

**Cause:** Schema structure is invalid.

**Diagnosis:**

```typescript
const result = core.validate(schema);
console.log(result.errors);
// → [{ path: "actions.foo", message: "Missing flow" }]
```

**Solution:** Fix the schema according to error messages.

### Computed value is undefined

**Cause:** Dependencies not properly declared or path is wrong.

**Solution:**

```typescript
// Ensure deps are correct
const computed = {
  fields: {
    "computed.total": {
      deps: ["items"],  // Must match actual paths
      expr: { kind: "length", arg: { kind: "get", path: "items" } },
    },
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
    const context = { now: 0, randomSeed: "seed" };
    const snapshot = createSnapshot({ count: 0 }, schema.hash, context);

    // Act
    const result = await core.compute(
      schema,
      snapshot,
      createIntent("increment", "intent-1"),
      context
    );

    // Assert
    expect(result.status).toBe("complete");
    expect(result.snapshot.data.count).toBe(1);
  });

  it("handles effects correctly", async () => {
    // Arrange
    const core = createCore();
    const context = { now: 0, randomSeed: "seed" };
    const snapshot = createSnapshot({ user: null }, schemaWithEffect.hash, context);
    const intent = createIntent("fetchUser", { id: "123" }, "intent-1");

    // Act
    const result = await core.compute(schemaWithEffect, snapshot, intent, context);

    // Assert
    expect(result.status).toBe("pending");
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].type).toBe("api.fetch");
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createCore()` | Create core instance | `const core = createCore()` |
| `core.compute()` | Compute state transition | `await core.compute(schema, snapshot, intent, context)` |
| `core.apply()` | Apply patches | `core.apply(schema, snapshot, patches, context)` |
| `core.validate()` | Validate schema | `core.validate(schema)` |
| `core.explain()` | Explain value | `core.explain(schema, snapshot, path)` |

### ComputeResult Status

| Status | Meaning |
|--------|---------|
| `complete` | All done, no pending effects |
| `pending` | Has pending requirements (effects) |
| `error` | Error occurred during computation |

---

*End of Guide*
