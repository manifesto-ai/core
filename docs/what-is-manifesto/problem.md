# The Problem Manifesto Solves

> **Purpose:** Understand what problem Manifesto solves and whether you need it
> **Reading time:** 8-10 minutes

---

## A Tale of Two Systems

Imagine you're building a todo application. A user reports: "I clicked 'Delete All Completed', but some todos remained."

### In a Traditional System

You start debugging:

```typescript
// Somewhere in TodoList.tsx
const handleDeleteCompleted = async () => {
  const completed = todos.filter(t => t.completed);
  for (const todo of completed) {
    await deleteTodo(todo.id);  // Where does this go?
  }
  setTodos(todos.filter(t => !t.completed));  // Race condition?
};
```

**Questions you can't easily answer:**
- Did the API call succeed?
- Did another action run concurrently?
- What was the exact state when the button was clicked?
- Can you reproduce this locally?
- Who authorized this deletion?

You add logging, check network tabs, try to reproduce, maybe add Sentry. Eventually, you guess it's a race condition. You add optimistic updates, maybe Redux, maybe a loading flag. The bug seems fixed... until it happens again.

### In Manifesto

```typescript
// Domain definition
const { deleteCompleted } = actions.define({
  deleteCompleted: {
    flow: flow.onceNull(state.deletingCompleted, ({ patch, effect }) => {
      patch(state.deletingCompleted).set(expr.input('timestamp'));
      effect('api:deleteCompleted', {
        ids: expr.map(
          expr.filter(state.todos, t => t.completed),
          t => t.id
        )
      });
    }),
  },
});
```

MEL equivalent:

```mel
domain TodoDomain {
  type TodoItem = { id: string, completed: boolean }

  state {
    todos: Array<TodoItem> = []
    deletingCompleted: number | null = null
  }

  action deleteCompleted(timestamp: number) {
    when isNull(deletingCompleted) {
      patch deletingCompleted = timestamp
      effect api:deleteCompleted({
        ids: map(filter(todos, $item.completed), $item.id)
      })
    }
  }
}
```

**When the bug is reported:**

1. Load the trace: `trace.load('user-123-action-456')`
2. See exact snapshot before action
3. See exact authority evaluation
4. See exact effect that was declared
5. Replay computation: same input → same output
6. Root cause identified in 5 minutes

**The difference?** Manifesto guarantees that every state change is:
- **Deterministic** (reproducible)
- **Traceable** (who, what, when, why)
- **Governed** (who authorized this?)
- **Explainable** (why is this value what it is?)

---

## The Three Core Problems

Modern application state has three fundamental problems that become catastrophic when AI agents enter the picture.

### Problem 1: Unpredictability

**The Symptom:**

```typescript
// Redux thunk
function addTodo(text) {
  return async (dispatch, getState) => {
    dispatch({ type: 'ADD_TODO_START' });

    try {
      const result = await api.addTodo(text);  // Network call
      dispatch({ type: 'ADD_TODO_SUCCESS', payload: result });
    } catch (error) {
      dispatch({ type: 'ADD_TODO_ERROR', error });
    }
  };
}
```

**What's the problem?**

1. **Non-deterministic**: Same inputs can produce different outputs (network failures, timing)
2. **Hidden execution context**: `getState()` and `dispatch()` are implicit dependencies
3. **Untestable without mocks**: Must mock `api`, `dispatch`, `getState`
4. **No replay**: Can't reproduce what happened in production

**Why this matters for AI:**

When an LLM generates or modifies this code:
- How does it know the side effects are safe?
- How does it test the generated code?
- How does it reason about failure modes?
- How does it explain what went wrong?

It can't. The logic is opaque.

**Manifesto's solution:**

```typescript
// Flow is pure data
flow: flow.seq(
  flow.patch(state.loading).set(expr.lit(true)),
  flow.effect('api:addTodo', { text: expr.input('text') })  // Declaration only
);
```

MEL equivalent:

```mel
domain Example {
  state {
    loading: boolean = false
  }

  action addTodo(text: string) {
    patch loading = true
    effect api:addTodo({ text: text })
  }
}
```

- **Deterministic**: Same flow definition → same patches/effects
- **Explicit**: No hidden context
- **Testable**: Core is pure, no mocks needed
- **Replayable**: Given same snapshot + intent → same result

### Problem 2: Unaccountability

**The Symptom:**

A production incident occurs. You need to answer:
- Who deleted this record?
- What was the state before deletion?
- Why was this user allowed to delete?
- Can we undo this action?

In traditional systems:

```typescript
// Somewhere in the codebase
await db.delete('todos', id);  // Who called this? Why?
```

You scramble to add logging:

```typescript
logger.info('Deleting todo', { id, userId: req.user.id });
await db.delete('todos', id);
```

But logging is:
- **Incomplete**: Did you log the state before deletion?
- **Ad-hoc**: Every developer logs differently
- **After-the-fact**: Can't undo
- **Unstructured**: Hard to query

**Why this matters for AI:**

When an AI agent acts autonomously:
- How do you know what it did?
- How do you know why it was allowed?
- How do you roll back mistakes?
- How do you audit compliance?

You can't. There's no built-in accountability.

**Manifesto's solution:**

```typescript
// Every action goes through World Protocol
const proposal = await world.submitProposal(actor, intent);

// Authority evaluates
world.registerAuthority('todos:delete', async (proposal, context) => {
  if (context.actor.role !== 'admin') {
    return { approved: false, reason: 'Only admins can delete' };
  }
  return { approved: true };
});

// Decision is recorded
world.getDecision(proposalId);
// → { actor, authority, decision: 'approved', reason: '...', timestamp }
```

Every action has:
- **Actor**: Who proposed it
- **Authority**: Who approved it
- **Intent**: What was requested
- **Snapshot (before)**: State before action
- **Snapshot (after)**: State after action
- **Trace**: How we got from before → after

Full accountability, built-in.

### Problem 3: Untestability

**The Symptom:**

You want to test business logic. But:

```typescript
// Function depends on database
async function createUser(data) {
  const existing = await db.users.findOne({ email: data.email });
  if (existing) throw new Error('Email already exists');

  const user = await db.users.create(data);
  await emailService.sendWelcome(user.email);

  return user;
}
```

To test this, you must:
1. Mock database
2. Mock email service
3. Set up test fixtures
4. Hope mocks match reality

**The problems:**
- **Brittle**: Mocks break when implementation changes
- **Incomplete**: Can't test all code paths easily
- **Slow**: Database setup is expensive
- **Non-deterministic**: Tests can flake

**Why this matters for AI:**

When an LLM generates code:
- How does it verify correctness?
- How does it test edge cases?
- How does it ensure no regressions?

It can't effectively test impure code.

**Manifesto's solution:**

```typescript
// Core is pure - no mocks needed
it('creates user', () => {
  const result = await core.compute(schema, snapshot, {
    type: 'createUser',
    input: { email: 'test@example.com' }
  });

  expect(result.snapshot.data.users).toHaveLength(1);
  expect(result.requirements).toEqual([
    { type: 'api:sendWelcomeEmail', params: { email: 'test@example.com' } }
  ]);
});
```

No mocks. No database. No email service. Pure computation.

Effects are declared but not executed. Testing is:
- **Fast**: Pure functions are instant
- **Deterministic**: Same input → same output
- **Complete**: Easy to test all branches
- **Reliable**: No flaky tests

---

## How Manifesto Addresses These Problems

### Solution 1: Determinism by Design

**Principle:** Core computes. Host executes.

```
┌──────────────────────────────────────────────┐
│ Core (Pure Computation)                      │
│                                              │
│ compute(schema, snapshot, intent, context)   │
│   → (snapshot', requirements, trace)         │
│                                              │
│ - No IO                                      │
│ - No side effects                            │
│ - Same input → same output                   │
│ - Fully serializable                         │
└──────────────────────────────────────────────┘
                    ↓
         Returns requirements
                    ↓
┌──────────────────────────────────────────────┐
│ Host (Execution)                             │
│                                              │
│ executeEffect(requirement)                   │
│   → patches[]                                │
│                                              │
│ - Executes IO                                │
│ - Handles failures                           │
│ - Returns patches (not values)               │
└──────────────────────────────────────────────┘
```

**Benefits:**
- Core is testable without mocks
- Replay is guaranteed to work
- Time-travel debugging is reliable
- AI can reason about computation

### Solution 2: Built-in Accountability

**Principle:** All intents go through World Protocol.

```
Intent → Proposal → Authority → Decision → Execution → World (committed)
```

Every committed World records:
- **Actor**: Who submitted the intent
- **Authority**: Who/what approved it
- **Decision**: Approved or rejected
- **Reason**: Why it was approved/rejected
- **Snapshot (before)**: State before execution
- **Snapshot (after)**: State after execution
- **Trace**: Complete execution trace

**Benefits:**
- Full audit trail
- Can answer "who, what, when, why" for any change
- Can replay any decision
- Can implement compliance requirements
- Can safely authorize AI agents

### Solution 3: Pure Computation

**Principle:** Snapshot is the only communication medium.

