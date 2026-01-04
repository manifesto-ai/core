# @manifesto-ai/bridge

> **Bridge** is the two-way binding layer of Manifesto. It routes external events to intents, delivers snapshot changes to subscribers, and provides action catalogs for LLM/UI context injection.

---

## What is Bridge?

Bridge connects the outside world (UI, API, agents) to the Manifesto domain. It:
- Routes incoming events through Projections to create Intents
- Subscribes to Snapshot changes and notifies listeners
- Projects Action Catalogs for LLM/UI context injection (v1.1)
- Provides a framework-agnostic integration point

In the Manifesto architecture:

```
React/UI ──→ BRIDGE ──→ World
   │            │
   │   Routes events → Intents
   │   Delivers Snapshot → Subscribers
   │
LLM Agent ←── Action Catalog (v1.1)
```

---

## What Bridge Does

| Responsibility | Description |
|----------------|-------------|
| Route events to intents | Transform SourceEvents into IntentBodies via Projections |
| Subscribe to changes | Deliver SnapshotView updates to subscribers |
| Manage projections | Register and execute projection functions |
| Issue intents | Create IntentInstances from IntentBodies |
| Project action catalogs | Enumerate available actions with state-dependent availability (v1.1) |

---

## What Bridge Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| React-specific hooks | React package |
| Compute state transitions | Core |
| Execute effects | Host |
| Govern authority | World |

---

## Installation

```bash
npm install @manifesto-ai/bridge @manifesto-ai/world
# or
pnpm add @manifesto-ai/bridge @manifesto-ai/world
```

---

## Quick Example

```typescript
import { createBridge, createUISourceEvent } from "@manifesto-ai/bridge";
import { createManifestoWorld } from "@manifesto-ai/world";

// Create world and bridge
const world = createManifestoWorld({ schemaHash: "todo-v1", host });
const bridge = createBridge({
  world,
  schemaHash: world.schemaHash,
  defaultActor: { actorId: "user-1", kind: "human" },
});

// Register a projection
bridge.registerProjection({
  projectionId: "ui:todo-add",
  project(req) {
    if (req.source.payload?.action === "add") {
      return {
        kind: "intent",
        body: { type: "todo.add", input: req.source.payload.data },
      };
    }
    return { kind: "none" };
  },
});

// Subscribe to snapshot changes
const unsubscribe = bridge.subscribe((snapshot) => {
  console.log("Todos:", snapshot.data.todos);
});

// Dispatch an event
await bridge.dispatchEvent(
  createUISourceEvent("add-button", { action: "add", data: { title: "Buy milk" } })
);

// Or dispatch intent directly
await bridge.dispatch({ type: "todo.add", input: { title: "Walk dog" } });

// Clean up
unsubscribe();
bridge.dispose();
```

> See [GUIDE.md](../../docs/packages/bridge/GUIDE.md) for the full tutorial.

---

## Action Catalog (v1.1)

Action Catalog enables LLM agents and UIs to discover available actions based on current state:

```typescript
import {
  createBridge,
  createActionCatalogProjector,
} from "@manifesto-ai/bridge";

// Create bridge with catalog projector
const bridge = createBridge({
  world,
  schemaHash: world.schemaHash,
  defaultActor: { actorId: "agent-1", kind: "agent" },
  catalogProjector: createActionCatalogProjector(),
});

await bridge.refresh();

// Define actions with availability predicates
const actions = [
  {
    type: "todo.create",
    label: "Create Todo",
    description: "Creates a new todo item",
    inputSchema: { type: "object", properties: { title: { type: "string" } } },
  },
  {
    type: "todo.delete",
    label: "Delete Todo",
    description: "Deletes a todo item",
    // Available only when canDelete is true
    available: { kind: "get", path: "computed.canDelete" },
  },
  {
    type: "admin.reset",
    label: "Reset All",
    description: "Resets all todos (admin only)",
    available: {
      kind: "fn",
      evaluate: (ctx) => ctx.data.user?.role === "admin",
    },
  },
];

// Project catalog for LLM context
const catalog = await bridge.projectActionCatalog(actions, {
  mode: "llm",
  pruning: {
    policy: "drop_unavailable",  // Filter unavailable actions
    includeUnknown: true,        // Include actions with unknown status
    sort: "type_lex",            // Sort alphabetically
  },
});

// Use catalog in LLM prompt
console.log(catalog.actions);
// [
//   { type: "todo.create", label: "Create Todo", availability: { status: "available" } },
//   { type: "admin.reset", label: "Reset All", availability: { status: "available" } },
// ]

// LLM selects action, then dispatch
await bridge.dispatch({
  type: "todo.create",
  input: { title: "Task from LLM" },
});
```

