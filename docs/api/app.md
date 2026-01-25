# @manifesto-ai/app

> High-level facade for building Manifesto applications

---

## Overview

`@manifesto-ai/app` combines Core, Host, World, and Memory into a simple, cohesive API. It is the recommended starting point for building Manifesto applications.

---

## createApp()

Creates a new Manifesto App instance.

```typescript
function createApp(
  domain: string | DomainSchema,
  opts?: CreateAppOptions
): App
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | `string \| DomainSchema` | MEL text or compiled schema |
| `opts` | `CreateAppOptions` | Optional configuration |

### CreateAppOptions

```typescript
interface CreateAppOptions {
  /** Initial data for genesis snapshot */
  initialData?: unknown;

  /** Effect handler mappings */
  services?: ServiceMap;

  /** Memory configuration (false to disable) */
  memory?: false | MemoryHubConfig;

  /** Plugin array */
  plugins?: readonly AppPlugin[];

  /** Validation settings */
  validation?: ValidationConfig;

  /** Actor policy */
  actorPolicy?: ActorPolicyConfig;

  /** System Action settings */
  systemActions?: SystemActionsConfig;

  /** Scheduler configuration */
  scheduler?: SchedulerConfig;

  /** Development tools */
  devtools?: DevtoolsConfig;
}
```

### Example

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp(melSource, {
  initialData: { todos: [] },
  services: {
    "api.fetch": async (params, ctx) => {
      const data = await fetch(params.url).then((r) => r.json());
      return [ctx.patch.set("data", data)];
    },
  },
  validation: { services: "strict" },
});
```

---

## App Interface

The `App` interface is the main entry point for interacting with your application.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `AppStatus` | Current lifecycle status |
| `hooks` | `Hookable<AppHooks>` | Hook subscription interface |
| `system` | `SystemFacade` | System Runtime access |
| `memory` | `MemoryFacade` | Memory operations |

### AppStatus

```typescript
type AppStatus = "created" | "ready" | "disposing" | "disposed";
```

---

## Lifecycle Methods

### ready()

Initializes the app. Must be called before other operations.

```typescript
await app.ready(): Promise<void>
```

### dispose()

Gracefully shuts down the app.

```typescript
await app.dispose(opts?: DisposeOptions): Promise<void>
```

### Example

```typescript
const app = createApp(mel);

await app.ready();
console.log(app.status); // "ready"

// Use the app...

await app.dispose();
console.log(app.status); // "disposed"
```

---

## Action Methods

### act()

Executes an action and returns an ActionHandle.

```typescript
app.act(
  type: string,
  input?: unknown,
  opts?: ActOptions
): ActionHandle
```

#### ActOptions

```typescript
interface ActOptions {
  /** Actor override */
  actorId?: string;

  /** Branch context */
  branchId?: string;

  /** Memory recall attachment */
  recall?: false | RecallRequest | readonly RecallRequest[];

  /** Trace options */
  trace?: {
    enabled?: boolean;
    level?: "minimal" | "standard" | "verbose";
  };
}
```

### getActionHandle()

Retrieves an existing ActionHandle by proposal ID.

```typescript
app.getActionHandle(proposalId: string): ActionHandle
```

### Example

```typescript
// Basic action
const handle = app.act("addTodo", { title: "Learn Manifesto" });
await handle.done();

// With options
const handle2 = app.act("addTodo", { title: "Build app" }, {
  actorId: "user-123",
  branchId: "feature-branch",
});

// Reattach to existing action
const existingHandle = app.getActionHandle("prop_abc123");
const result = await existingHandle.result();
```

---

## ActionHandle Interface

Represents an in-flight action with methods to track and await its completion.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `proposalId` | `string` | Stable identifier for this action |
| `phase` | `ActionPhase` | Current lifecycle phase |
| `runtime` | `RuntimeKind` | Target runtime ("domain" or "system") |

### ActionPhase

```typescript
type ActionPhase =
  | "preparing"          // Pre-submission async work
  | "preparation_failed" // Preparation failed
  | "submitted"          // Submitted to World Protocol
  | "evaluating"         // Authority evaluation
  | "pending"            // HITL approval required
  | "approved"           // Approved, awaiting execution
  | "executing"          // Host executing effects
  | "completed"          // Success
  | "rejected"           // Authority rejected
  | "failed";            // Execution failed
```

