# Manifesto Integration Patterns

> **Status:** Stable
> **Purpose:** Demonstrate complete working examples of Manifesto architecture patterns
> **Audience:** Developers building Manifesto applications

---

## Overview

This document provides three comprehensive integration examples that demonstrate how Manifesto's layers work together. Each example is copy-paste executable and shows the complete architecture from domain definition to user interface.

**The three patterns are:**

1. **Full-Stack Todo App** — All layers working together (Builder → Core → Host → World → Bridge → React)
2. **AI Agent with Governance** — Compiler (LLM) → World (governance) → Lab (verification)
3. **HITL Approval Pipeline** — Sensitive operations requiring user approval with Lab + HITL

---

## Table of Contents

- [Pattern 1: Full-Stack Todo App](#pattern-1-full-stack-todo-app)
- [Pattern 2: AI Agent with Governance](#pattern-2-ai-agent-with-governance)
- [Pattern 3: HITL Approval Pipeline](#pattern-3-hitl-approval-pipeline)
- [Cross-Pattern Principles](#cross-pattern-principles)
- [Common Pitfalls](#common-pitfalls)
- [When to Use Each Pattern](#when-to-use-each-pattern)

---

## Pattern 1: Full-Stack Todo App

**What this demonstrates:** Complete integration of all Manifesto layers for a deterministic, UI-driven application.

**When to use:** Building interactive applications where users directly manipulate domain state through a UI.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         React UI                                │
│  (TodoApp.tsx - presentation, event capture)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ useValue, useActions, useComputed
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    createManifestoApp                           │
│  (Zero-config factory - handles wiring)                         │
│     ├─ Provider (React Context)                                 │
│     ├─ useValue (state selectors)                               │
│     ├─ useComputed (derived values)                             │
│     └─ useActions (intent dispatchers)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ dispatch(IntentBody)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Bridge                                   │
│  (Two-way binding: events ↔ intents, snapshot ↔ subscribers)   │
└────────────────────────┬────────────────────────────────────────┘
                         │ submitProposal(actor, intent)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         World                                    │
│  (Governance: actor registry, authority, lineage)               │
└────────────────────────┬────────────────────────────────────────┘
                         │ dispatch(intent) via Host
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Host                                     │
│  (Orchestration: compute loop, effect execution, patch apply)   │
└────────────────────────┬────────────────────────────────────────┘
                         │ compute(schema, snapshot, intent)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Core                                     │
│  (Pure computation: expression eval, flow execution, patches)   │
└────────────────────────┬────────────────────────────────────────┘
                         │ New Snapshot
                         ▼
                    Back to Bridge → React

Data flows in a loop:
  User action → Bridge → World → Host → Core → New Snapshot → Bridge → UI update
```

### Layer 1: Domain Definition (Builder)

```typescript
// src/domain/todo-domain.ts
import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";

// ============ State Schema ============

const TodoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.number(),
});

const TodoStateSchema = z.object({
  todos: z.array(TodoItemSchema),
  filter: z.enum(["all", "active", "completed"]),
  editingId: z.string().nullable(),
});

export type TodoState = z.infer<typeof TodoStateSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;

// ============ Domain Definition ============

export const TodoDomain = defineDomain(
  TodoStateSchema,
  ({ state, computed, actions, expr, flow }) => {
    // Helper to convert ItemProxy property to Expr
    const itemField = <T>(proxy: unknown) =>
      expr.get(proxy as any);

    // ============ Computed Values ============

    const { activeCount } = computed.define({
      activeCount: expr.len(
        expr.filter(state.todos, (item) =>
          expr.not(itemField(item.completed))
        )
      ),
    });

    const { filteredTodos } = computed.define({
      filteredTodos: expr.cond(
        expr.eq(state.filter, "active"),
        expr.filter(state.todos, (item) =>
          expr.not(itemField(item.completed))
        ),
        expr.cond(
          expr.eq(state.filter, "completed"),
          expr.filter(state.todos, (item) =>
            itemField(item.completed)
          ),
          state.todos
        )
      ),
    });

    // ============ Actions ============

    const { add } = actions.define({
      add: {
        input: z.object({
          id: z.string(),
          title: z.string(),
          createdAt: z.number(),
        }),
        flow: flow.patch(state.todos).set(
          expr.append(state.todos, expr.object({
            id: expr.input("id"),
            title: expr.input("title"),
            completed: expr.lit(false),
            createdAt: expr.input("createdAt"),
          }))
        ),
      },
    });

    const { toggle } = actions.define({
      toggle: {
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.map(state.todos, (item) =>
            expr.cond(
              expr.eq(itemField(item.id), expr.input("id")),
              expr.merge(
                itemField(item),
                expr.object({ completed: expr.not(itemField(item.completed)) })
              ),
              itemField(item)
            )
          )
        ),
      },
    });

    const { remove } = actions.define({
      remove: {
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.filter(state.todos, (item) =>
            expr.neq(itemField(item.id), expr.input("id"))
          )
        ),
      },
    });

    return {
      computed: { activeCount, filteredTodos },
      actions: { add, toggle, remove },
    };
  },
  { id: "todo-domain", version: "1.0.0" }
);

export const initialState: TodoState = {
  todos: [],
  filter: "all",
  editingId: null,
};
```

### Layer 2-6: Application Wiring (createManifestoApp)

`createManifestoApp` internally creates and wires:
- **Host** (effect execution, compute loop)
- **World** (actor registry, authority, proposals)
- **Bridge** (event routing, snapshot subscriptions)
- **React Context** (Provider, hooks)

```typescript
// src/App.tsx
import { createManifestoApp } from "@manifesto-ai/react";
import { TodoDomain, initialState } from "./domain/todo-domain";

// Single line creates entire infrastructure
const Todo = createManifestoApp(TodoDomain, { initialState });

// Export Provider for root
export const TodoProvider = Todo.Provider;

// UI Component
function TodoList() {
  // Type-safe state access
  const todos = Todo.useValue((s) => s.todos);
  const filter = Todo.useValue((s) => s.filter);

  // Computed values
  const activeCount = Todo.useComputed((c) => c.activeCount) as number;
  const filteredTodos = Todo.useComputed((c) => c.filteredTodos) as TodoItem[];

  // Actions
  const { add, toggle, remove } = Todo.useActions();

  const handleAdd = () => {
    add({
      id: crypto.randomUUID(),
      title: "New todo",
      createdAt: Date.now(),
    });
  };

  return (
    <div>
      <h1>Todos ({activeCount} active)</h1>
      <button onClick={handleAdd}>Add Todo</button>
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggle({ id: todo.id })}
            />
            <span>{todo.title}</span>
            <button onClick={() => remove({ id: todo.id })}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Root component
export function App() {
  return (
    <Todo.Provider>
      <TodoList />
    </Todo.Provider>
  );
}
```

### Data Flow Example

**User clicks "Add Todo":**

```
1. React Event Handler
   add({ id: "123", title: "Buy milk", createdAt: 1234567890 })

2. Bridge receives IntentBody
   { type: "add", input: { id: "123", title: "Buy milk", createdAt: 1234567890 } }

3. World creates Proposal
   Proposal { actor: "system-actor", intent: Intent { ... } }

4. Authority evaluates (auto-approve in this case)
   Decision: "approved"

5. Host dispatches to Core
   compute(schema, snapshot, intent)

6. Core evaluates Flow
   flow.patch(state.todos).set(expr.append(...))
   → Generates patches: [{ op: "set", path: "data.todos", value: [...] }]

7. Host applies patches
   apply(schema, snapshot, patches)
   → New Snapshot with updated todos array

8. World creates new World
   WorldId: hash(schemaHash:snapshotHash)

9. Bridge receives Snapshot update
   Notifies all subscribers

10. React re-renders
    useValue((s) => s.todos) returns new array → UI updates
```

### Common Pitfalls: Pattern 1

| Pitfall | Why It Fails | Solution |
|---------|--------------|----------|
| **Re-entry unsafe flows** | `flow.patch(state.count).set(expr.add(state.count, 1))` runs every compute cycle, incrementing forever | Use `flow.onceNull` to guard: `flow.onceNull(state.submittedAt, ({ patch }) => patch(...))` |
| **Direct state mutation** | `snapshot.data.todos.push(newTodo)` bypasses Core, breaks determinism | Always use actions: `add({ ... })` |
| **Effect handler throws** | `async function handler() { throw new Error() }` crashes app | Return patches for errors: `return [{ op: "set", path: "data.error", value: error.message }]` |
| **Snapshot isolation** | Passing `snapshot.data` to external code that mutates it | Clone before passing out: `JSON.parse(JSON.stringify(snapshot.data))` |

---

## Pattern 2: AI Agent with Governance

**What this demonstrates:** Using Manifesto Compiler to generate intents from natural language, with LLM necessity governance and verification.

**When to use:** Building AI agents that need to propose actions based on natural language, with structural verification that the agent is necessary.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   Natural Language Input                        │
│  "Add a todo to buy milk"                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Compiler                                   │
│  (LLM-driven intent generation from NL)                         │
│                                                                  │
│  Input: "Add a todo to buy milk"                                │
│  Output: IntentBody { type: "add", input: { title: "Buy milk" } }│
└────────────────────────┬────────────────────────────────────────┘
                         │ submitProposal(actor: 'llm-agent')
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         World                                    │
│  (Governance with LLM Actor)                                    │
│                                                                  │
│  Actor: { actorId: "llm-gpt4", kind: "agent" }                  │
│  Authority: Level 3 (Natural Language Grounding)                │
└────────────────────────┬────────────────────────────────────────┘
                         │ Authority decides
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Lab                                      │
│  (Necessity Level 3 verification)                               │
│                                                                  │
│  Verification: user_confirmation (Level 3)                      │
│  Trace: Record all LLM proposals and decisions                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ approved intent
                         ▼
                    Host → Core → Execute
```

### Complete Example

```typescript
// ============================================================================
// 1. Define Domain (same as Pattern 1)
// ============================================================================

import { defineDomain } from "@manifesto-ai/builder";
import { z } from "zod";

const TodoStateSchema = z.object({
  todos: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  })),
});

const TodoDomain = defineDomain(TodoStateSchema, ({ state, actions, expr, flow }) => {
  const { add } = actions.define({
    add: {
      input: z.object({ title: z.string() }),
      flow: flow.patch(state.todos).set(
        expr.append(state.todos, expr.object({
          id: expr.input("id"),
          title: expr.input("title"),
          completed: expr.lit(false),
        }))
      ),
    },
  });

  return { actions: { add } };
});

// ============================================================================
// 2. Setup Compiler (LLM Intent Generator)
// ============================================================================

import { createCompiler } from "@manifesto-ai/compiler";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const compiler = createCompiler(TodoDomain.schema, {
  adapter: {
    async generate(prompt) {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const textContent = response.content.find(c => c.type === "text");
      return textContent ? textContent.text : "";
    },
  },
});

// ============================================================================
// 3. Setup World with LLM Actor and Level 3 Authority
// ============================================================================

import { createManifestoWorld } from "@manifesto-ai/world";
import { createHost } from "@manifesto-ai/host";
import { withLab, createLevelAuthority } from "@manifesto-ai/lab";

// Create Host
const host = createHost(TodoDomain.schema, {
  initialData: { todos: [] },
});

// Create World
const world = createManifestoWorld({
  schemaHash: TodoDomain.schema.hash,
  host: {
    async dispatch(intent) {
      const result = await host.dispatch(intent);
      return {
        status: result.status === "complete" ? "complete" : "error",
        snapshot: result.snapshot,
      };
    },
  },
});

// Register LLM Actor
world.registerActor({
  actorId: "llm-gpt4",
  kind: "agent",
  name: "GPT-4 Natural Language Interpreter",
  meta: {
    model: "claude-3-5-sonnet-20241022",
    role: "intent_parser",
    level: 3,
  },
});

// Wrap with Lab for Necessity Level 3
const labWorld = withLab(world, {
  runId: `nl-todo-${Date.now()}`,
  necessityLevel: 3,  // Natural Language Grounding
  outputPath: "./traces",
  projection: {
    enabled: true,
    mode: "interactive",
  },
  hitl: {
    enabled: true,
    timeout: 60000,  // 60 seconds for user confirmation
    onTimeout: "reject",
  },
});

// Bind Level 3 Authority (user_confirmation)
labWorld.bindAuthority(
  "llm-gpt4",
  "authority-level-3",
  createLevelAuthority(3, {
    hitlController: labWorld.hitl,
  })
);

// ============================================================================
// 4. Process Natural Language Command
// ============================================================================

async function processNaturalLanguageCommand(utterance: string) {
  console.log(`\nProcessing: "${utterance}"`);

  // Step 1: Compile natural language to intent
  const compileResult = await compiler.compile({
    input: utterance,
    context: {
      currentState: labWorld.getCurrentSnapshot(),
    },
  });

  if (!compileResult.success) {
    console.error("Compilation failed:", compileResult.error);
    return;
  }

  const intent = compileResult.intent;
  console.log("Generated intent:", JSON.stringify(intent, null, 2));

  // Step 2: Submit as proposal from LLM actor
  const proposal = await labWorld.submitProposal({
    actorId: "llm-gpt4",
    intent: {
      type: intent.type,
      input: {
        ...intent.input,
        id: crypto.randomUUID(),  // Add missing ID
      },
    },
  });

  // Step 3: Authority evaluates (Level 3 = user_confirmation required)
  // HITL intervention happens here automatically

  console.log("Proposal:", proposal.proposalId);
  console.log("Decision:", proposal.decision);

  if (proposal.decision === "approved") {
    console.log("✓ Action executed successfully");
    const trace = labWorld.trace();
    console.log(`Trace saved: ${trace.header.runId}`);
  } else {
    console.log("✗ Action rejected by authority");
  }
}

// ============================================================================
// 5. Run Examples
// ============================================================================

async function main() {
  // Initialize genesis
  await labWorld.createGenesis(
    host.getCurrentSnapshot()
  );

  // Example 1: Simple addition
  await processNaturalLanguageCommand("Add a todo to buy milk");

  // Example 2: Ambiguous reference (will trigger HITL)
  await processNaturalLanguageCommand("Add the usual groceries");

  // Example 3: Complex command
  await processNaturalLanguageCommand(
    "Create three todos: finish report, call dentist, and water plants"
  );

  // Save final trace
  await labWorld.trace().save(`./traces/${labWorld.labMeta.runId}.trace.json`);

  // Generate report
  await labWorld.report().toMarkdown(`./reports/${labWorld.labMeta.runId}.md`);
}

main().catch(console.error);
```

### Necessity Level 3 Verification

**Why Level 3?**

Natural language requires grounding to structured intents. This is structurally necessary because:

```
∄ f: "Add a todo" → Intent such that ∀ users, f is correct

Counterexample:
  User A says "Add a todo" → expects { type: "add", input: { title: "Untitled" } }
  User B says "Add a todo" → expects system to ask "What title?"

No deterministic function can satisfy both.
```

**Level 3 Authority Flow:**

```
1. LLM generates Intent from "Add a todo to buy milk"
   → IntentBody { type: "add", input: { title: "Buy milk" } }

2. Proposal submitted to World
   → Proposal { actor: "llm-gpt4", intent: ... }

3. Level 3 Authority evaluates
   → Checks: Is this grounding plausible?
   → If confidence < threshold: returns 'pending' + PendingReason
   → If confidence >= threshold but requires confirmation: HITL

4. HITL shows user:
   "Agent wants to: Add todo 'Buy milk'"
   "Confirm? [Yes] [No] [Modify]"

5. User confirms → Authority returns 'approved'

6. Host executes intent → New snapshot with todo added

7. Lab records in trace:
   - LLM proposal
   - Grounding details
   - User confirmation
   - Execution result
```

### Common Pitfalls: Pattern 2

| Pitfall | Why It Fails | Solution |
|---------|--------------|----------|
| **LLM as Authority** | LLM verifying its own output is circular | LLM is Actor only; Authority is separate (human or consistency check) |
| **Skipping Lab** | No trace = can't debug why LLM failed | Always wrap with `withLab` for experiments |
| **Wrong necessity level** | Using Level 0 for NL task loses verification guarantees | Detect level: if NL input → Level 3, if hidden state → Level 1, etc. |
| **Traceless runs** | Running without Lab.trace() = can't reproduce failures | Every run must produce trace artifact |

---

## Pattern 3: HITL Approval Pipeline

**What this demonstrates:** Human-in-the-loop approval for sensitive operations with structured prompting and agent-based resolution.

**When to use:** Operations requiring human approval (financial transactions, data deletion, etc.) or agent-to-agent collaboration where one agent reviews another's proposals.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Proposes                             │
│  "Delete all completed todos"                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ submitProposal
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    World + Authority                            │
│                                                                  │
│  Policy: Deletions require human approval                       │
│  Authority returns: 'pending'                                   │
│  PendingReason: { code: 'REQUIRES_CONFIRMATION' }               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Lab HITL Controller                          │
│                                                                  │
│  HITLContext {                                                  │
│    proposal: Proposal                                           │
│    pendingReason: PendingReason                                 │
│    availableActions: [approve, reject, modify, ...]             │
│    toPrompt(): HITLPrompt                                       │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
         ┌──────────▼─┐   ┌───▼──────────┐
         │   Human    │   │  Agent B     │
         │  Reviewer  │   │ (Supervisor) │
         └──────┬─────┘   └───┬──────────┘
                │             │
                │ approve     │ retry with reasoning
                │             │
                ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Authority (receives decision)                      │
│                                                                  │
│  Decision: 'approved' | 'rejected'                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    Execute or Reject
```

### Complete Example

```typescript
// ============================================================================
// 1. Define Domain with Sensitive Operations
// ============================================================================

import { defineDomain } from "@manifesto-ai/builder";
import { z } from "zod";

const TodoStateSchema = z.object({
  todos: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  })),
  deletedCount: z.number().default(0),
});

const TodoDomain = defineDomain(TodoStateSchema, ({ state, actions, expr, flow }) => {
  // Sensitive action: delete all completed todos
  const { deleteCompleted } = actions.define({
    deleteCompleted: {
      flow: flow.seq(
        // Remove completed todos
        flow.patch(state.todos).set(
          expr.filter(state.todos, (item) =>
            expr.not(expr.get(item as any).completed)
          )
        ),
        // Track deletion count
        flow.patch(state.deletedCount).set(
          expr.add(
            state.deletedCount,
            expr.len(
              expr.filter(state.todos, (item) =>
                expr.get(item as any).completed
              )
            )
          )
        )
      ),
    },
  });

  return { actions: { deleteCompleted } };
});

// ============================================================================
// 2. Custom Authority with HITL for Deletions
// ============================================================================

import { createLevelAuthority } from "@manifesto-ai/lab";
import type { AuthorityHandler, Proposal } from "@manifesto-ai/world";

function createDeletionApprovalAuthority(hitlController): AuthorityHandler {
  return async (proposal: Proposal) => {
    // If action is deletion, require human approval
    if (proposal.intent.type === "deleteCompleted") {
      return {
        decision: "pending",
        pendingReason: {
          code: "REQUIRES_CONFIRMATION",
          description: "Deletion operations require human approval",
          details: {
            confirmation: {
              policy: "DELETION_POLICY",
              risk: "high",
            },
          },
          suggestions: [
            "Review the items to be deleted",
            "Confirm this action is intentional",
            "Consider if backup is needed",
          ],
        },
        availableActions: [
          {
            type: "approve",
            description: "Approve deletion",
          },
          {
            type: "reject",
            description: "Reject deletion",
          },
          {
            type: "request_info",
            description: "Ask agent for more details",
            suggestedQuestions: [
              "How many items will be deleted?",
              "Can this be undone?",
            ],
          },
        ],
      };
    }

    // Other actions auto-approve
    return { decision: "approved" };
  };
}

// ============================================================================
// 3. Setup Lab with HITL
// ============================================================================

import { withLab } from "@manifesto-ai/lab";
import { createManifestoWorld } from "@manifesto-ai/world";
import { createHost } from "@manifesto-ai/host";

const host = createHost(TodoDomain.schema, {
  initialData: {
    todos: [
      { id: "1", title: "Buy milk", completed: true },
      { id: "2", title: "Write code", completed: false },
      { id: "3", title: "Review PR", completed: true },
    ],
    deletedCount: 0,
  },
});

const world = createManifestoWorld({
  schemaHash: TodoDomain.schema.hash,
  host: {
    async dispatch(intent) {
      const result = await host.dispatch(intent);
      return {
        status: result.status === "complete" ? "complete" : "error",
        snapshot: result.snapshot,
      };
    },
  },
});

// Register agent
world.registerActor({
  actorId: "cleanup-agent",
  kind: "agent",
  name: "Cleanup Agent",
});

const labWorld = withLab(world, {
  runId: `hitl-deletion-${Date.now()}`,
  necessityLevel: 1,  // Necessity Level 1 (partial observation of user intent)
  outputPath: "./traces",
  projection: {
    enabled: true,
    mode: "interactive",
    components: {
      // Custom domain renderer
      renderSnapshot: (snapshot, ctx) => {
        const todos = snapshot.data.todos as any[];
        const completed = todos.filter(t => t.completed);
        const active = todos.filter(t => !t.completed);

        return [
          `Todos:`,
          `  Active: ${active.length}`,
          ...active.map(t => `    - [ ] ${t.title}`),
          `  Completed: ${completed.length}`,
          ...completed.map(t => `    - [x] ${t.title}`),
          `  Total Deleted: ${snapshot.data.deletedCount}`,
        ].join('\n');
      },

      renderAction: (intent, before, after, ctx) => {
        if (intent.type === "deleteCompleted") {
          const beforeCompleted = (before.data.todos as any[]).filter(t => t.completed).length;
          return `🗑️  Deleting ${beforeCompleted} completed todo(s)`;
        }
        return `Action: ${intent.type}`;
      },
    },
  },
  hitl: {
    enabled: true,
    timeout: 120000,  // 2 minutes

    // Human reviewer (terminal-based)
    onPending: async (proposal, context) => {
      console.log("\n" + "=".repeat(60));
      console.log("⚠️  HUMAN APPROVAL REQUIRED");
      console.log("=".repeat(60));

      // Show current state using domain renderer
      const stateView = context.renderContext.recentEvents
        .find(e => e.type === "snapshot:changed")?.snapshot;

      if (stateView) {
        const rendered = labWorld.projection.components.renderSnapshot(
          stateView,
          context.renderContext
        );
        console.log("\nCurrent State:");
        console.log(rendered);
      }

      // Show proposal
      console.log("\nProposed Action:");
      console.log(`  Type: ${proposal.intent.type}`);
      console.log(`  By: ${proposal.actorId}`);

      // Show why pending
      console.log("\nPending Reason:");
      console.log(`  ${context.pendingReason.description}`);
      if (context.pendingReason.suggestions) {
        console.log("\nSuggestions:");
        context.pendingReason.suggestions.forEach(s =>
          console.log(`  - ${s}`)
        );
      }

      // Show options
      console.log("\nAvailable Actions:");
      context.availableActions.forEach((action, i) =>
        console.log(`  ${i + 1}. ${action.type}: ${action.description}`)
      );

      // Get user input (simplified for example - use inquirer in real app)
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const choice = await new Promise<string>(resolve => {
        rl.question("\nYour choice (1-3): ", resolve);
      });
      rl.close();

      switch (choice) {
        case "1":  // Approve
          await labWorld.hitl.approve(proposal.proposalId);
          console.log("✓ Approved");
          break;
        case "2":  // Reject
          await labWorld.hitl.reject(proposal.proposalId, "User rejected");
          console.log("✗ Rejected");
          break;
        case "3":  // Request info
          console.log("Requesting more information...");
          // In real app: send question to agent and wait for response
          break;
      }
    },
  },
});

// Bind custom authority
labWorld.bindAuthority(
  "cleanup-agent",
  "deletion-authority",
  createDeletionApprovalAuthority(labWorld.hitl)
);

// ============================================================================
// 4. Agent-to-Agent HITL (Advanced Pattern)
// ============================================================================

// Register supervisor agent
world.registerActor({
  actorId: "supervisor-agent",
  kind: "agent",
  name: "Supervisor Agent",
  meta: {
    model: "claude-3-5-sonnet-20241022",
    role: "approval_supervisor",
  },
});

async function agentBasedHITL(proposal, context) {
  // Generate structured prompt for supervisor agent
  const prompt = context.toPrompt({
    stateRenderer: labWorld.projection.components.renderSnapshot,
    includeActions: true,
    responseFormat: "json",
    includeSchema: true,
  });

  /*
  prompt = {
    situation: "An agent proposed a deletion action that requires approval.",

    currentState: `
      Todos:
        Active: 1
          - [ ] Write code
        Completed: 2
          - [x] Buy milk
          - [x] Review PR
        Total Deleted: 0
    `,

    yourProposal: {
      intentType: "deleteCompleted",
      content: {}
    },

    whyPending: {
      reason: "REQUIRES_CONFIRMATION",
      description: "Deletion operations require human approval",
      details: {
        confirmation: { policy: "DELETION_POLICY", risk: "high" }
      }
    },

    options: [
      { id: "approve", type: "approve", description: "Approve deletion" },
      { id: "reject", type: "reject", description: "Reject deletion" },
      { id: "info", type: "request_info", description: "Ask for details" }
    ],

    responseFormat: {
      type: "json",
      schema: {
        action: "approve" | "reject" | "request_info",
        reasoning: string,
        question?: string  // if request_info
      }
    }
  }
  */

  // Send to supervisor agent (using LLM)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are a supervisor agent reviewing a proposed action.

${prompt.currentState}

Proposed Action: ${prompt.yourProposal.intentType}

Why it needs approval: ${prompt.whyPending.description}

Available options:
${prompt.options.map(o => `- ${o.type}: ${o.description}`).join('\n')}

Respond in JSON format:
{
  "action": "approve" | "reject" | "request_info",
  "reasoning": "your reasoning here"
}
`
    }],
  });

  const textContent = response.content.find(c => c.type === "text");
  const decision = JSON.parse(textContent.text);

  console.log(`\n🤖 Supervisor Agent Decision:`);
  console.log(`   Action: ${decision.action}`);
  console.log(`   Reasoning: ${decision.reasoning}`);

  // Execute decision
  switch (decision.action) {
    case "approve":
      await labWorld.hitl.approve(proposal.proposalId);
      break;
    case "reject":
      await labWorld.hitl.reject(proposal.proposalId, decision.reasoning);
      break;
    case "request_info":
      // In real system: route back to original agent
      console.log(`   Question: ${decision.question}`);
      break;
  }
}

// ============================================================================
// 5. Run Example
// ============================================================================

async function main() {
  await labWorld.createGenesis(host.getCurrentSnapshot());

  // Submit deletion proposal
  console.log("Agent submitting deletion proposal...\n");

  const proposal = await labWorld.submitProposal({
    actorId: "cleanup-agent",
    intent: {
      type: "deleteCompleted",
      input: {},
    },
  });

  // HITL intervention happens automatically via onPending callback

  console.log(`\nFinal Decision: ${proposal.decision}`);

  // Save trace
  await labWorld.trace().save(`./traces/${labWorld.labMeta.runId}.trace.json`);

  console.log(`\nTrace saved: traces/${labWorld.labMeta.runId}.trace.json`);
}

main().catch(console.error);
```

### HITL Prompt Structure

The `HITLPrompt` provides all information an agent (or human) needs to make an informed decision:

```typescript
type HITLPrompt = {
  // What's happening
  situation: "An agent proposed a deletion action that requires approval.",

  // Current world state (rendered by your domain's SnapshotRenderer)
  currentState: string,

  // What was proposed
  yourProposal: {
    intentType: "deleteCompleted",
    content: {}
  },

  // Why it's waiting
  whyPending: {
    reason: "REQUIRES_CONFIRMATION",
    description: "Deletion operations require human approval",
    details: { ... }
  },

  // What you can do
  options: [
    { type: "approve", description: "..." },
    { type: "reject", description: "..." },
    { type: "request_info", suggestedQuestions: [...] }
  ],

  // How to respond (for structured output)
  responseFormat: { type: "json", schema: { ... } }
};
```

### Common Pitfalls: Pattern 3

| Pitfall | Why It Fails | Solution |
|---------|--------------|----------|
| **HITL modifies state directly** | Lab.hitl.approve() → state change bypasses governance | HITL goes through Authority, not direct modification |
| **Timeout handling missing** | User doesn't respond → system hangs forever | Set `onTimeout: 'reject'` or `'approve'` based on policy |
| **No PendingReason** | Agent doesn't know why approval needed | Always provide structured `PendingReason` with `code`, `description`, `details` |
| **Missing toPrompt renderer** | Agent receives raw JSON instead of domain-specific view | Inject `stateRenderer` from Projection Components |

---

## Cross-Pattern Principles

These principles apply to ALL patterns:

### 1. Snapshot is the Only Medium

```typescript
// ❌ FORBIDDEN - Value passing outside Snapshot
const result = await executeEffect();
core.compute(schema, snapshot, { ...intent, result });

// ✅ REQUIRED - Effect writes to Snapshot
async function effectHandler(type, params): Promise<Patch[]> {
  const result = await api.call(params);
  return [
    { op: "set", path: "data.apiResult", value: result }
  ];
}
```

### 2. Re-Entry Safety

```typescript
// ❌ FORBIDDEN - Runs every compute cycle
flow.patch(state.count).set(expr.add(state.count, 1))

// ✅ REQUIRED - State-guarded
flow.onceNull(state.submittedAt, ({ patch }) => {
  patch(state.submittedAt).set(expr.input("timestamp"));
  patch(state.count).set(expr.add(state.count, 1));
})
```

### 3. Errors as Values

```typescript
// ❌ FORBIDDEN - Throwing in Core/Effects
async function handler() {
  throw new Error("API failed");
}

// ✅ REQUIRED - Return patches
async function handler() {
  try {
    const result = await api.call();
    return [{ op: "set", path: "data.result", value: result }];
  } catch (error) {
    return [
      { op: "set", path: "data.status", value: "error" },
      { op: "set", path: "data.errorMessage", value: error.message }
    ];
  }
}
```

### 4. LLM as Actor, Not Authority

```typescript
// ❌ FORBIDDEN - LLM deciding
const llmDecision = await llm.verify(proposal);
if (llmDecision.approved) execute();

// ✅ REQUIRED - LLM proposes, Authority decides
world.registerActor({ actorId: "llm", kind: "agent" });
const proposal = await world.submitProposal({ actorId: "llm", intent });
// Authority (separate from LLM) evaluates
```

---

## Common Pitfalls

### Re-Entry Safety

**Problem:** Flow runs multiple times, causing unintended repeated actions.

```typescript
// ❌ BAD - Increments every compute cycle
const { increment } = actions.define({
  increment: {
    flow: flow.patch(state.count).set(
      expr.add(state.count, 1)
    ),
  },
});
```

**Solution:** Guard with state checks.

```typescript
// ✅ GOOD - Only increments once per intent
const { increment } = actions.define({
  increment: {
    input: z.object({ timestamp: z.number() }),
    flow: flow.onceNull(state.lastIncrementedAt, ({ patch }) => {
      patch(state.count).set(expr.add(state.count, 1));
      patch(state.lastIncrementedAt).set(expr.input("timestamp"));
    }),
  },
});
```

### Effect Handler Errors

**Problem:** Effect throws exception, crashes app.

```typescript
// ❌ BAD
async function apiCall(type, params): Promise<Patch[]> {
  const result = await fetch("/api");  // Might throw
  return [{ op: "set", path: "data.result", value: result }];
}
```

**Solution:** Catch and return error patches.

```typescript
// ✅ GOOD
async function apiCall(type, params): Promise<Patch[]> {
  try {
    const result = await fetch("/api");
    return [
      { op: "set", path: "data.status", value: "success" },
      { op: "set", path: "data.result", value: result }
    ];
  } catch (error) {
    return [
      { op: "set", path: "data.status", value: "error" },
      { op: "set", path: "data.errorMessage", value: error.message }
    ];
  }
}
```

### Snapshot Isolation

**Problem:** External code mutates snapshot.data.

```typescript
// ❌ BAD - External library mutates
const data = snapshot.data;
externalLibrary.process(data);  // Might mutate data!
```

**Solution:** Clone before passing out.

```typescript
// ✅ GOOD
const data = JSON.parse(JSON.stringify(snapshot.data));
externalLibrary.process(data);  // Safe to mutate clone
```

---

## When to Use Each Pattern

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| **Full-Stack Todo** | Building interactive UI apps where users directly manipulate state | Building headless agents, batch processing |
| **AI Agent with Governance** | Natural language commands need to be grounded to structured intents | All input is already structured (use Pattern 1) |
| **HITL Approval** | Sensitive operations require human/supervisor approval | All operations can be auto-approved (use Pattern 1) |

### Decision Tree

```
Is input natural language?
├─ Yes → Pattern 2 (AI Agent with Governance)
│         └─ Requires approval? → Combine with Pattern 3
│
└─ No → Is human/supervisor approval required?
         ├─ Yes → Pattern 3 (HITL Approval)
         └─ No → Pattern 1 (Full-Stack)
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layer responsibilities and boundaries |
| [Core SPEC](../packages/core/docs/SPEC.md) | Pure computation specification |
| [Host SPEC](../packages/host/docs/SPEC.md) | Host contract and obligations |
| [World SPEC](../packages/world/docs/SPEC.md) | Governance protocol |
| [Builder SPEC](../packages/builder/docs/SPEC.md) | Domain definition DSL |
| [Lab SPEC](../packages/lab/docs/SPEC.md) | Necessity levels and Lab |
| [CLAUDE.md](../CLAUDE.md) | Constitution for LLMs |

---

*End of Integration Patterns*
