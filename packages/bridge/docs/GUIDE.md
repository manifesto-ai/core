# Bridge Guide

> **Purpose:** Practical guide for using @manifesto-ai/bridge
> **Prerequisites:** Basic understanding of World and Host
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
npm install @manifesto-ai/bridge @manifesto-ai/world @manifesto-ai/host @manifesto-ai/core
```

### Minimal Setup

```typescript
import { createBridge } from "@manifesto-ai/bridge";
import { createManifestoWorld, createAutoApproveHandler } from "@manifesto-ai/world";
import { createHost, createSnapshot } from "@manifesto-ai/host";

// 1. Create host and world
const host = createHost({ schema, snapshot: createSnapshot(schema) });
const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  host,
  defaultAuthority: createAutoApproveHandler(),
});

// 2. Create bridge
const bridge = createBridge({
  world,
  schemaHash: world.schemaHash,
  defaultActor: { actorId: "user-1", kind: "human" },
});

// 3. Verify
console.log(bridge.get("/data"));
// → { ... initial state }
```

---

## Basic Usage

### Use Case 1: Subscribing to State Changes

**Goal:** React to snapshot updates.

```typescript
// Subscribe to all changes
const unsubscribe = bridge.subscribe((snapshot) => {
  console.log("State updated:", snapshot.data);
  console.log("Computed:", snapshot.computed);
});

// Later: clean up
unsubscribe();
```

### Use Case 2: Dispatching Intents Directly

**Goal:** Send intents without event routing.

```typescript
// Dispatch intent directly
const result = await bridge.dispatch({
  type: "todo.add",
  input: { title: "Buy milk" },
});

console.log(result.status); // → "completed"
```

### Use Case 3: Dispatching Events with Projections

**Goal:** Route UI events through projections to intents.

```typescript
import { createUISourceEvent } from "@manifesto-ai/bridge";

// Register a projection
bridge.registerProjection({
  projectionId: "ui:add-todo-form",
  project(req) {
    if (req.source.payload?.action === "submit") {
      return {
        kind: "intent",
        body: {
          type: "todo.add",
          input: req.source.payload.formData,
        },
      };
    }
    return { kind: "none" };
  },
});

// Dispatch event
await bridge.dispatchEvent(
  createUISourceEvent("add-form", {
    action: "submit",
    formData: { title: "Buy milk" },
  })
);
```

---

## Common Patterns

### Pattern 1: Form Submission Projection

**When to use:** Handle form submissions from UI.

```typescript
bridge.registerProjection({
  projectionId: "ui:login-form",
  project(req) {
    const { payload } = req.source;

    if (payload?.formId === "login" && payload?.action === "submit") {
      return {
        kind: "intent",
        body: {
          type: "auth.login",
          input: {
            email: payload.values.email,
            password: payload.values.password,
          },
        },
      };
    }

    return { kind: "none" };
  },
});

// Usage
await bridge.dispatchEvent(
  createUISourceEvent("login-submit", {
    formId: "login",
    action: "submit",
    values: { email: "user@example.com", password: "secret" },
  })
);
```

### Pattern 2: Button Click Projection

**When to use:** Handle button clicks.

```typescript
bridge.registerProjection({
  projectionId: "ui:todo-actions",
  project(req) {
    const { payload } = req.source;

    switch (payload?.action) {
      case "toggle":
        return {
          kind: "intent",
          body: { type: "todo.toggle", input: { id: payload.todoId } },
        };
      case "delete":
        return {
          kind: "intent",
          body: { type: "todo.delete", input: { id: payload.todoId } },
        };
      default:
        return { kind: "none" };
    }
  },
});
```

### Pattern 3: API Webhook Projection

**When to use:** Handle incoming webhooks.

```typescript
import { createAPISourceEvent } from "@manifesto-ai/bridge";

bridge.registerProjection({
  projectionId: "api:stripe-webhook",
  project(req) {
    const { payload } = req.source;

    if (payload?.type === "payment_intent.succeeded") {
      return {
        kind: "intent",
        body: {
          type: "order.markPaid",
          input: {
            orderId: payload.data.object.metadata.orderId,
            paymentId: payload.data.object.id,
          },
        },
      };
    }

    return { kind: "none" };
  },
});

// Called from webhook handler
app.post("/webhooks/stripe", async (req) => {
  await bridge.dispatchEvent(
    createAPISourceEvent("stripe", req.body)
  );
});
```

---

## Advanced Usage

### Different Source Kinds

```typescript
import {
  createUISourceEvent,
  createAPISourceEvent,
  createAgentSourceEvent,
  createSystemSourceEvent,
} from "@manifesto-ai/bridge";

// UI event (user interaction)
createUISourceEvent("button-click", { buttonId: "submit" });

