# Manifesto vs. Other State Management Solutions

> **Status:** Stable
> **Last Updated:** 2026-01

---

## What Is Manifesto?

Before comparing, let's establish what Manifesto IS:

> **Manifesto is a semantic state layer for building AI-governed applications with deterministic computation and full accountability.**

It separates:
- **Pure computation** (Core) — What should change
- **Effect execution** (Host) — Making changes happen
- **Governance** (World) — Who can change what, and why

**The fundamental equation:**

```
compute(schema, snapshot, intent, context) → (snapshot', requirements, trace)
```

This equation is pure, deterministic, traceable, and complete.

---

## Manifesto Is NOT

Before we compare, let's be clear about what Manifesto is NOT:

```
Manifesto IS:
  ✓ A semantic calculator for domain state
  ✓ Schema-first and JSON-serializable
  ✓ Deterministic and reproducible
  ✓ Explainable at every step
  ✓ Pure (no side effects in Core)
  ✓ Host-agnostic

Manifesto IS NOT:
  ✗ An execution runtime
  ✗ A Turing-complete language
  ✗ An exception-throwing system
  ✗ A framework with hidden state
  ✗ A workflow orchestrator
  ✗ An agent framework
  ✗ Just another state manager
```

---

## Comparison Matrix

| Feature | Manifesto | Redux | Zustand | MobX | XState | Event Sourcing |
|---------|-----------|-------|---------|------|--------|----------------|
| **Determinism** | Guaranteed | Partial | No | No | Partial | Partial |
| **Effect Handling** | Explicit declarations | Thunks/middleware | Ad-hoc | Reactions | Services | External |
| **Governance** | Built-in (World) | None | None | None | None | External |
| **AI-Native** | Yes | No | No | No | No | No |
| **Accountability** | Full audit trail | Partial | None | None | Partial | Yes |
| **Time-Travel** | Yes (replay) | Yes (dev tools) | No | No | Yes | Yes (replay events) |
| **Type Safety** | Full (Zod-first) | Partial | Partial | Partial | Partial | Varies |
| **Testability** | No mocks needed | Requires mocks | Requires mocks | Requires mocks | Requires mocks | Varies |
| **Learning Curve** | Steep | Moderate | Low | Moderate | Steep | Steep |

---

## Manifesto vs. Redux

### What Redux Does Well

Redux excels at:
- **Predictable state updates**: Single store, pure reducers
- **DevTools**: Excellent time-travel debugging
- **Ecosystem**: Massive community, many integrations
- **Simplicity**: Core concepts are straightforward

### Where Manifesto Differs

#### 1. Pure Computation vs. Mixed Side Effects

**Redux:**
```typescript
// Reducer is pure
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, action.payload] };
  }
}

// But side effects are mixed in via middleware
function addTodoThunk(text) {
  return async (dispatch) => {
    dispatch({ type: 'ADD_TODO_START' });
    try {
      const result = await api.addTodo(text);  // Side effect!
      dispatch({ type: 'ADD_TODO_SUCCESS', payload: result });
    } catch (error) {
      dispatch({ type: 'ADD_TODO_ERROR', error });
    }
  };
}
```

**Manifesto:**
```typescript
// Flow is pure - declares effects, doesn't execute them
flow: ({ flow, state, effect }) =>
  flow.seq([
    flow.patch(state.todos).set(
      expr.concat(state.todos, [newTodo])
    ),
    effect('api:addTodo', { todo: newTodo })  // Declaration only
  ]);

// Host executes effects separately
host.registerEffect('api:addTodo', async (params) => {
  const result = await api.addTodo(params.todo);
  return [
    { op: 'set', path: 'todos.0.serverId', value: result.id }
  ];
});
```

**Why this matters:**
- Manifesto Core is **completely pure** (testable without mocks)
- Redux mixes pure reducers with impure middleware
- Manifesto has no "thunk" concept—effects are data, not code

#### 2. Governance

**Redux:** No built-in governance. All dispatches are equal.

