# @manifesto-ai/app

> High-level facade for building Manifesto applications

---

## Overview

`@manifesto-ai/app` combines Core, Host, World, and Memory into a simple, cohesive API. It is the recommended starting point for building Manifesto applications.

The App package provides:
- Unified lifecycle management (ready/dispose)
- Actor-scoped sessions
- Branch management and forking
- Effect handler registration
- Memory integration
- System actions runtime
- Type-safe state subscriptions

---

## createApp()

Creates a new Manifesto App instance.

```typescript
function createApp(config: AppConfig): App
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `AppConfig` | Application configuration |

### AppConfig

```typescript
interface AppConfig {
  // Required
  readonly schema: DomainSchema | string;
  readonly effects: Effects;

  // Optional: World
  readonly world?: ManifestoWorld;

  // Optional: Policy
  readonly policyService?: PolicyService;
  readonly executionKeyPolicy?: ExecutionKeyPolicy;

  // Optional: Memory
  readonly memoryStore?: MemoryStore;
  readonly memoryProvider?: MemoryProvider;
  readonly memory?: false | MemoryHubConfig;

  // Optional: Extensibility
  readonly plugins?: readonly AppPlugin[];
  readonly hooks?: Partial<AppHooks>;

  // Optional: Validation
  readonly validation?: {
    readonly effects?: "strict" | "warn" | "off";
  };

  // Optional: Initial data
  readonly initialData?: unknown;

  // Optional: Actor policy
  readonly actorPolicy?: ActorPolicyConfig;

  // Optional: Scheduler
  readonly scheduler?: SchedulerConfig;

  // Optional: System actions
  readonly systemActions?: SystemActionsConfig;

  // Optional: Devtools
  readonly devtools?: DevtoolsConfig;
}
```

### Example

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp({
  schema: melSource,
  effects: {
    "api.fetch": async (params, ctx) => {
      const data = await fetch(params.url).then((r) => r.json());
      return [{ op: "set", path: "data.result", value: data }];
    },
  },
  initialData: { todos: [] },
  validation: { effects: "strict" },
});

await app.ready();
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

#### DisposeOptions

```typescript
interface DisposeOptions {
  force?: boolean;
  timeoutMs?: number;
}
```

### Example

```typescript
const app = createApp({ schema: mel, effects: {} });

await app.ready();
console.log(app.status); // "ready"

// Use the app...

await app.dispose();
console.log(app.status); // "disposed"
```

---

## Schema Access

### getDomainSchema()

Returns the DomainSchema for the current branch's schemaHash.

```typescript
app.getDomainSchema(): DomainSchema
```

This provides synchronous pull-based access to the domain schema. In multi-schema scenarios (schema-changing fork), this returns the schema for the current branch's schemaHash.

**Throws:**
- `AppNotReadyError` if called before schema is resolved
- `AppDisposedError` if called after dispose()

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

**Throws:**
- `ActionNotFoundError` if proposalId is unknown

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

**Throws:**
- `ActionRejectedError` - Authority rejected
- `ActionFailedError` - Execution failed
- `ActionPreparationError` - Preparation failed
- `ActionTimeoutError` - Timeout exceeded

#### result()

Waits for any result without throwing (except timeout).

```typescript
handle.result(opts?: DoneOptions): Promise<ActionResult>
```

**Throws:**
- `ActionTimeoutError` - Timeout exceeded

#### subscribe()

Subscribes to phase changes.

```typescript
handle.subscribe(
  listener: (update: ActionUpdate) => void
): Unsubscribe
```

#### detach()

Detaches from this handle. The proposal continues in World Protocol.

```typescript
handle.detach(): void
```

### DoneOptions

```typescript
interface DoneOptions {
  /** Maximum wait time in ms. @default Infinity */
  timeoutMs?: number;
}
```

### ActionResult

```typescript
type ActionResult =
  | CompletedActionResult
  | RejectedActionResult
  | FailedActionResult
  | PreparationFailedActionResult;

interface CompletedActionResult {
  readonly status: "completed";
  readonly worldId: string;
  readonly proposalId: string;
  readonly decisionId: string;
  readonly stats: ExecutionStats;
  readonly runtime: RuntimeKind;
}

interface RejectedActionResult {
  readonly status: "rejected";
  readonly proposalId: string;
  readonly decisionId: string;
  readonly reason?: string;
  readonly runtime: RuntimeKind;
}

interface FailedActionResult {
  readonly status: "failed";
  readonly proposalId: string;
  readonly decisionId: string;
  readonly error: ErrorValue;
  readonly worldId: string;
  readonly runtime: RuntimeKind;
}