```typescript
// WRONG: Effect returns value
const result = await executeEffect();
const context = { now: 0, randomSeed: "seed" };
await core.compute(schema, snapshot, { ...intent, result }, context);  // Hidden channel!

// RIGHT: Effect returns patches
const patches = await executeEffect();
snapshot = core.apply(schema, snapshot, patches, context);
await core.compute(schema, snapshot, intent, context);  // Reads from Snapshot
```

**Benefits:**
- No hidden state
- Complete state visibility
- Serializable (save entire world)
- Reproducible (reload and replay)

---

## Real-World Scenarios

### Scenario 1: AI Code Review Bot

**Problem:** You want an AI to review pull requests and suggest changes.

**Traditional approach:**
```typescript
// AI generates code, you run it blindly
const suggestion = await llm.generateCode(diff);
eval(suggestion);  // 😱 What could go wrong?
```

**Risks:**
- Non-deterministic (different results each run)
- No authority checks (AI can do anything)
- No audit trail (what did the AI actually do?)
- Untestable (can't verify AI's code before running)

**Manifesto approach:**

```typescript
// AI generates Intent (data)
const intent = await llm.generateIntent(diff);
// → { type: 'refactorFunction', input: { ... } }

// Submit through World Protocol
const proposal = await world.submitProposal(aiActor, intent);

// Authority evaluates (human approval required)
world.registerAuthority('code:refactor', async (proposal) => {
  const human = await promptHuman(proposal);
  return human.approved ? { approved: true } : { approved: false };
});

// If approved, deterministic execution
if (proposal.approved) {
  const context = { now: 0, randomSeed: "seed" };
  const result = await core.compute(schema, snapshot, intent, context);
  // Replay is guaranteed to produce same result
}
```

**Benefits:**
- AI can't execute directly (must propose)
- Humans control authorization
- Complete audit trail
- Deterministic (same proposal → same result)

### Scenario 2: Multi-Tenant SaaS

**Problem:** Different tenants have different permissions.

**Traditional approach:**

```typescript
// Permission checks scattered everywhere
async function deleteTodo(todoId, userId) {
  const todo = await db.todos.findOne(todoId);
  const user = await db.users.findOne(userId);

  if (todo.tenantId !== user.tenantId) {
    throw new Error('Unauthorized');
  }

  if (user.role !== 'admin' && todo.createdBy !== userId) {
    throw new Error('Unauthorized');
  }

  await db.todos.delete(todoId);
}
```

**Problems:**
- Permission logic mixed with business logic
- Easy to forget checks
- Hard to audit ("did we check permissions here?")
- No centralized policy

**Manifesto approach:**

```typescript
// Centralized authority
world.registerAuthority('todos:delete', async (proposal, context) => {
  const todo = context.snapshot.data.todos.find(t => t.id === proposal.input.id);

  // Tenant check
  if (todo.tenantId !== context.actor.tenantId) {
    return { approved: false, reason: 'Cross-tenant access denied' };
  }

  // Role check
  if (context.actor.role !== 'admin' && todo.createdBy !== context.actor.id) {
    return { approved: false, reason: 'Not authorized' };
  }

  return { approved: true };
});
```

**Benefits:**
- Centralized authorization
- Consistent policy enforcement
- Full audit trail
- Easy to test authority logic

### Scenario 3: Debugging Production

**Problem:** Production bug that's hard to reproduce.

**Traditional approach:**

1. Check logs (incomplete)
2. Try to reproduce locally (different data)
3. Add more logging (redeploy)
4. Hope it happens again (waiting)
5. Guess the root cause (prayer)

**Manifesto approach:**

1. Load trace: `trace.load(incidentId)`
2. See exact snapshot before action
3. See exact intent that was issued
4. Replay computation locally
5. Get exact same result
6. Root cause identified

```typescript
// Load production trace
const trace = await trace.load('incident-abc-123');

// Replay locally
const result = await core.compute(
  trace.schema,
  trace.snapshotBefore,
  trace.intent
);

// Compare results
expect(result).toEqual(trace.result);  // Guaranteed to match
```

**Benefits:**
- Production bugs are locally reproducible
- No need to "try to recreate the conditions"
- Can step through exact execution
- Can verify fix before deploying

---

## Who Should Use Manifesto?

### You SHOULD Use Manifesto If:

✅ **You need deterministic computation**
- Same input must always produce same output
- Replay and time-travel debugging are essential
- Production bugs must be reproducible locally

✅ **You're building AI-governed applications**
- LLM agents propose actions
- Humans must approve critical operations
- AI-generated code must be verifiable

✅ **You need full accountability**
- Audit trails for compliance
- "Who did what, when, why" must be answerable
- Undo/rollback is required

✅ **You have complex domain logic**
- Business rules with many edge cases
- Side effects that must be isolated
- Testing without mocks is valuable