### Methods

#### done()

Waits for successful completion. Throws on rejection or failure.

```typescript
handle.done(opts?: DoneOptions): Promise<CompletedActionResult>
```

Throws:
- `ActionRejectedError` - Authority rejected
- `ActionFailedError` - Execution failed
- `ActionPreparationError` - Preparation failed
- `ActionTimeoutError` - Timeout exceeded

#### result()

Waits for any result without throwing (except timeout).

```typescript
handle.result(opts?: DoneOptions): Promise<ActionResult>
```

#### subscribe()

Subscribes to phase changes.

```typescript
handle.subscribe(
  listener: (update: ActionUpdate) => void
): Unsubscribe
```

### Example

```typescript
const handle = app.act("submitForm", { name: "John" });

// Subscribe to phase changes
handle.subscribe((update) => {
  console.log(`Phase: ${update.previousPhase} -> ${update.phase}`);
});

// Wait for result (no throw)
const result = await handle.result();

if (result.status === "completed") {
  console.log("Success! World:", result.worldId);
} else if (result.status === "rejected") {
  console.log("Rejected:", result.reason);
} else if (result.status === "failed") {
  console.log("Failed:", result.error.message);
}
```

---

## State Methods

### getState()

Returns the current application state.

```typescript
app.getState<T = unknown>(): AppState<T>
```

### AppState

```typescript
interface AppState<TData = unknown> {
  readonly data: TData;
  readonly computed: Record<string, unknown>;
  readonly system: SystemState;
  readonly meta: SnapshotMeta;
}
```

### subscribe()

Subscribes to state changes with optional selector.

```typescript
app.subscribe<TSelected>(
  selector: (state: AppState<unknown>) => TSelected,
  listener: (selected: TSelected) => void,
  opts?: SubscribeOptions<TSelected>
): Unsubscribe
```

#### SubscribeOptions

```typescript
interface SubscribeOptions<TSelected> {
  /** Equality function for change detection. @default Object.is */
  equalityFn?: (a: TSelected, b: TSelected) => boolean;

  /** Batch mode for listener invocation. @default 'transaction' */
  batchMode?: "immediate" | "transaction" | { debounce: number };

  /** Invoke listener immediately with current value. @default false */
  fireImmediately?: boolean;
}
```

### Example

```typescript
// Read current state
const state = app.getState<MyData>();
console.log(state.data.count);
console.log(state.computed.total);
console.log(state.meta.version);

// Subscribe to specific value
const unsubscribe = app.subscribe(
  (state) => state.data.count,
  (count) => console.log("Count changed:", count),
  { batchMode: "immediate" }
);

// Subscribe to multiple values
app.subscribe(
  (state) => ({
    count: state.data.count,
    total: state.computed.total,
  }),
  ({ count, total }) => console.log(`Count: ${count}, Total: ${total}`),
  {
    equalityFn: (a, b) => a.count === b.count && a.total === b.total,
  }
);
```

---

## Branch Methods

### currentBranch()

Returns the currently active branch.

```typescript
app.currentBranch(): Branch
```

### listBranches()

Returns all branches.

```typescript
app.listBranches(): readonly Branch[]
```

### switchBranch()

Switches to a different branch.

```typescript
app.switchBranch(branchId: string): Promise<Branch>
```

### fork()

Creates a new branch from the current one.

```typescript
app.fork(opts?: ForkOptions): Promise<Branch>
```

#### ForkOptions

```typescript
interface ForkOptions {
  name?: string;
  domain?: string | DomainSchema;  // New domain triggers new Runtime
  services?: ServiceMap;           // Services for new Runtime
  migrate?: "auto" | MigrationFn;  // Migration strategy
  switchTo?: boolean;              // Switch after fork (default: true)
}
```

### Example

```typescript
// Get current branch
const branch = app.currentBranch();
console.log("Branch:", branch.id);
console.log("Head:", branch.head());

// Fork a new branch
const newBranch = await app.fork({ name: "experiment" });
await newBranch.act("riskyChange").done();

// Check result without affecting main
console.log("Experiment result:", newBranch.getState().data);

// Switch back
await app.switchBranch(branch.id);
```

---

## Session Methods

### session()

Creates a session bound to a specific actor.