// API event (external service)
createAPISourceEvent("webhook", { type: "payment.completed" });

// Agent event (AI agent action)
createAgentSourceEvent("agent-action", { action: "summarize", text: "..." });

// System event (internal trigger)
createSystemSourceEvent("cron-job", { job: "cleanup" });
```

### Projection Recording (Audit)

```typescript
import { createBridge, createProjectionRecorder } from "@manifesto-ai/bridge";

const recorder = createProjectionRecorder();

const bridge = createBridge({
  world,
  schemaHash: world.schemaHash,
  defaultActor: { actorId: "user-1", kind: "human" },
  recorder, // Enable recording
});

// After some events...
const records = recorder.getRecords();
console.log(records);
// → [{ projectionId, sourceEvent, result, timestamp }, ...]
```

### Reading State

```typescript
// Get value by path
const todos = bridge.get("/data/todos");
const filter = bridge.get("/data/filter");
const remaining = bridge.get("/computed/remaining");

// Typed access (if you have the schema)
const snapshot = bridge.getSnapshot();
console.log(snapshot.data.todos);
console.log(snapshot.computed.remaining);
```

---

## Common Mistakes

### Mistake 1: Ignoring Projection Failures

**What people do:**

```typescript
// Wrong: Not checking projection result
bridge.registerProjection({
  projectionId: "ui:form",
  project(req) {
    // May throw or return invalid intent
    const data = JSON.parse(req.source.payload.raw); // Can throw!
    return {
      kind: "intent",
      body: { type: "todo.add", input: data },
    };
  },
});

await bridge.dispatchEvent(createUISourceEvent("form", { raw: "invalid-json" }));
// Projection crashes silently!
```

**Why it's wrong:** Projection errors are caught and logged, but the event is silently dropped. Users see no feedback.

**Correct approach:**

```typescript
// Right: Handle projection errors gracefully
bridge.registerProjection({
  projectionId: "ui:form",
  project(req) {
    try {
      const payload = req.source.payload;

      // Validate payload first
      if (!payload || typeof payload.raw !== "string") {
        console.error("[Projection] Invalid payload:", payload);
        return { kind: "none" }; // Explicit no-op
      }

      // Parse safely
      const data = JSON.parse(payload.raw);

      // Validate parsed data
      if (!data.title || typeof data.title !== "string") {
        console.error("[Projection] Invalid parsed data:", data);
        return { kind: "none" };
      }

      return {
        kind: "intent",
        body: { type: "todo.add", input: { title: data.title } },
      };
    } catch (error) {
      console.error("[Projection] Error:", error);
      // Return intent to show error to user
      return {
        kind: "intent",
        body: {
          type: "error.show",
          input: { message: "Invalid form data" },
        },
      };
    }
  },
});
```

### Mistake 2: Race Conditions During Initialization

**What people do:**

```typescript
// Wrong: Creating bridge before world is ready
const world = createManifestoWorld({ schemaHash, host });
const bridge = createBridge({ world, schemaHash, defaultActor });

// Immediately dispatch
await bridge.dispatch({ type: "init.load", input: {} });
// World may not be fully initialized!
```

**Why it's wrong:** If World Protocol is still setting up (loading persistence, registering actors), dispatching immediately can fail or create inconsistent state.

**Correct approach:**

```typescript
// Right: Wait for world to be ready
const world = createManifestoWorld({
  schemaHash,
  host,
  defaultAuthority: createAutoApproveHandler(),
});

// Register all actors first
world.registerActor({ actorId: "user-1", kind: "human" });
world.registerActor({ actorId: "system", kind: "system" });

// Create bridge after world setup
const bridge = createBridge({
  world,
  schemaHash,
  defaultActor: { actorId: "user-1", kind: "human" },
});

// Register all projections before events
bridge.registerProjection({
  projectionId: "ui:init",
  project: () => ({ kind: "intent", body: { type: "init.load", input: {} } }),
});

// Now safe to dispatch
await bridge.dispatch({ type: "init.load", input: {} });
```

**Better: Use initialization intent**

```typescript
// Best: Explicit initialization flow
const world = createManifestoWorld({ schemaHash, host });
world.registerActor({ actorId: "system", kind: "system" });

const bridge = createBridge({
  world,
  schemaHash,
  defaultActor: { actorId: "system", kind: "system" },
});

// Dispatch initialization intent
await bridge.dispatch({
  type: "system.initialize",
  input: {
    actors: [
      { actorId: "user-1", kind: "human" },
      { actorId: "agent-1", kind: "agent" },
    ],
  },
});

