# Advanced Topics

> Sessions, Memory, Hooks, Plugins, and Configuration

This guide covers advanced features of `@manifesto-ai/app` for building sophisticated applications.

---

## Sessions

Sessions provide actor-scoped contexts for multi-user applications.

### Creating a Session

```typescript
const userSession = app.session("user-123", {
  kind: "human",
  name: "John Doe",
  meta: { role: "admin" },
});
```

### Session Properties

```typescript
interface Session {
  readonly actorId: string;   // "user-123"
  readonly branchId: string;  // Current branch

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  recall(req: RecallRequest | readonly RecallRequest[]): Promise<RecallResult>;
  getState<T = unknown>(): AppState<T>;
}
```

### Using Sessions

```typescript
// All actions use the session's actor
await userSession.act("createPost", { title: "Hello" }).done();
await userSession.act("editPost", { id: "...", content: "..." }).done();

// Recall memories for this session
const memories = await userSession.recall("recent posts by me");

// Get state (same as app.getState() for the session's branch)
const state = userSession.getState();
```

### Multi-User Pattern

```typescript
class UserManager {
  private sessions = new Map<string, Session>();

  getSession(userId: string): Session {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, app.session(userId, {
        kind: "human",
      }));
    }
    return this.sessions.get(userId)!;
  }

  async act(userId: string, type: string, input: unknown) {
    const session = this.getSession(userId);
    return session.act(type, input).done();
  }
}
```

---

## Memory Integration

Memory provides semantic recall of past states for AI-powered applications.

### Enabling Memory

```typescript
import { createApp } from "@manifesto-ai/app";
import { createInMemoryProvider } from "@manifesto-ai/memory";

const app = createApp(mel, {
  memory: {
    providers: {
      default: createInMemoryProvider(),
    },
    defaultProvider: "default",
    backfill: {
      mode: "onCheckout",
      maxDepth: 100,
    },
  },
});
```

### Checking Memory Status

```typescript
if (app.memory.enabled()) {
  console.log("Providers:", app.memory.providers());
}
```

### Recalling Memories

```typescript
// Simple recall
const result = await app.memory.recall("user preferences");

// With constraints
const result2 = await app.memory.recall({
  query: "recent purchases",
  constraints: { limit: 10, minRelevance: 0.7 },
});

// Multiple queries
const result3 = await app.memory.recall([
  "user preferences",
  { query: "recent interactions", constraints: { limit: 5 } },
]);
```

### Using Recall with Actions

```typescript
// Attach memories to action
const handle = app.act("generateResponse", { prompt }, {
  recall: [
    "user context",
    { query: "relevant history", constraints: { limit: 20 } },
  ],
});

await handle.done();
```

### Recall Result Structure

```typescript
interface RecallResult {
  readonly attachments: readonly {
    provider: string;
    trace: MemoryTrace;
  }[];
  readonly selected: readonly SelectedMemory[];
  readonly views: readonly MemorySelectionView[];
}

// Access selected memories
result.selected.forEach(memory => {
  console.log("World:", memory.worldId);
  console.log("Relevance:", memory.relevance);
  console.log("Summary:", memory.summary);
});
```

### Backfill

Populate memory from lineage:

```typescript
await app.memory.backfill({
  worldId: app.currentBranch().head(),
  depth: 50,  // How far back to go
});
```

---

## Hooks System

Hooks allow you to observe and react to app lifecycle events.

### Basic Hook Usage

```typescript
// Subscribe to event
const unsubscribe = app.hooks.on("action:completed", (payload, ctx) => {
  console.log("Action completed:", payload.proposalId);
  console.log("Result:", payload.result);
});

// One-time subscription
app.hooks.once("app:ready", () => {
  console.log("App is ready!");
});
```

### Available Hooks

#### Lifecycle Hooks

```typescript
app.hooks.on("app:created", (ctx) => {
  // App instance created (before ready)
});

app.hooks.on("app:ready:before", (ctx) => {
  // About to initialize
});

app.hooks.on("app:ready", (ctx) => {
  // Initialization complete
});

app.hooks.on("app:dispose:before", (ctx) => {
  // About to dispose
});

app.hooks.on("app:dispose", (ctx) => {
  // Disposed
});
```

#### Action Hooks

```typescript
app.hooks.on("action:preparing", ({ proposalId, actorId, type, runtime }) => {
  console.log(`Preparing ${type} for ${actorId}`);
});

app.hooks.on("action:submitted", ({ proposalId, type, input }) => {
  console.log(`Submitted ${type} with input:`, input);
});

app.hooks.on("action:phase", ({ proposalId, phase, detail }) => {
  console.log(`Action ${proposalId}: ${phase}`);
});

app.hooks.on("action:completed", ({ proposalId, result }) => {
  console.log(`Completed: ${result.status}`);
});
```

#### Branch Hooks

```typescript
app.hooks.on("branch:created", ({ branchId, schemaHash, head }) => {
  console.log(`New branch: ${branchId}`);
});

app.hooks.on("branch:switched", ({ from, to }) => {
  console.log(`Switched: ${from} → ${to}`);
});

app.hooks.on("branch:checkout", ({ branchId, from, to }) => {
  console.log(`Checkout: ${from} → ${to}`);
});
```

#### Memory Hooks

```typescript
app.hooks.on("memory:ingested", ({ provider, worldId }) => {
  console.log(`Ingested ${worldId} to ${provider}`);
});

app.hooks.on("memory:recalled", ({ provider, query, atWorldId, trace }) => {
  console.log(`Recalled: "${query}" at ${atWorldId}`);
});
```

#### Audit Hooks

