# Actions

> Action lifecycle, execution, and error handling

Actions are the primary way to change application state in Manifesto. This guide covers the action lifecycle, how to track progress, handle results, and manage concurrent actions.

---

## Action Lifecycle

When you call `app.act()`, the action goes through several phases:

```
preparing → submitted → evaluating → approved → executing → completed
                                   └→ pending (HITL)
                                   └→ rejected (Authority)
                                              └→ failed (Execution)
```

### Phase Descriptions

| Phase | Description |
|-------|-------------|
| `preparing` | Pre-submission work (memory recall, validation) |
| `preparation_failed` | Preparation failed (validation error, recall error) |
| `submitted` | Proposal submitted to World Protocol |
| `evaluating` | Authority is evaluating the proposal |
| `pending` | Awaiting human approval (HITL) |
| `approved` | Approved, ready for execution |
| `executing` | Host is executing effects |
| `completed` | Success, new World created |
| `rejected` | Authority rejected the proposal |
| `failed` | Execution failed (new World with error state) |

---

## Basic Execution

### Fire and Forget

```typescript
// Start action, don't wait
app.act("increment");
```

### Wait for Completion

```typescript
// Wait for successful completion
await app.act("increment").done();

// Wait for any result (no throw)
const result = await app.act("increment").result();
```

### With Input

```typescript
app.act("addTodo", { title: "Learn Manifesto" });
app.act("updateUser", { id: "123", name: "John" });
```

### With Options

```typescript
app.act("submitForm", formData, {
  actorId: "user-456",
  branchId: "draft-branch",
  trace: { enabled: true, level: "verbose" },
});
```

---

## ActionHandle API

`app.act()` returns an `ActionHandle` for tracking and control.

### Properties

```typescript
const handle = app.act("myAction");

handle.proposalId;  // Stable ID for this action
handle.phase;       // Current phase
handle.runtime;     // "domain" or "system"
```

### done()

Waits for successful completion. Throws on rejection or failure.

```typescript
try {
  const result = await handle.done();
  console.log("Success! World:", result.worldId);
} catch (error) {
  if (error instanceof ActionRejectedError) {
    console.log("Rejected:", error.reason);
  } else if (error instanceof ActionFailedError) {
    console.log("Failed:", error.error.message);
  }
}
```

### result()

Waits for any result without throwing.

```typescript
const result = await handle.result();

switch (result.status) {
  case "completed":
    console.log("Success:", result.worldId);
    break;
  case "rejected":
    console.log("Rejected:", result.reason);
    break;
  case "failed":
    console.log("Failed:", result.error.message);
    break;
  case "preparation_failed":
    console.log("Prep failed:", result.error.message);
    break;
}
```

### subscribe()

Subscribe to phase changes.

```typescript
handle.subscribe((update) => {
  console.log(`${update.previousPhase} → ${update.phase}`);

  if (update.detail) {
    switch (update.detail.kind) {
      case "pending":
        console.log("Awaiting approval from:", update.detail.approvers);
        break;
      case "rejected":
        console.log("Rejected:", update.detail.reason);
        break;
      case "failed":
        console.log("Failed:", update.detail.error);
        break;
      case "completed":
        console.log("Completed! World:", update.detail.worldId);
        break;
    }
  }
});
```

### detach()

Detach from the handle. The action continues in the background.

```typescript
const handle = app.act("longRunningAction");

// Start tracking
const unsub = handle.subscribe(console.log);

// Stop tracking (action continues)
unsub();
handle.detach();
```

---

## Tracking Progress

### Real-Time Phase Updates

```typescript
const handle = app.act("complexAction", data);

// Show progress UI
handle.subscribe((update) => {
  updateProgressUI(update.phase);
});

// Wait for result
const result = await handle.result();
```

### Progress Indicator Pattern

```tsx
function ActionButton({ action, input }) {
  const [phase, setPhase] = useState<ActionPhase | null>(null);

  const handleClick = async () => {
    const handle = app.act(action, input);

    handle.subscribe((update) => setPhase(update.phase));

    try {
      await handle.done();
      setPhase(null);
      toast.success("Success!");
    } catch (error) {
      setPhase(null);
      toast.error(error.message);
    }
  };

  return (
    <button onClick={handleClick} disabled={phase !== null}>
      {phase ? `${phase}...` : "Submit"}
    </button>
  );
}
```

---

## Error Handling

### Error Types

```typescript
import {
  ActionRejectedError,
  ActionFailedError,
  ActionPreparationError,
  ActionTimeoutError,
} from "@manifesto-ai/app";

try {
  await app.act("myAction").done();
} catch (error) {
  if (error instanceof ActionRejectedError) {
    // Authority rejected the action
    console.log("Reason:", error.reason);
  } else if (error instanceof ActionFailedError) {
    // Execution failed
    console.log("Error:", error.error);
    console.log("World ID:", error.worldId);  // World was created with error
  } else if (error instanceof ActionPreparationError) {
    // Preparation failed (validation, recall, etc.)
    console.log("Error:", error.error);
  } else if (error instanceof ActionTimeoutError) {
    // Timeout exceeded
    console.log("Timed out after:", error.timeoutMs);
  }
}
```