interface PreparationFailedActionResult {
  readonly status: "preparation_failed";
  readonly proposalId: string;
  readonly error: ErrorValue;
  readonly runtime: RuntimeKind;
}
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

interface SystemState {
  readonly status: "idle" | "computing" | "pending" | "error";
  readonly lastError: ErrorValue | null;
  readonly errors: readonly ErrorValue[];
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
}

interface SnapshotMeta {
  readonly version: number;
  readonly timestamp: number;
  readonly randomSeed: string;
  readonly schemaHash: string;
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
  /** Fork point (default: current head) */
  from?: WorldId;

  /** Branch name */
  name?: string;

  /** New domain triggers new Runtime creation */
  domain?: string | DomainSchema;

  /** Switch to new branch after fork. @default true */
  switchTo?: boolean;
}
```

### Branch Interface

```typescript
interface Branch {
  readonly id: string;
  readonly name?: string;
  readonly schemaHash: string;

  head(): string;
  checkout(worldId: string): Promise<void>;
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  fork(opts?: ForkOptions): Promise<Branch>;
  getState<T = unknown>(): AppState<T>;
  lineage(opts?: LineageOptions): readonly string[];
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

#### SessionOptions

```typescript
interface SessionOptions {
  branchId?: string;
  kind?: "human" | "agent" | "system";
  name?: string;
  meta?: Record<string, unknown>;
}
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

### memory.providers()

Returns list of registered memory provider names.

```typescript
app.memory.providers(): readonly string[]
```

### memory.backfill()

Backfills memory from a specific world.

```typescript
app.memory.backfill(opts: { worldId: string; depth?: number }): Promise<void>
```

### memory.maintain()

Performs memory maintenance operations.

```typescript
app.memory.maintain(
  ops: readonly MemoryMaintenanceOp[],
  ctx: MemoryMaintenanceContext
): Promise<MemoryMaintenanceOutput>
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

## System Methods

### system.act()

Executes a system action.

```typescript
app.system.act(type: `system.${string}`, input?: unknown): ActionHandle
```

### system.memory.maintain()

Runs memory maintenance via System Runtime.

```typescript
app.system.memory.maintain(opts: MemoryMaintenanceOptions): ActionHandle
```

### Example

```typescript
// Execute system action
const handle = app.system.act("system.auditLog.query", {
  filter: { actorId: "user-123" }
});
const result = await handle.done();
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

### hooks.once()

Subscribes to a hook event (one-time).

```typescript
app.hooks.once<K extends keyof AppHooks>(
  name: K,
  fn: AppHooks[K]
): Unsubscribe
```

### Available Hooks

```typescript
interface AppHooks {
  // Lifecycle
  "app:created": (ctx: HookContext) => void | Promise<void>;
  "app:ready:before": (ctx: HookContext) => void | Promise<void>;
  "app:ready": (ctx: HookContext) => void | Promise<void>;
  "app:dispose:before": (ctx: HookContext) => void | Promise<void>;
  "app:dispose": (ctx: HookContext) => void | Promise<void>;

  // Domain/Runtime
  "domain:resolved": (
    payload: { schemaHash: string; schema: DomainSchema },
    ctx: HookContext
  ) => void | Promise<void>;
  "domain:schema:added": (
    payload: { schemaHash: string; schema: DomainSchema },
    ctx: HookContext
  ) => void | Promise<void>;
  "runtime:created": (
    payload: { schemaHash: string; kind: RuntimeKind },
    ctx: HookContext
  ) => void | Promise<void>;