```typescript
app.hooks.on("audit:rejected", ({ operation, reason, proposalId }) => {
  console.log(`Rejected: ${operation} - ${reason}`);
});

app.hooks.on("audit:failed", ({ operation, error, proposalId }) => {
  console.log(`Failed: ${operation} - ${error.message}`);
});
```

### Hook Context

All hooks receive a `HookContext`:

```typescript
interface HookContext {
  enqueue(job: () => void | Promise<void>, opts?: EnqueueOptions): void;
  actorId?: string;
  branchId?: string;
  worldId?: string;
}
```

### Safe Mutations in Hooks

Direct mutations in hooks are forbidden. Use `ctx.enqueue()`:

```typescript
app.hooks.on("action:completed", ({ result }, ctx) => {
  // WRONG: Direct action
  // app.act("logEvent", { event: "completed" });

  // RIGHT: Enqueue for later
  ctx.enqueue(() => {
    app.act("logEvent", { event: "completed" });
  });
});
```

### Enqueue Options

```typescript
ctx.enqueue(job, {
  priority: "immediate",  // "immediate" | "normal" | "defer"
  label: "my-job",        // For debugging
});
```

---

## Plugins

Plugins allow extending app functionality.

### Plugin Structure

```typescript
type AppPlugin = (app: App) => void | Promise<void>;

const myPlugin: AppPlugin = (app) => {
  // Setup hooks
  app.hooks.on("app:ready", () => {
    console.log("Plugin: App ready!");
  });

  // Add behavior
  app.hooks.on("action:completed", (payload) => {
    trackAnalytics(payload);
  });
};
```

### Using Plugins

```typescript
const app = createApp(mel, {
  plugins: [myPlugin, anotherPlugin],
});
```

### Example: Logger Plugin

```typescript
const loggerPlugin: AppPlugin = (app) => {
  app.hooks.on("action:submitted", ({ type, input }) => {
    console.log(`[Action] ${type}`, input);
  });

  app.hooks.on("action:completed", ({ result }) => {
    console.log(`[Result] ${result.status}`);
  });

  app.hooks.on("app:dispose", () => {
    console.log("[App] Disposed");
  });
};
```

### Example: Analytics Plugin

```typescript
const analyticsPlugin: AppPlugin = (app) => {
  app.hooks.on("action:completed", ({ proposalId, result }) => {
    analytics.track("action_completed", {
      proposalId,
      status: result.status,
      duration: result.status === "completed" ? result.stats.durationMs : null,
    });
  });

  app.hooks.on("branch:created", ({ branchId }) => {
    analytics.track("branch_created", { branchId });
  });
};
```

---

## System Runtime

Access the System Runtime for administrative operations.

### System State

```typescript
const systemState = app.system.getState();

// Registered actors
console.log("Actors:", systemState.actors);

// Registered services
console.log("Services:", systemState.services);

// Memory configuration
console.log("Memory:", systemState.memoryConfig);

// Audit log
systemState.auditLog.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.actionType} by ${entry.actorId}`);
});
```

### System Lineage

```typescript
// System Runtime's own history
const systemWorldIds = app.system.lineage();
console.log("System history:", systemWorldIds);
```

### Subscribe to System Changes

```typescript
app.system.subscribe((state) => {
  console.log("System state changed:", state);
});
```

---

## Configuration Options

### Validation

```typescript
const app = createApp(mel, {
  validation: {
    // "lazy" (default) or "strict"
    services: "strict",

    // How to handle dynamic effect types in strict mode
    dynamicEffectPolicy: "warn",  // "warn" or "error"
  },
});
```

### Actor Policy

```typescript
const app = createApp(mel, {
  actorPolicy: {
    // "anonymous" (default) or "require"
    mode: "require",

    // Default actor if none specified
    defaultActor: {
      actorId: "system",
      kind: "system",
      name: "System Actor",
    },
  },
});
```

### System Actions

```typescript
const app = createApp(mel, {
  systemActions: {
    enabled: true,
    authorityPolicy: "admin-only",  // "permissive" | "admin-only" | custom
    disabled: ["system.reset"],     // Disable specific actions
  },
});
```

### Scheduler

```typescript
const app = createApp(mel, {
  scheduler: {
    maxConcurrent: 10,
    defaultTimeoutMs: 30000,
    singleWriterPerBranch: true,  // FIFO serialization
  },
});
```

### Devtools

```typescript
const app = createApp(mel, {
  devtools: {
    enabled: process.env.NODE_ENV === "development",
    name: "My App",
  },
});
```

---

## Error Value Structure

All errors in Manifesto are values, not exceptions:

```typescript
interface ErrorValue {
  readonly code: string;       // Error code (e.g., "VALIDATION_FAILED")
  readonly message: string;    // Human-readable message
  readonly source: {
    actionId: string;          // Which action
    nodePath: string;          // Where in the flow
  };
  readonly timestamp: number;  // When it occurred
  readonly context?: Record<string, unknown>;  // Additional context
}
```

### Accessing Errors

```typescript
const state = app.getState();

// Last error
if (state.system.lastError) {
  console.log("Error:", state.system.lastError.message);
}

// All errors
state.system.errors.forEach(error => {
  console.log(`[${error.code}] ${error.message}`);
});
```

---

## Best Practices

1. **Use sessions for multi-user apps** — Each user gets their own context
2. **Enable memory for AI features** — Semantic recall enhances AI capabilities
3. **Keep hooks lightweight** — Use `enqueue()` for heavy operations
4. **Validate in strict mode for production** — Catch missing services early
5. **Use plugins for cross-cutting concerns** — Logging, analytics, etc.
6. **Configure timeouts appropriately** — Balance responsiveness and reliability
7. **Monitor the audit log** — Track what's happening in your app