### Graceful Error Handling

```typescript
async function safeAct(type: string, input: unknown) {
  const handle = app.act(type, input);
  const result = await handle.result();

  if (result.status === "completed") {
    return { success: true, worldId: result.worldId };
  }

  // Handle different failure modes
  if (result.status === "rejected") {
    return { success: false, error: `Rejected: ${result.reason}` };
  }

  if (result.status === "failed") {
    return { success: false, error: result.error.message };
  }

  if (result.status === "preparation_failed") {
    return { success: false, error: `Preparation: ${result.error.message}` };
  }

  return { success: false, error: "Unknown error" };
}
```

### Timeout Handling

```typescript
try {
  await app.act("longAction").done({ timeoutMs: 5000 });
} catch (error) {
  if (error instanceof ActionTimeoutError) {
    // Action may still be running!
    console.log("Timed out, but action continues...");

    // Optionally reattach later
    const handle = app.getActionHandle(error.proposalId);
    await handle.result();  // Wait without timeout
  }
}
```

---

## Concurrent Actions

### Parallel Execution

```typescript
// Execute multiple actions in parallel
const handles = [
  app.act("action1"),
  app.act("action2"),
  app.act("action3"),
];

// Wait for all to complete
await Promise.all(handles.map(h => h.done()));
```

### Sequential Execution

```typescript
// Execute in sequence
await app.act("step1").done();
await app.act("step2").done();
await app.act("step3").done();
```

### Race Pattern

```typescript
// First action wins
const result = await Promise.race([
  app.act("fastPath").result(),
  app.act("slowPath").result(),
]);
```

---

## FIFO Serialization

By default, actions on the same branch are serialized (FIFO queue) to prevent version conflicts.

```typescript
const app = createApp(mel, {
  scheduler: {
    singleWriterPerBranch: true,  // Default
  },
});

// These execute sequentially, even if called in parallel
app.act("action1");  // Runs first
app.act("action2");  // Waits for action1
app.act("action3");  // Waits for action2
```

### Disable Serialization (Advanced)

```typescript
const app = createApp(mel, {
  scheduler: {
    singleWriterPerBranch: false,  // Concurrent execution
  },
});

// Warning: May cause version conflicts!
```

---

## Reattachment

### Get Existing Handle

```typescript
// Start an action
const handle = app.act("longProcess");
const proposalId = handle.proposalId;

// ... later, maybe after page reload ...

// Reattach to the same action
const reattached = app.getActionHandle(proposalId);
await reattached.result();
```

### Check if Action Exists

```typescript
try {
  const handle = app.getActionHandle(proposalId);
  console.log("Found action:", handle.phase);
} catch (error) {
  if (error instanceof ActionNotFoundError) {
    console.log("Action not found");
  }
}
```

---

## Action with Memory Recall

```typescript
// Attach memory context to action
const handle = app.act("generateResponse", { prompt }, {
  recall: [
    "user preferences",
    { query: "recent conversations", constraints: { limit: 10 } },
  ],
});

await handle.done();
```

---

## Common Patterns

### Optimistic Update with Rollback

```typescript
async function optimisticUpdate(action: string, input: unknown) {
  // Store current state
  const previousState = app.getState();

  // Start action (UI updates optimistically via subscription)
  const handle = app.act(action, input);
  const result = await handle.result();

  if (result.status !== "completed") {
    // Rollback UI if needed
    console.log("Action failed, consider rollback");
    // Your rollback logic here
  }
}
```

### Action Queue

```typescript
class ActionQueue {
  private queue: Array<{ type: string; input: unknown }> = [];
  private processing = false;

  enqueue(type: string, input: unknown) {
    this.queue.push({ type, input });
    this.process();
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { type, input } = this.queue.shift()!;
      await app.act(type, input).done();
    }

    this.processing = false;
  }
}
```

### Debounced Action

```typescript
function createDebouncedAction(type: string, delay: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  let currentHandle: ActionHandle | null = null;

  return (input: unknown) => {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(async () => {
      currentHandle = app.act(type, input);
      await currentHandle.done();
    }, delay);
  };
}

const debouncedSearch = createDebouncedAction("search", 300);
debouncedSearch({ query: "hello" });
```

---

## Best Practices

1. **Always handle errors** — Use `try/catch` with `done()` or check `result().status`
2. **Use appropriate timeouts** — Prevent UI from hanging indefinitely
3. **Clean up subscriptions** — Call the unsubscribe function when done
4. **Use FIFO for consistency** — Keep `singleWriterPerBranch: true` unless you need concurrency
5. **Track proposal IDs** — Store them for reattachment or debugging
6. **Handle all result types** — Check for rejected, failed, and preparation_failed