✅ **You want schema-first design**
- All logic as serializable data
- AI can generate/modify schemas
- Version control for business logic

### You DON'T Need Manifesto If:

❌ **You're building simple UI state**
- Local component state only
- No complex business logic
- No AI agents
- Use `useState` or Zustand instead

❌ **You're rapid prototyping**
- Speed > correctness for now
- No governance requirements
- Will refactor later anyway
- Use Redux or MobX instead

❌ **You need workflow orchestration**
- Long-running processes (hours/days)
- Distributed execution
- Durable workflows
- Use Temporal or Airflow instead

❌ **You're building event-driven systems**
- Event log is the primary model
- Temporal queries are essential
- CQRS architecture
- Use Event Sourcing instead

### Decision Tree

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
    │   └── Yes → Consider Manifesto or Event Sourcing
    │
    └── Yes → Use Manifesto
```

---

## Common Misconceptions

### "This is too complex for my use case"

**Misconception:** Manifesto adds unnecessary complexity.

**Reality:** Manifesto removes accidental complexity by making architecture explicit.

Compare:

```typescript
// Traditional (looks simple, hides complexity)
const [todos, setTodos] = useState([]);
const addTodo = async (text) => {
  const result = await api.addTodo(text);  // Where does this go?
  setTodos([...todos, result]);  // Race condition?
};

// Manifesto (explicit architecture)
const { addTodo } = actions.define({
  addTodo: {
    input: z.object({ id: z.string(), text: z.string() }),
    flow: flow.seq(
      flow.patch(state.todos).set(
        expr.append(
          state.todos,
          expr.object({
            id: expr.input('id'),
            text: expr.input('text'),
            completed: expr.lit(false),
          })
        )
      ),
      flow.effect('api:addTodo', { text: expr.input('text') })
    ),
  },
});
```

MEL equivalent (Manifesto):

```mel
domain TodoDomain {
  type TodoItem = { id: string, text: string, completed: boolean }

  state {
    todos: Array<TodoItem> = []
  }

  action addTodo(id: string, text: string) {
    patch todos = append(todos, {
      id: id,
      text: text,
      completed: false
    })
    effect api:addTodo({ text: text })
  }
}
```

Manifesto is more verbose, but:
- No hidden behavior
- Testable without mocks
- Deterministic
- Auditable

The complexity was always there. Manifesto makes it visible and manageable.

### "I don't need AI governance"

**Misconception:** Manifesto is only for AI applications.

**Reality:** The World Protocol is useful for any multi-actor system.

Even without AI:
- Multi-tenant applications need authorization
- Audit trails are required for compliance
- Time-travel debugging helps all teams
- Deterministic computation catches bugs

AI governance is one use case. Accountability and determinism are universal.

### "This is just Redux with extra steps"

**Misconception:** Manifesto is like Redux but more complicated.

**Reality:** Manifesto solves fundamentally different problems.

| Redux | Manifesto |
|-------|-----------|
| Mixed computation/execution | Pure computation, separate execution |
| No built-in governance | World Protocol for authority |
| Partial determinism | Guaranteed determinism |
| Middleware for side effects | Effects as pure declarations |
| Action logs (if you add it) | Complete trace built-in |

See [Manifesto vs. Others](/what-is-manifesto/manifesto-vs-others) for detailed comparison.

---

## Next Steps

**If Manifesto solves your problem:**

1. Read [Getting Started](/guides/getting-started) (15 minutes)
2. Try the [Todo Example](/guides/todo-example) (30 minutes)
3. Explore [Core Concepts](/core-concepts/) (1 hour)

**If you're still evaluating:**

1. Read [Manifesto vs. Others](/what-is-manifesto/manifesto-vs-others)
2. Check [Architecture Overview](/architecture/)
3. Review [Specifications](/specifications/) for technical details

**If you have questions:**

1. Review [Core Concepts](/core-concepts/) and [Guides](/guides/)
2. Join our [Discord](https://discord.gg/manifesto)
3. Open a [GitHub Discussion](https://github.com/manifesto-ai/manifesto/discussions)

---

**The fundamental question Manifesto answers:**

> How do we build applications where AI agents can safely read, reason about, and modify state?

**The answer:**

> Pure computation + explicit effects + built-in governance = deterministic, accountable, AI-safe applications.

---

## Related Documents

- [What is Manifesto?](/what-is-manifesto/) - Overview
- [One-Sentence Definitions](/what-is-manifesto/one-sentence) - For different audiences
- [Manifesto vs. Others](/what-is-manifesto/manifesto-vs-others) - Detailed comparisons
- [Getting Started](/guides/getting-started) - First steps