**Manifesto:** Built-in authority system (World):
```typescript
// Define who can do what
world.registerAuthority('todos:delete', async (proposal, context) => {
  if (context.actor.role !== 'admin') {
    return { approved: false, reason: 'Only admins can delete' };
  }
  return { approved: true };
});
```

**Use Redux when:** Governance is not needed (simple apps, trusted environments)

**Use Manifesto when:** You need accountability, audit trails, or AI agent governance

#### 3. Deterministic Replay

**Redux:** Can replay actions, but:
- Side effects in middleware make replay non-deterministic
- No guaranteed same output from same input if middleware has state

**Manifesto:** Guaranteed deterministic replay:
- Same schema + same snapshot + same intent = same result
- No hidden state in middleware
- Trace is complete and reproducible

### Migration Path

**You can use both:**

```typescript
function App() {
  return (
    <ReduxProvider store={reduxStore}>
      <ManifestoApp.Provider>
        {/* Migrate incrementally */}
        <LegacyFeature />  {/* Redux */}
        <NewFeature />     {/* Manifesto */}
      </ManifestoApp.Provider>
    </ReduxProvider>
  );
}
```

**When to choose Redux:**
- Simple UI state management
- Well-understood patterns
- Large ecosystem needed
- No AI governance required

**When to choose Manifesto:**
- Deterministic computation required
- AI agent integration
- Full accountability needed
- Complex domain logic with effects

---

## Manifesto vs. Zustand

### What Zustand Does Well

Zustand excels at:
- **Simplicity**: Minimal boilerplate
- **Flexibility**: Use hooks directly
- **Small bundle size**: Lightweight
- **Low learning curve**: Easy to get started

### Where Manifesto Differs

#### 1. Determinism

**Zustand:**
```typescript
const useStore = create((set) => ({
  todos: [],
  addTodo: async (text) => {
    const result = await api.addTodo(text);  // Non-deterministic
    set((state) => ({ todos: [...state.todos, result] }));
  }
}));
```

**Problems:**
- `addTodo` is non-deterministic (network call)
- Cannot replay with guaranteed same result
- Cannot test without mocking API

**Manifesto:**
```typescript
// Pure, deterministic Flow
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
// Same inputs → same outputs, always
```

#### 2. Explainability

**Zustand:** State changes are opaque. "How did this value get here?" requires manual tracing.

**Manifesto:** Every value can answer "why?":
```typescript
const result = core.explain(schema, snapshot, 'todos.0.completed');
// Returns trace showing how value was derived
```

#### 3. Accountability

**Zustand:** No built-in audit trail. Who changed what, when, why?

**Manifesto:** Full accountability:
- Every intent records actor, authority, timestamp
- World maintains lineage DAG
- Complete audit trail

**When to choose Zustand:**
- Simple local state
- No governance needed
- Speed of development > determinism
- Small apps with trusted users

**When to choose Manifesto:**
- Deterministic computation required
- AI governance needed
- Full audit trail required
- Complex domain logic

---

## Manifesto vs. MobX

### What MobX Does Well

MobX excels at:
- **Reactive programming**: Automatic dependency tracking
- **Natural syntax**: Direct mutation (looks imperative)
- **Performance**: Fine-grained reactivity
- **Low boilerplate**: Less code than Redux

### Where Manifesto Differs

#### 1. Hidden State vs. Explicit State

**MobX:**
```typescript
class TodoStore {
  @observable todos = [];

  @action
  addTodo(text) {
    // Direct mutation (looks simple)
    this.todos.push({ id: Date.now(), text, completed: false });
  }

  @computed
  get activeTodos() {
    return this.todos.filter(t => !t.completed);
  }
}
```

**Problems:**
- State is mutable (hidden changes)
- Computed tracking is implicit (magic)
- Cannot serialize the store's computation logic

**Manifesto:**
```typescript
// Snapshot is immutable
// All changes are explicit patches
// Computed is explicit DAG
{
  "computed": {
    "fields": {
      "computed.activeTodos": {
        "deps": ["todos"],
        "expr": {
          "kind": "filter",
          "array": { "kind": "get", "path": "todos" },
          "predicate": { "kind": "not", "arg": { "kind": "get", "path": "$item.completed" } }
        }
      }
    }
  }
}
```

