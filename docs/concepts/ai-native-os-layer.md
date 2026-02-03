# AI Native OS Layer

> Manifesto's core identity

## What Manifesto Is

Manifesto is an **AI Native OS Layer**.

Just as an operating system provides primitives for processes, memory, and file systems, Manifesto provides primitives for systems where AI and humans collaborate.

## What Manifesto Is NOT

### Not a State Management Library

Comparing Manifesto to Redux or Zustand is incorrect framing.

| Aspect | Redux/Zustand | Manifesto |
|--------|---------------|-----------|
| Purpose | UI state synchronization | AI-human collaborative systems |
| Change initiator | Developer code | Actor (human, AI, system) |
| Traceability | Optional | Mandatory (all changes traced) |
| Schema | Static | Dynamic (first-class object, evolvable) |
| Authorization | None | Authority-based governance |

### Not an AI Framework

Comparing Manifesto to LangChain or AutoGen is also incorrect framing.

| Aspect | LangChain/AutoGen | Manifesto |
|--------|-------------------|-----------|
| Purpose | LLM orchestration | Formal guarantees for state transitions |
| Focus | Prompt/chain management | Deterministic computation |
| AI role | Executor | Actor (equal to other Actors) |
| Verification | None | Complete Trace-based verification |

## Package Architecture

```
┌─────────────────────────────────────────────────────┐
│                  @manifesto-ai/app                  │  ← User Entry Point
│              (High-level Facade)                    │
├─────────────────────────────────────────────────────┤
│  @manifesto-ai/compiler  │  @manifesto-ai/builder   │  ← Domain Definition
├──────────────────────────┴──────────────────────────┤
│     @manifesto-ai/world    @manifesto-ai/host       │  ← Runtime
│                  @manifesto-ai/core                 │
└─────────────────────────────────────────────────────┘
```

| Package | Role |
|---------|------|
| **@manifesto-ai/app** | Main facade. Most users only need this. |
| **@manifesto-ai/compiler** | MEL → DomainSchema compilation |
| **@manifesto-ai/builder** | Type-safe domain definition (alternative to MEL) |
| **@manifesto-ai/core** | Pure computation engine |
| **@manifesto-ai/host** | Effect execution runtime |
| **@manifesto-ai/world** | Governance and authority |

**For most use cases, install only:**

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler
```

## The 9 Primitives

| Primitive | Purpose | OS Analogy |
|-----------|---------|------------|
| **Actor** | Who acts | User/Process |
| **Authority** | What permissions | Permission |
| **Intent** | What intention | System Call |
| **Schema** | Domain structure | File System Schema |
| **Snapshot** | State at a point in time | Memory Snapshot |
| **Patch** | Atomic change | Transaction |
| **Trace** | Audit trail | Audit Log |
| **Compute** | Pure computation | CPU (deterministic) |
| **Effect** | External operation | I/O Operation |

## Schema as First-Class Object

In Manifesto, Schema is more than a data structure definition.

- Schema itself is a **first-class object modifiable via Intent**
- AI can **evolve** domain structures
- All Schema changes are **traced** and **auditable**

(See [Schema Evolution Guide](/guides/schema-evolution) for details)

## AI-Native by Design

### AI as Actor

AI agents are not special entities—they participate as equals alongside other Actors.

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp(domainMel);
await app.ready();

// Human and AI use the same interface
await app.act("addTask", { title: "Review PR" }).done();

// With explicit actor (for multi-actor scenarios)
await app.act("addTask", { title: "AI suggestion" }, {
  actor: { id: "gpt-agent", type: "ai" }
}).done();
```

### AI-Friendly DSL

MEL (Manifesto Expression Language) is designed for AI generation:

- Clear grammar
- Limited expressiveness (Turing-incomplete)
- Verifiable output

```mel
// AI can generate this structured code
action addTask(title: string) {
  when isNull(data.submittedAt) {
    patch data.tasks = append(data.tasks, {
      id: input.id,
      title: input.title,
      completed: false
    })
  }
}
```

### Verifiable AI Behavior

All actions performed by AI:

- **Recorded** in complete Trace
- **Reproducible** (deterministic)
- **Verifiable** (Authority evaluation)

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp(domainMel);
await app.ready();

// Every action returns a result with full trace
const handle = app.act("addTask", { title: "AI generated task" });
const result = await handle.done();

// Result contains:
// - status: 'completed' | 'rejected' | 'failed'
// - snapshot: new state
// - trace: complete audit trail (who, what, when, why)
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

```typescript
import { createApp } from "@manifesto-ai/app";

// Define domain in MEL
const domainMel = `
domain TaskBoard {
  state { tasks: Task[] = [] }

  action addTask(title: string) {
    once(id) {
      patch id = $meta.intentId
      patch tasks = append(tasks, { id, title, done: false })
    }
  }
}
`;

// Create and start app
const app = createApp(domainMel);
await app.ready();

// Execute actions
await app.act("addTask", { title: "First task" }).done();

// Read state
const { tasks } = app.getState();
console.log(tasks); // [{ id: "...", title: "First task", done: false }]

// Subscribe to changes
app.subscribe((state) => {
  console.log("State changed:", state);
});
```

## See Also

- [Quickstart Guide](/quickstart) — Full setup instructions
- [AI Agent Integration](/guides/ai-agent-integration) — Practical AI integration guide
- [Schema Evolution](/guides/schema-evolution) — Schema evolution patterns
- [Intent Concept](/concepts/intent) — Intent details
- [World Concept](/concepts/world) — Governance details