// Now application is ready
```

### Mistake 3: Forgetting to Register Projections

**What people do:**

```typescript
// Wrong: No projection registered
await bridge.dispatchEvent(createUISourceEvent("click", { action: "add" }));
// Nothing happens! Event is ignored.
```

**Why it's wrong:** Events without matching projections are silently ignored.

**Correct approach:**

```typescript
// Right: Register projection first
bridge.registerProjection({
  projectionId: "ui:actions",
  project(req) {
    if (req.source.payload?.action === "add") {
      return { kind: "intent", body: { type: "todo.add", input: {} } };
    }
    return { kind: "none" };
  },
});

await bridge.dispatchEvent(createUISourceEvent("click", { action: "add" }));
```

### Mistake 4: Not Cleaning Up Subscriptions

**What people do:**

```typescript
// Wrong: Memory leak
useEffect(() => {
  bridge.subscribe((snapshot) => {
    setState(snapshot.data);
  });
  // No cleanup!
}, []);
```

**Why it's wrong:** Subscriptions accumulate, causing memory leaks.

**Correct approach:**

```typescript
// Right: Cleanup on unmount
useEffect(() => {
  const unsubscribe = bridge.subscribe((snapshot) => {
    setState(snapshot.data);
  });
  return () => unsubscribe(); // Cleanup
}, []);
```

### Mistake 5: Mutating SnapshotView

**What people do:**

```typescript
// Wrong: Mutating frozen object
bridge.subscribe((snapshot) => {
  snapshot.data.todos.push({ id: "new" }); // Error!
});
```

**Why it's wrong:** SnapshotView is frozen (Object.freeze).

**Correct approach:**

```typescript
// Right: Dispatch intent to change state
bridge.subscribe((snapshot) => {
  // Read only
  console.log(snapshot.data.todos);
});

// To change state:
await bridge.dispatch({ type: "todo.add", input: { title: "New" } });
```

---

## Troubleshooting

### Error: "No projection found"

**Cause:** dispatchEvent called but no matching projection.

**Solution:**

```typescript
// Register projections before dispatching
bridge.registerProjection({
  projectionId: "my-projection",
  project(req) {
    // Handle the event
  },
});
```

### Error: "No actor configured"

**Cause:** defaultActor not set and no actor in event.

**Solution:**

```typescript
const bridge = createBridge({
  world,
  schemaHash: "...",
  defaultActor: { actorId: "user-1", kind: "human" }, // Required
});
```

### Subscription not receiving updates

**Cause:** Subscribe called after state change, or wrong bridge instance.

**Solution:**

```typescript
// Subscribe before dispatching
const unsubscribe = bridge.subscribe((snapshot) => {
  console.log("Updated:", snapshot);
});

// Then dispatch
await bridge.dispatch({ type: "action", input: {} });
```

---

## Testing

### Unit Testing Projections

```typescript
import { describe, it, expect } from "vitest";

describe("Todo projection", () => {
  const projection = {
    projectionId: "ui:todo",
    project(req) {
      if (req.source.payload?.action === "add") {
        return {
          kind: "intent",
          body: { type: "todo.add", input: req.source.payload.data },
        };
      }
      return { kind: "none" };
    },
  };

  it("maps add action to intent", () => {
    const result = projection.project({
      source: {
        kind: "ui",
        eventId: "e_1",
        payload: { action: "add", data: { title: "Test" } },
      },
      snapshot: {},
    });

    expect(result.kind).toBe("intent");
    expect(result.body.type).toBe("todo.add");
    expect(result.body.input).toEqual({ title: "Test" });
  });

  it("returns none for unknown actions", () => {
    const result = projection.project({
      source: { kind: "ui", eventId: "e_2", payload: { action: "unknown" } },
      snapshot: {},
    });

    expect(result.kind).toBe("none");
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createBridge()` | Create bridge | `createBridge({ world, schemaHash, defaultActor })` |
| `bridge.subscribe()` | Listen to changes | `bridge.subscribe(callback)` |
| `bridge.dispatch()` | Direct intent | `await bridge.dispatch(body)` |
| `bridge.dispatchEvent()` | Event routing | `await bridge.dispatchEvent(event)` |
| `bridge.registerProjection()` | Add projection | `bridge.registerProjection(projection)` |
| `bridge.get()` | Read value | `bridge.get("/data/todos")` |
| `bridge.dispose()` | Cleanup | `bridge.dispose()` |

### SourceEvent Kinds

| Kind | Factory | Use Case |
|------|---------|----------|
| `ui` | `createUISourceEvent()` | User interactions |
| `api` | `createAPISourceEvent()` | Webhooks, REST |
| `agent` | `createAgentSourceEvent()` | AI actions |
| `system` | `createSystemSourceEvent()` | Cron, startup |

---

*End of Guide*