#### 2. Determinism

**MobX:** Reactions can have side effects, making behavior non-deterministic:

```typescript
reaction(
  () => store.todos.length,
  (length) => {
    if (length > 10) {
      api.saveTodos(store.todos);  // Side effect in reaction
    }
  }
);
```

**Manifesto:** All side effects are explicit declarations, executed by Host.

#### 3. Serializability

**MobX:** Cannot serialize the store's logic (reactions, computeds are JavaScript functions).

**Manifesto:** Everything is JSON-serializable schema. Can:
- Store schemas in database
- Send schemas over network
- Version schemas
- Generate schemas from AI

**When to choose MobX:**
- Reactive UI with complex derived state
- Natural imperative syntax preferred
- Don't need to serialize logic
- No governance required

**When to choose Manifesto:**
- Schema must be serializable
- Determinism required
- AI-generated logic
- Full accountability

---

## Manifesto vs. XState

### What XState Does Well

XState excels at:
- **Finite state machines**: Explicit state transitions
- **Visualization**: State charts
- **Predictable behavior**: Defined states and transitions
- **Complex workflows**: Nested states, parallel states

### Where Manifesto Differs

#### 1. FSM vs. Semantic State

**XState:** Models state as a finite state machine.

```typescript
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      on: {
        SUCCESS: 'success',
        ERROR: 'error'
      }
    },
    success: { on: { FETCH: 'loading' } },
    error: { on: { RETRY: 'loading' } }
  }
});
```

**Manifesto:** Models domain state directly, not as FSM.

```typescript
// State is semantic, not FSM
state: {
  todos: z.array(TodoSchema),
  syncStatus: z.enum(['idle', 'syncing', 'synced', 'error']),
  errorMessage: z.string().optional()
}
```

**Why this matters:**
- XState is great for **workflow-oriented** problems (login flow, checkout, etc.)
- Manifesto is great for **domain-oriented** problems (todo app, inventory, user profiles)

#### 2. Effects

**XState:** Effects are services (can be invoked actors, callbacks, etc.)

**Manifesto:** Effects are pure declarations, executed by Host

#### 3. AI Integration

**XState:** State machines are defined in code, hard to generate dynamically.

**Manifesto:** Schemas are JSON, easy for AI to generate/modify.

**When to choose XState:**
- Workflow-heavy applications
- Clear FSM model fits problem
- Visualization important
- No AI generation needed

**When to choose Manifesto:**
- Domain-centric applications
- AI agent governance
- Schema must be serializable
- Deterministic replay required

---

## Manifesto vs. Event Sourcing

### What Event Sourcing Does Well

Event Sourcing excels at:
- **Audit trail**: Complete history of events
- **Temporal queries**: Query state at any point in time
- **Event replay**: Rebuild state from events
- **CQRS**: Separate read/write models

### Where Manifesto Differs

#### 1. Intents vs. Events

**Event Sourcing:** Stores **what happened** (facts).

```typescript
// Event log
[
  { type: 'TodoAdded', todoId: '1', text: 'Buy milk', timestamp: 1000 },
  { type: 'TodoCompleted', todoId: '1', timestamp: 2000 },
  { type: 'TodoDeleted', todoId: '1', timestamp: 3000 }
]
```

**Manifesto:** Stores **what was intended** and **what resulted** (Intents + Worlds).

```typescript
// Intent + World
Intent: { type: 'addTodo', input: { text: 'Buy milk' }, actor: 'user123' }
World: { snapshot, actor, authority, decision, timestamp }
```

**Key difference:**

| Aspect | Event Sourcing | Manifesto |
|--------|---------------|-----------|
| Stored | Events (facts) | Intents + Worlds |
| Replay | Replay events | Replay intents |
| Authority | Events are authoritative | World is authoritative |
| Granularity | Per-event | Per-intent |

#### 2. State Reconstruction

**Event Sourcing:** Rebuild state by replaying all events.

```typescript
let state = {};
for (const event of events) {
  state = applyEvent(state, event);  // Fold over events
}
```

