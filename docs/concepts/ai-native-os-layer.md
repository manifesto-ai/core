# Why AI Needs a Deterministic Protocol

> Manifesto was born from a simple idea: **humans and AI should look at the same world model.**

## The Problem

When AI agents modify application state, three things break:

### 1. Non-determinism

Traditional state management doesn't guarantee that the same AI request produces the same result. Network timing, race conditions, and implicit ordering make AI behavior unpredictable.

### 2. Untraceability

When something goes wrong, you can't answer basic questions: What did the AI change? Why? What was the state before? Without a complete audit trail, debugging AI behavior is guesswork.

### 3. No Governance

Most systems have no concept of "who is allowed to do what." AI agents operate with the same permissions as the code that calls them—there's no way to restrict, approve, or audit their actions independently.

## The Solution: Shared World Model

Manifesto solves this by making humans and AI look at the **same Snapshot**—an immutable, content-addressable representation of all state at a point in time.

Every state change, whether initiated by a human clicking a button or an AI agent processing a request, goes through the same pipeline:

```
Actor submits Intent → Authority evaluates → Core computes → New Snapshot
```

This means:
- **Same input, same output** — AI behavior is reproducible
- **Complete trace** — Every change answers who, what, when, why
- **Authority governance** — AI actions can be restricted, approved, or audited

## What Manifesto Is NOT

### Not a State Management Library

| Aspect | Redux/Zustand | Manifesto |
|--------|---------------|-----------|
| Purpose | UI state synchronization | Multi-actor collaborative systems |
| Change initiator | Developer code | Actor (human, AI, system) |
| Traceability | Optional | Mandatory (all changes traced) |
| Schema | Static | Dynamic (first-class object, evolvable) |
| Authorization | None | Authority-based governance |

### Not an AI Framework

| Aspect | LangChain/AutoGen | Manifesto |
|--------|-------------------|-----------|
| Purpose | LLM orchestration | Formal guarantees for state transitions |
| Focus | Prompt/chain management | Deterministic computation |
| AI role | Executor | Actor (equal to other Actors) |
| Verification | None | Complete Trace-based verification |

## The 9 Primitives

| Primitive | Purpose |
|-----------|---------|
| **Actor** | Who acts (human, AI, or system) |
| **Authority** | What permissions govern the action |
| **Intent** | What the actor wants to achieve |
| **Schema** | Domain structure (evolvable via Intent) |
| **Snapshot** | Immutable state at a point in time |
| **Patch** | Atomic state change |
| **Trace** | Complete audit trail |
| **Compute** | Pure, deterministic evaluation |
| **Effect** | Controlled external operation |

## Schema as First-Class Object

In Manifesto, Schema is more than a data structure definition.

- Schema itself is a **first-class object modifiable via Intent**
- AI can **evolve** domain structures
- All Schema changes are **traced** and **auditable**

(See [Schema Evolution Guide](/integration/schema-evolution) for details)

## AI as Actor

AI agents are not special entities—they participate as equals alongside other Actors. The same `app.act()` interface works for everyone:

```typescript
import { createApp } from "@manifesto-ai/sdk";

const app = createApp({ schema: domainMel, effects: {} });
await app.ready();

// Human and AI use the same interface
await app.act("addTask", { title: "Review PR" }).done();

// With explicit actor (for multi-actor scenarios)
await app.act("addTask", { title: "AI suggestion" }, {
  actor: { id: "gpt-agent", type: "ai" }
}).done();
```

### AI-Friendly DSL

MEL (Manifesto Expression Language) is designed so that AI can generate it safely:

- Clear grammar with limited expressiveness
- Turing-incomplete (always terminates)
- Verifiable output

```mel
// AI can generate this structured code
action addTask(title: string) {
  onceIntent {
    patch tasks = append(tasks, {
      id: $meta.intentId,
      title: title,
      done: false
    })
  }
}
```

## Verifiable AI Behavior

All actions performed by AI are:

- **Recorded** in complete Trace
- **Reproducible** (deterministic computation)
- **Verifiable** (Authority evaluation)

```typescript
import { createApp } from "@manifesto-ai/sdk";

const app = createApp({ schema: domainMel, effects: {} });
await app.ready();

// Every action returns a result with full trace
const handle = app.act("addTask", { title: "AI generated task" });
const result = await handle.done();

// Result contains:
// - status: 'completed' | 'rejected' | 'failed'
// - worldId: content-addressable state reference
// - proposalId: governance record
console.log(result.status);
console.log(app.getState()); // Current snapshot
```

## The Fundamental Equation

```
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

This equation is:

- **Pure**: Same inputs always produce same outputs
- **Total**: Always returns a result (never throws)
- **Traceable**: Every step is recorded
- **Complete**: Snapshot is the whole truth

AI behavior adheres to the same equation. AI does not bypass the compute pipeline—it submits Intents that go through the same deterministic process.

## When to Choose Manifesto

Manifesto excels when you need:

| Requirement | Why Manifesto |
|-------------|---------------|
| AI decisions need audit trails | Every Intent, every Trace, every Decision recorded |
| Multiple actors (human + AI) | Unified Actor model with Authority governance |
| Compliance requirements | Complete traceability and reproducibility |
| AI behavior verification | Deterministic computation enables replay and testing |

## Quick Start

```mel
// task-board.mel
domain TaskBoard {
  type Task = {
    id: string,
    title: string,
    done: boolean
  }

  state {
    tasks: Array<Task> = []
  }

  action addTask(title: string, id: string) {
    onceIntent {
      patch tasks = append(tasks, { id: id, title: title, done: false })
    }
  }
}
```

```typescript
// main.ts
import { createApp } from "@manifesto-ai/sdk";
import TaskBoardMel from "./task-board.mel";

// Create and start app
const app = createApp({ schema: TaskBoardMel, effects: {} });
await app.ready();

// Execute actions
await app.act("addTask", { title: "First task", id: crypto.randomUUID() }).done();

// Read state
const { tasks } = app.getState().data;
console.log(tasks); // [{ id: "...", title: "First task", done: false }]

// Subscribe to changes
app.subscribe(
  (state) => state.data.tasks,
  (tasks) => console.log("Tasks changed:", tasks)
);
```

## See Also

- [Quickstart Guide](/quickstart) — Full setup instructions
- [AI Agent Integration](/integration/ai-agents) — Practical AI integration guide
- [Schema Evolution](/integration/schema-evolution) — Schema evolution patterns
- [Intent Concept](/concepts/intent) — Intent details
- [World Concept](/concepts/world) — Governance details