```typescript
app.session(actorId: string, opts?: SessionOptions): Session
```

### Session Interface

```typescript
interface Session {
  readonly actorId: string;
  readonly branchId: string;

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  recall(req: RecallRequest | readonly RecallRequest[]): Promise<RecallResult>;
  getState<T = unknown>(): AppState<T>;
}
```

### Example

```typescript
// Create session for a user
const userSession = app.session("user-123", {
  kind: "human",
  name: "John Doe",
});

// All actions use this actor
await userSession.act("addTodo", { title: "My task" }).done();
await userSession.act("toggleTodo", { id: "..." }).done();
```

---

## Memory Methods

### memory.enabled()

Checks if memory is enabled.

```typescript
app.memory.enabled(): boolean
```

### memory.recall()

Recalls memories matching a query.

```typescript
app.memory.recall(
  req: RecallRequest | readonly RecallRequest[],
  ctx?: { actorId?: string; branchId?: string }
): Promise<RecallResult>
```

### Example

```typescript
if (app.memory.enabled()) {
  // Recall relevant memories
  const result = await app.memory.recall("user preferences");

  // Use in action
  await app.act("personalizeUI", {}, {
    recall: ["user preferences", "recent actions"],
  }).done();
}
```

---

## Hooks

### hooks.on()

Subscribes to a hook event.

```typescript
app.hooks.on<K extends keyof AppHooks>(
  name: K,
  fn: AppHooks[K]
): Unsubscribe
```

### Available Hooks

```typescript
interface AppHooks {
  // Lifecycle
  "app:created": (ctx: HookContext) => void;
  "app:ready:before": (ctx: HookContext) => void;
  "app:ready": (ctx: HookContext) => void;
  "app:dispose:before": (ctx: HookContext) => void;
  "app:dispose": (ctx: HookContext) => void;

  // Action
  "action:preparing": (payload, ctx) => void;
  "action:submitted": (payload, ctx) => void;
  "action:phase": (payload, ctx) => void;
  "action:completed": (payload, ctx) => void;

  // Branch
  "branch:created": (payload, ctx) => void;
  "branch:switched": (payload, ctx) => void;

  // Memory
  "memory:ingested": (payload, ctx) => void;
  "memory:recalled": (payload, ctx) => void;

  // Audit
  "audit:rejected": (payload, ctx) => void;
  "audit:failed": (payload, ctx) => void;
}
```

### Example

```typescript
// Log all action completions
app.hooks.on("action:completed", ({ proposalId, result }) => {
  console.log(`Action ${proposalId} completed:`, result.status);
});

// One-time ready handler
app.hooks.once("app:ready", () => {
  console.log("App is ready!");
});
```

---

## ServiceMap

Effect handlers are defined as services - async functions that return patches.

```typescript
type ServiceMap = Record<string, ServiceHandler>;

type ServiceHandler = (
  params: Record<string, unknown>,
  ctx: ServiceContext
) => ServiceReturn | Promise<ServiceReturn>;

type ServiceReturn =
  | void
  | Patch
  | readonly Patch[]
  | { patches: readonly Patch[] };
```

### ServiceContext

```typescript
interface ServiceContext {
  snapshot: Readonly<AppState<unknown>>;
  actorId: string;
  worldId: string;
  branchId: string;
  patch: PatchHelpers;
  signal: AbortSignal;
}
```

### PatchHelpers

```typescript
interface PatchHelpers {
  set(path: string, value: unknown): Patch;
  merge(path: string, value: Record<string, unknown>): Patch;
  unset(path: string): Patch;
  many(...patches: readonly (Patch | readonly Patch[])[]): Patch[];
  from(record: Record<string, unknown>, opts?: { basePath?: string }): Patch[];
}
```

### Example

```typescript
const services: ServiceMap = {
  "api.loadTodos": async (params, ctx) => {
    const response = await fetch("/api/todos");
    const todos = await response.json();
    return ctx.patch.set("todos", todos);
  },

  "api.saveTodo": async (params, ctx) => {
    await fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify(params),
    });
    // No patches returned - state already updated by action
  },
};
```

---

## Related Documentation

- [App Specification](/internals/spec/app-spec) - Normative specification
- [Getting Started](/quickstart) - Step-by-step tutorial
- [Effect Handlers](/guides/effect-handlers) - Detailed effect handler guide