**Manifesto:** World is the source of truth (snapshot is stored).

```typescript
const world = await worldStore.getWorld(worldId);
const snapshot = world.snapshot;  // State is materialized
```

**Trade-off:**
- Event Sourcing: Smaller storage (events), longer reconstruction time
- Manifesto: Larger storage (snapshots), instant access

#### 3. Governance

**Event Sourcing:** Governance is external (apply before writing events).

**Manifesto:** Governance is built-in (World Protocol).

```typescript
// Manifesto
const proposal = await world.submitProposal(actor, intent);
// Authority evaluates before execution
```

**When to choose Event Sourcing:**
- Temporal queries essential
- Event log is the primary model
- CQRS architecture
- Event-driven integration

**When to choose Manifesto:**
- AI agent governance
- Deterministic computation
- Intent-based model fits better
- Instant state access required

---

## Manifesto vs. Traditional Workflow Orchestrators

### What Workflow Orchestrators Do Well

Systems like Temporal, Airflow, or Camunda excel at:
- **Long-running workflows**: Durable execution
- **Retry logic**: Built-in failure recovery
- **Distributed execution**: Scale across machines
- **Activity orchestration**: Coordinate multiple services

### Where Manifesto Differs

#### 1. Not a Workflow Orchestrator

**Manifesto is NOT a workflow orchestrator.** It is a semantic state calculator.

**Workflow orchestrators:**
- Focus on **executing** workflows
- Manage **durable processes**
- Coordinate **distributed services**

**Manifesto:**
- Focus on **computing** state transitions
- Manage **semantic state**
- Coordinate **pure computation** (Host executes)

#### 2. Turing-Completeness

**Workflow orchestrators:** Typically Turing-complete (can express unbounded loops).

**Manifesto:** Flows are NOT Turing-complete (no while/for loops).

**Why?**
- Guaranteed termination
- Static analysis possible
- Complete, finite traces

For unbounded iteration, Host controls the loop.

#### 3. Execution Model

**Workflow orchestrators:** Suspend/resume execution (long-running activities).

**Manifesto:** No suspended context. Each `compute()` is complete and independent.

**When to choose Workflow Orchestrators:**
- Long-running processes (hours/days)
- Distributed execution
- Durable workflows
- Retry/compensation built-in

**When to choose Manifesto:**
- Semantic state management
- Deterministic computation
- AI governance
- Short-lived computations (ms/seconds)

---

## When to Use Manifesto

### Perfect Fit

Manifesto is a **perfect fit** when you need:

1. **Deterministic computation**: Same input → same output, always
2. **AI governance**: LLM agents proposing/executing actions with authority checks
3. **Full accountability**: Who did what, when, why?
4. **Explainability**: Every value can answer "how did I get here?"
5. **Testability without mocks**: Pure Core, testable in isolation
6. **Schema-first design**: All logic as serializable data
7. **Time-travel debugging**: Replay any computation deterministically

### Good Fit

Manifesto is a **good fit** when you need:

- Complex domain logic with effects
- Multi-actor systems with authorization
- Audit trails and compliance
- Reproducible computation
- Effect isolation and testing

### Poor Fit

Manifesto is a **poor fit** when:

- Simple local UI state only (use Zustand, useState)
- Rapid prototyping with no governance (use Redux, MobX)
- Workflow orchestration (use Temporal, Airflow)
- Event-driven architecture (use Event Sourcing)
- Real-time collaborative editing (use CRDT libraries)

---

## Decision Tree

```
Do you need deterministic computation?
├── No → Use Redux/Zustand/MobX
└── Yes
    │
    Do you need AI governance?
    ├── No
    │   │
    │   Do you need accountability/audit trails?
    │   ├── No → Use XState (if FSM fits) or Redux
    │   └── Yes → Use Manifesto or Event Sourcing
    │
    └── Yes → Use Manifesto
```

### Detailed Decision

**Use Redux if:**
- Standard web app
- Well-understood patterns
- Large ecosystem needed
- No AI governance

**Use Zustand if:**
- Simple state management
- Minimal boilerplate
- Small bundle size
- Quick prototyping