  // Branch
  "branch:created": (
    payload: { branchId: string; schemaHash: string; head: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "branch:checkout": (
    payload: { branchId: string; from: string; to: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "branch:switched": (
    payload: { from: string; to: string },
    ctx: HookContext
  ) => void | Promise<void>;

  // Action
  "action:preparing": (
    payload: { proposalId: string; actorId: string; type: string; runtime: RuntimeKind },
    ctx: HookContext
  ) => void | Promise<void>;
  "action:submitted": (
    payload: { proposalId: string; actorId: string; type: string; input: unknown; runtime: RuntimeKind },
    ctx: HookContext
  ) => void | Promise<void>;
  "action:phase": (
    payload: { proposalId: string; phase: ActionPhase; detail?: ActionUpdateDetail },
    ctx: HookContext
  ) => void | Promise<void>;
  "action:completed": (
    payload: { proposalId: string; result: ActionResult },
    ctx: HookContext
  ) => void | Promise<void>;

  // State
  "state:publish": (
    payload: { snapshot: Snapshot; worldId: string },
    ctx: HookContext
  ) => void | Promise<void>;

  // System
  "system:world": (
    payload: { type: string; proposalId: string; actorId: string; systemWorldId: string; status: "completed" | "failed" },
    ctx: HookContext
  ) => void | Promise<void>;

  // Memory
  "memory:ingested": (
    payload: { provider: string; worldId: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "memory:recalled": (
    payload: { provider: string; query: string; atWorldId: string; trace: MemoryTrace },
    ctx: HookContext
  ) => void | Promise<void>;

  // Migration
  "migration:created": (
    payload: { link: MigrationLink },
    ctx: HookContext
  ) => void | Promise<void>;

  // Job Queue
  "job:error": (
    payload: { error: unknown; label?: string },
    ctx: HookContext
  ) => void | Promise<void>;

  // Audit
  "audit:rejected": (
    payload: { operation: string; reason?: string; proposalId: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "audit:failed": (
    payload: { operation: string; error: ErrorValue; proposalId: string },
    ctx: HookContext
  ) => void | Promise<void>;
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

## Effect Handlers

Effect handlers are defined in the `effects` configuration field. They are async functions that execute side effects and return patches.

### Effects

```typescript
type Effects = Record<string, EffectHandler>;

type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext
) => Promise<readonly Patch[]>;
```

### AppEffectContext

```typescript
interface AppEffectContext {
  /** Current snapshot (read-only) */
  readonly snapshot: Readonly<Snapshot>;
}
```

### Handler Contract

Effect handlers:
- MUST return `Patch[]` (can be empty)
- MUST NOT throw exceptions (return error patches instead)
- MUST NOT contain domain logic
- Receive only `params` and `ctx` (effect type is determined by key)

### Example

```typescript
const effects: Effects = {
  "api.loadTodos": async (params, ctx) => {
    try {
      const response = await fetch("/api/todos");
      const todos = await response.json();
      return [{ op: "set", path: "data.todos", value: todos }];
    } catch (error) {
      return [
        { op: "set", path: "data.loadStatus", value: "error" },
        { op: "set", path: "data.errorMessage", value: error.message },
      ];
    }
  },

  "api.saveTodo": async (params, ctx) => {
    try {
      await fetch("/api/todos", {
        method: "POST",
        body: JSON.stringify(params),
      });
      return [{ op: "set", path: "data.saved", value: true }];
    } catch (error) {
      return [{ op: "set", path: "data.error", value: error.message }];
    }
  },
};

const app = createApp({
  schema: todoSchema,
  effects,
});
```

### MEL-Only Apps

For applications that use only MEL (no effects), provide an empty effects object:

```typescript
const app = createApp({
  schema: CounterMel,
  effects: {},
});
```

---

## Plugins

Plugins extend App functionality. They are async functions that receive the App instance.

### AppPlugin

```typescript
type AppPlugin = (app: App) => void | Promise<void>;
```

### Example

```typescript
const loggingPlugin: AppPlugin = async (app) => {
  app.hooks.on("action:completed", ({ proposalId, result }) => {
    console.log(`[Plugin] Action ${proposalId}:`, result.status);
  });
};

const app = createApp({
  schema: mel,
  effects: {},
  plugins: [loggingPlugin],
});
```

---

## Configuration Options

### ActorPolicyConfig

```typescript
interface ActorPolicyConfig {
  /** @default 'anonymous' */
  mode?: "anonymous" | "require";

  defaultActor?: {
    actorId: string;
    kind?: "human" | "agent" | "system";
    name?: string;
    meta?: Record<string, unknown>;
  };
}
```

### SchedulerConfig

```typescript
interface SchedulerConfig {
  /** Maximum concurrent actions */
  maxConcurrent?: number;

  /** Action execution timeout in ms */
  defaultTimeoutMs?: number;

  /** Serialize same-branch domain actions via FIFO queue. @default true */
  singleWriterPerBranch?: boolean;
}
```

### SystemActionsConfig

```typescript
interface SystemActionsConfig {
  /** @default true */
  enabled?: boolean;

  /** @default 'admin-only' */
  authorityPolicy?: "permissive" | "admin-only" | AuthorityPolicy;

  disabled?: readonly string[];
}
```

### DevtoolsConfig

```typescript
interface DevtoolsConfig {
  enabled?: boolean;
  name?: string;
}
```

---

## Related Documentation

- [Core Package](/api/core) - Domain schema and computation
- [Host Package](/api/host) - Effect execution specification
- [World Package](/api/world) - Governance and lineage
- [Getting Started](/quickstart) - Step-by-step tutorial
- [Effect Handlers](/guides/effect-handlers) - Detailed effect handler guide
