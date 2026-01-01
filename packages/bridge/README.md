# @manifesto-ai/bridge

> **Bridge** is the two-way binding layer of Manifesto. It routes external events to intents and delivers snapshot changes to subscribers.

---

## What is Bridge?

Bridge connects the outside world (UI, API, agents) to the Manifesto domain. It:
- Routes incoming events through Projections to create Intents
- Subscribes to Snapshot changes and notifies listeners
- Provides a framework-agnostic integration point

In the Manifesto architecture:

```
React/UI ──→ BRIDGE ──→ World
               │
    Routes events → Intents
    Delivers Snapshot → Subscribers
```

---

## What Bridge Does

| Responsibility | Description |
|----------------|-------------|
| Route events to intents | Transform SourceEvents into IntentBodies via Projections |
| Subscribe to changes | Deliver SnapshotView updates to subscribers |
| Manage projections | Register and execute projection functions |
| Issue intents | Create IntentInstances from IntentBodies |

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

## Bridge API

### Main Exports

```typescript
// Factory
function createBridge(config: BridgeConfig): Bridge;

// Bridge class
class Bridge {
  subscribe(callback: SnapshotSubscriber): Unsubscribe;
  dispatch(body: IntentBody): Promise<ProposalResult>;
  dispatchEvent(source: SourceEvent): Promise<ProposalResult | undefined>;
  registerProjection(projection: Projection): void;
  get(path: string): unknown;
  dispose(): void;
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
type SnapshotView = Readonly<{ data, computed, system, input, meta }>;
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
┌─────────────┐
│   BRIDGE    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    World    │ ← Bridge submits to World
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/world` | Submits proposals to World |
| Used by | `@manifesto-ai/react` | React hooks wrap Bridge |

---

## When to Use Bridge Directly

**Most users don't need to use Bridge directly.**

Use Bridge directly when:
- Building non-React UI integrations (Vue, Svelte, vanilla JS)
- Implementing custom event routing logic
- Building API endpoints that dispatch intents

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