**Use MobX if:**
- Reactive UI with complex derived state
- Natural imperative syntax preferred
- Fine-grained reactivity needed

**Use XState if:**
- Workflow-oriented problem
- FSM model fits naturally
- Visualization important
- Nested/parallel states

**Use Event Sourcing if:**
- Temporal queries essential
- Event log is primary model
- CQRS architecture
- Event-driven integration

**Use Manifesto if:**
- Deterministic computation required
- AI agent governance needed
- Full accountability essential
- Schema must be serializable
- Complex domain logic with effects

---

## Migration Strategies

### From Redux

1. **Phase 1:** Add Manifesto alongside Redux
2. **Phase 2:** Migrate one feature at a time
3. **Phase 3:** Remove Redux when fully migrated

```typescript
// Coexistence
function App() {
  return (
    <ReduxProvider store={reduxStore}>
      <ManifestoApp.Provider>
        <LegacyFeature />  {/* Redux */}
        <NewFeature />     {/* Manifesto */}
      </ManifestoApp.Provider>
    </ReduxProvider>
  );
}
```

### From Zustand

1. **Identify domain boundaries**: What state is domain vs. UI?
2. **Model domain state**: Define schema for domain state
3. **Convert actions to intents**: Map Zustand actions to Manifesto intents
4. **Implement effects**: Extract side effects into effect handlers

### From MobX

1. **Extract stores**: Identify domain stores
2. **Convert observables to state schema**: Map MobX observables to Manifesto state
3. **Convert computed to Manifesto computed**: Map `@computed` to ComputedSpec
4. **Convert actions to flows**: Map `@action` to FlowSpec

---

## Common Misconceptions

### "Manifesto is just Redux with extra steps"

**False.** Key differences:

- Redux: Mixed computation/execution
- Manifesto: Pure computation, separate execution

- Redux: No built-in governance
- Manifesto: Built-in World Protocol

- Redux: Partial determinism
- Manifesto: Guaranteed determinism

### "Manifesto is overkill for simple apps"

**True.** For simple apps with:
- No governance
- No accountability requirements
- No AI agents
- Simple UI state only

Use Zustand or useState. Manifesto is designed for complex domains with governance needs.

### "Manifesto replaces my backend"

**False.** Manifesto is a **semantic state layer**, not a backend.

You still need:
- Database (for persistence)
- API server (for HTTP endpoints)
- Authentication (for users)

Manifesto coordinates **how your frontend reasons about domain state** and **how AI agents interact** with your system.

### "Manifesto is event sourcing"

**False.** See [comparison above](#manifesto-vs-event-sourcing).

Key difference: We store **intents + worlds**, not events.

---

## Summary

**Manifesto's unique value proposition:**

1. **Deterministic computation** (same input → same output)
2. **AI-native governance** (World Protocol + Authority)
3. **Full accountability** (who, what, when, why)
4. **Schema-first** (all logic as serializable data)
5. **Explainable** (every value can answer "why?")
6. **Testable without mocks** (pure Core)

**When to choose Manifesto:**

- You need deterministic computation
- You're building AI-governed applications
- You need full accountability/audit trails
- You want schema-first, serializable logic
- You need time-travel debugging that actually works

**When NOT to choose Manifesto:**

- Simple UI state management (use Zustand)
- Rapid prototyping (use Redux)
- Workflow orchestration (use Temporal)
- Event-driven architecture (use Event Sourcing)
- Real-time collaboration (use CRDTs)

**The bottom line:**

Manifesto is not "better" than Redux/Zustand/MobX—it solves a **different class of problems**. It's designed for systems where **determinism, governance, and accountability are non-negotiable**.

If you need those guarantees, Manifesto provides them structurally. If you don't, simpler tools may be a better fit.

---

## Related Documents

- [What Is Manifesto?](/what-is-manifesto/) — Overview and introduction
- [Architecture](/architecture/) — System architecture
- [Core FDR](/rationale/core-fdr) — Design rationale
- [Getting Started](/guides/getting-started) — First steps with Manifesto

---

*End of Comparison Document*