### Availability Predicates

| Type | Description | Example |
|------|-------------|---------|
| `null` / `undefined` | Always available | `{ type: "action" }` |
| `ExprNode` | MEL-compiled expression | `{ kind: "get", path: "computed.canEdit" }` |
| `fn` | Runtime function (non-portable) | `{ kind: "fn", evaluate: (ctx) => ctx.data.role === "admin" }` |

### Pruning Options

| Option | Default | Description |
|--------|---------|-------------|
| `policy` | `"drop_unavailable"` | `"drop_unavailable"` or `"mark_only"` |
| `includeUnknown` | `true` | Include actions with unknown availability |
| `maxActions` | `null` | Limit number of actions |
| `sort` | `"type_lex"` | `"type_lex"` or `"schema_order"` |

---

## Bridge API

### Main Exports

```typescript
// Factory
function createBridge(config: BridgeConfig): Bridge;

// Bridge class
class Bridge {
  // Subscription
  subscribe(callback: SnapshotSubscriber): Unsubscribe;
  get(path: string): unknown;
  getSnapshot(): SnapshotView | null;
  refresh(): Promise<void>;

  // Dispatch
  dispatch(body: IntentBody): Promise<void>;
  dispatchEvent(source: SourceEvent): Promise<ProjectionResult>;
  set(path: string, value: unknown): Promise<void>;

  // Projections
  registerProjection(projection: Projection): void;
  unregisterProjection(projectionId: string): boolean;

  // Action Catalog (v1.1)
  projectActionCatalog(actions, options?): Promise<ActionCatalog | null>;
  hasActionCatalog(): boolean;

  // Lifecycle
  dispose(): void;
  isDisposed(): boolean;
}

// SourceEvent factories
function createUISourceEvent(eventId, payload): SourceEvent;
function createAPISourceEvent(eventId, payload): SourceEvent;
function createAgentSourceEvent(eventId, payload): SourceEvent;
function createSystemSourceEvent(eventId, payload): SourceEvent;

// Projection types
type Projection = {
  projectionId: string;
  project(req: ProjectionRequest): ProjectionResult;
};
type ProjectionResult = { kind: "intent"; body: IntentBody } | { kind: "none" };

// Snapshot view
type SnapshotView = Readonly<{ data, computed }>;

// Action Catalog types (v1.1)
type ActionDescriptor = {
  type: string;
  label?: string;
  description?: string;
  inputSchema?: unknown;
  available?: AvailabilityPredicate;
};
type ActionCatalog = {
  kind: "action_catalog";
  schemaHash: string;
  catalogHash: string;
  actions: ProjectedAction[];
};
function createActionCatalogProjector(): ActionCatalogProjector;
```

> See [SPEC.md](../../docs/packages/bridge/SPEC.md) for complete API reference.

---

## Core Concepts

### Projections

Projections transform external events into domain intents:

```typescript
bridge.registerProjection({
  projectionId: "ui:form-submit",
  project(req) {
    const { payload } = req.source;

    // Map form submission to intent
    if (payload.formId === "login") {
      return {
        kind: "intent",
        body: { type: "auth.login", input: payload.values },
      };
    }

    // Ignore unhandled events
    return { kind: "none" };
  },
});
```

### SourceEvent Kinds

| Kind | Description | Example |
|------|-------------|---------|
| `ui` | User interface events | Button clicks, form submissions |
| `api` | External API calls | Webhook, REST endpoint |
| `agent` | AI agent actions | LLM-generated intents |
| `system` | System-generated events | Timers, startup events |

### SnapshotView

Subscribers receive a `SnapshotView` - a frozen, read-only view of the current snapshot.

---

## Relationship with Other Packages

```
┌─────────────┐
│    React    │ ← Uses Bridge for bindings
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   BRIDGE    │ ←── │  Compiler   │ (v1.1: ExprNode evaluation)
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│    World    │ ← Bridge submits to World
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/world` | Submits proposals to World |
| Depends on | `@manifesto-ai/compiler` | Evaluates ExprNode availability predicates (v1.1) |
| Used by | `@manifesto-ai/react` | React hooks wrap Bridge |

---

## When to Use Bridge Directly

**Most users don't need to use Bridge directly.**

Use Bridge directly when:
- Building non-React UI integrations (Vue, Svelte, vanilla JS)
- Implementing custom event routing logic
- Building API endpoints that dispatch intents
- Building LLM agents that need action catalogs (v1.1)

For React applications, see [`@manifesto-ai/react`](../react/).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](../../docs/packages/bridge/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](docs/SPEC.md) | Complete specification |
| [FDR.md](docs/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
