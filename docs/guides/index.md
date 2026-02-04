# Guides

> **Purpose:** Practical tutorials for building with Manifesto
> **Audience:** Developers building applications
> **Focus:** How to accomplish specific tasks

::: tip Recommended Starting Point
For new users, we recommend starting with the **[@manifesto-ai/app Guide](/quickstart)** which covers MEL + the high-level App API.

The guides below cover low-level APIs (Core, Host, World) for advanced use cases.
:::

---

## What Are Guides?

Guides are **hands-on tutorials** that show you how to accomplish specific tasks with Manifesto.

Unlike specifications (which define requirements) or concepts (which explain ideas), guides are **operational** — they give you confidence to build.

**When to use guides:**
- Learning Manifesto for the first time
- Implementing a specific feature
- Solving a common problem
- Understanding patterns through examples

**When NOT to use guides:**
- Understanding architecture (use [Architecture](/architecture/) instead)
- Implementing Manifesto internals (use [Specifications](/internals/spec/) instead)
- Understanding design rationale (use [Rationale](/internals/fdr/) instead)

---

## Available Guides

### [Getting Started](./getting-started)

**Goal:** Build your first Manifesto application in 15 minutes

**What you'll build:** A counter application with increment, decrement, and reset actions

**What you'll learn:**
- Defining domains with MEL
- Creating and using the App
- Dispatching intents
- Adding computed values
- Handling effects

**Prerequisites:** Basic TypeScript, Node.js installed

**Reading time:** 20 minutes
**Coding time:** 15 minutes

**Start here if:** You're new to Manifesto and want hands-on experience.

---

### [Todo Example](./todo-example)

**Goal:** Build a complete todo application with CRUD operations

**What you'll build:** Todo app with filtering, persistence, and effects

**What you'll learn:**
- CRUD operations (create, read, update, delete)
- Array manipulation with expressions
- Filtering and computed values
- Effect handlers for persistence
- React integration (optional)

**Prerequisites:** Getting Started guide completed

**Reading time:** 30 minutes
**Coding time:** 45 minutes

**Start here if:** You want a realistic, complete example.

---

### [Re-entry Safe Flows](./reentry-safe-flows)

**Goal:** Write flows that don't cause infinite loops

**What you'll learn:**
- What re-entry is and why it's dangerous
- Detecting re-entry problems
- State-guarding patterns
- Common safe patterns
- Testing for re-entry safety

**Prerequisites:** Getting Started guide completed

**Reading time:** 25 minutes

**Start here if:** Your flows run multiple times or cause infinite loops.

---

### [Effect Handlers](./effect-handlers)

**Goal:** Write robust effect handlers for API calls, database access, etc.

**What you'll learn:**
- Effect handler contract
- Returning patches (not values)
- Error handling patterns
- Async operations
- Testing effect handlers

**Prerequisites:** Getting Started guide completed

**Reading time:** 30 minutes

**Start here if:** You need to integrate with external systems (API, database, etc.).

---

### [Debugging](./debugging)

**Goal:** Debug Manifesto applications effectively

**What you'll learn:**
- Understanding Trace
- Common debugging patterns
- State inspection techniques
- Time-travel debugging
- Browser DevTools integration
- Performance debugging

**Prerequisites:** Getting Started guide completed

**Reading time:** 20 minutes

**Start here if:** You're stuck and need debugging strategies.

---

### [Performance Report](./performance-report)

**Goal:** Review benchmark results for Core, Host, and World on real workloads

**What you'll learn:**
- Benchmark methodology and scenarios
- Throughput and latency results (p50/p95/p99)
- Memory growth trends under snapshot retention
- Reproduction commands for your own environment

**Prerequisites:** `pnpm build` (benchmarks use `dist/` outputs)

**Reading time:** 10 minutes

**Start here if:** You need performance baselines or want to validate deployment readiness.

---

### [Vercel Web Analytics](./vercel-web-analytics)

**Goal:** Set up Vercel Web Analytics to track visitors and page views in your application

**What you'll learn:**
- How to enable Web Analytics in your Vercel project
- Installing and configuring the `@vercel/analytics` package
- Framework-specific integration instructions
- Deploying and verifying your analytics setup
- Viewing analytics data in the Vercel dashboard

**Prerequisites:** A Vercel account and project, Vercel CLI installed

**Reading time:** 15 minutes

**Start here if:** You want to add analytics tracking to your Vercel-deployed application.

---

### [AI Agent Integration](./ai-agent-integration)

**Goal:** Integrate AI agents with Manifesto using the Translator pipeline

**What you'll build:** AI-powered task management with natural language input

**What you'll learn:**
- Setting up the Translator pipeline
- Converting natural language to Intent Graphs
- Human-in-the-loop approval patterns
- Configuring Authority for AI actors
- MEL code generation patterns
- Handling extension candidates

**Prerequisites:** Getting Started guide completed, basic understanding of LLMs

**Reading time:** 30 minutes
**Coding time:** 45 minutes

**Start here if:** You want AI agents to interact with your Manifesto application.

---

### [Schema Evolution](./schema-evolution)

**Goal:** Understand the vision for AI-driven schema changes

**What you'll learn:**
- Why Schema is a first-class object in Manifesto
- Planned patterns for field addition, type refinement, and relations
- Migration strategies and safety guarantees
- Current status and roadmap

**Prerequisites:** Core concepts understood

**Reading time:** 20 minutes

**Start here if:** You want to understand how Manifesto will support AI-driven domain evolution.

---

## Recommended Learning Path

### Path 1: Beginner (2-3 hours)

**Goal:** Build basic Manifesto applications

1. **[Getting Started](./getting-started)** — First application (35 min)
2. **[Todo Example](./todo-example)** — Complete CRUD app (1h 15min)
3. **[Re-entry Safe Flows](./reentry-safe-flows)** — Avoid infinite loops (25 min)

**Outcome:** You can build Manifesto apps with basic features.

---

### Path 2: Intermediate (4-5 hours)

**Goal:** Build production-ready applications

1. Complete Path 1
2. **[Effect Handlers](./effect-handlers)** — External integration (30 min)
3. **[Debugging](./debugging)** — Troubleshooting (20 min)
4. **[Core Concepts](/concepts/)** — Deep understanding (1 hour)
5. **[Architecture](/architecture/)** — System design (1 hour)

**Outcome:** You can build robust, production-ready Manifesto apps.

---

### Path 3: Advanced (8+ hours)

**Goal:** Master Manifesto and contribute

1. Complete Path 2
2. **[Specifications](/internals/spec/)** — Normative contracts (2 hours)
3. **[Rationale](/internals/fdr/)** — Design decisions (1.5 hours)
4. **Advanced patterns:** Custom authorities, multi-tenant systems
5. **Contribute:** Build tools, write docs, submit PRs

**Outcome:** You can design complex systems, extend Manifesto, and contribute to the project.

---

### Path 4: AI Integration (2-3 hours)

**Goal:** Build AI-powered Manifesto applications

1. **[AI Native OS Layer](/concepts/ai-native-os-layer)** — Core identity (15 min)
2. **[AI Agent Integration](./ai-agent-integration)** — Practical guide (1h 15min)
3. **[Schema Evolution](./schema-evolution)** — Vision and roadmap (20 min)
4. **[World Concept](/concepts/world)** — Authority for AI (30 min)

**Outcome:** You can integrate AI agents with Manifesto, configure appropriate authorities, and understand the AI-native vision.

---

## Guide Format

All guides follow this structure:

### 1. Goal

What you'll accomplish by the end.

### 2. Prerequisites

What you need to know or have installed.

### 3. Step-by-Step Instructions

Concrete steps with code examples.

### 4. Explanation

Why each step works.

### 5. Common Mistakes

What beginners often get wrong.

### 6. Next Steps

Where to go from here.

---

## Common Patterns Across Guides

### Pattern 1: State Guards

**When:** Preventing re-entry or checking conditions

**Example:**

```typescript
// Only run if not already initialized
flow.onceNull(state.initialized, ({ patch }) => {
  patch(state.initialized).set(expr.lit(true));
  // ... initialization logic
})
```

MEL equivalent:

```mel
action init() {
  when isNull(initialized) {
    patch initialized = true
  }
}
```

**Guides using this:** Re-entry Safe Flows, Effect Handlers

---

### Pattern 2: Effect + Patch

**When:** Performing IO and updating state

**Example:**

```typescript
// Flow declares effect
flow.seq(
  flow.effect('api:fetchUser', { id: expr.input('id') }),
  // Effect handler returns patches
  // Next compute reads from snapshot.data.user
)

// Host handler
host.registerEffect('api:fetchUser', async (type, params) => {
  const user = await fetch(`/api/users/${params.id}`).then(r => r.json());
  return [{ op: 'set', path: 'user', value: user }];
});
```

MEL equivalent:

```mel
action fetchUser(id: string) {
  when true {
    effect api:fetchUser({ id: id })
  }
}
```

**Guides using this:** Getting Started, Todo Example, Effect Handlers

---

### Pattern 3: Conditional Flow

**When:** Branching logic based on state

**Example:**

```typescript
flow.when(
  expr.eq(state.filter, 'completed'),
  flow.patch(state.showCompleted).set(expr.lit(true))
)
```

MEL equivalent:

```mel
action showCompleted() {
  when eq(filter, "completed") {
    patch showCompleted = true
  }
}
```

**Guides using this:** Todo Example, Re-entry Safe Flows

---

### Pattern 4: Array Operations

**When:** Adding, removing, or filtering items

**Example:**

```typescript
// Add item
flow.patch(state.todos).set(
  expr.append(state.todos, newTodo)
)

// Remove item
flow.patch(state.todos).set(
  expr.filter(state.todos, t => expr.not(expr.eq(t.id, idToRemove)))
)

// Update item
flow.patch(state.todos).set(
  expr.map(state.todos, t =>
    expr.cond(
      expr.eq(t.id, idToUpdate),
      expr.merge(t, expr.object({ completed: expr.lit(true) })),
      t
    )
  )
)
```

MEL equivalent:

```mel
action updateTodo(idToUpdate: string) {
  when true {
    patch todos = map(todos, cond(
      eq($item.id, idToUpdate),
      merge($item, { completed: true }),
      $item
    ))
  }
}
```

**Guides using this:** Getting Started, Todo Example

---

## Troubleshooting Common Issues

### "My flow runs multiple times"

**Problem:** Re-entry loop

**Solution:** Add state guards

**Guide:** [Re-entry Safe Flows](./reentry-safe-flows)

---

### "Effect handler never called"

**Problem:** Effect not declared or handler not registered

**Solution:** Check `requirements` in trace, verify handler registration

**Guide:** [Effect Handlers](./effect-handlers), [Debugging](./debugging)

---

### "State not updating"

**Problem:** Conditional didn't match or patch applied to wrong path

**Solution:** Inspect trace, verify conditions

**Guide:** [Debugging](./debugging)

---

### "Schema validation failed"

**Problem:** Initial state doesn't match Zod schema

**Solution:** Verify initial data matches schema

**Guide:** [Getting Started](./getting-started)

---

## Quick Reference: When to Use Which Guide

| You Want To... | Use This Guide |
|----------------|----------------|
| Build your first app | [Getting Started](./getting-started) |
| Build a complete CRUD app | [Todo Example](./todo-example) |
| Prevent infinite loops | [Re-entry Safe Flows](./reentry-safe-flows) |
| Call APIs or databases | [Effect Handlers](./effect-handlers) |
| Debug problems | [Debugging](./debugging) |
| Integrate AI agents | [AI Agent Integration](./ai-agent-integration) |
| Understand schema evolution | [Schema Evolution](./schema-evolution) |

---

## Coming Soon

These guides are planned:

- **Advanced React Patterns** — Complex UI patterns with App subscribe API
- **Testing Strategies** — Unit, integration, and E2E testing
- **Multi-Tenant Applications** — Building SaaS with World Protocol
- **Performance Optimization** — Making Manifesto apps fast
- **Production Deployment** — Running Manifesto in production

Want to contribute a guide? See [Contributing](https://github.com/manifesto-ai/core/blob/main/CONTRIBUTING.md).

---

## How to Get Help

### If You're Stuck

1. Check **[Debugging](./debugging)** guide
2. Review **[Manifesto vs. Others](/concepts/)** for comparisons
3. Search **[GitHub Discussions](https://github.com/manifesto-ai/core/discussions)**
4. Ask in **[Discord](https://discord.gg/manifesto)**

### If You Found a Bug

1. Verify it's not in **[Debugging](./debugging)** or **[Re-entry Safe Flows](./reentry-safe-flows)**
2. Create minimal reproduction
3. Open **[GitHub Issue](https://github.com/manifesto-ai/core/issues)**

### If You Want a New Guide

1. Check "Coming Soon" list above
2. Open **[GitHub Discussion](https://github.com/manifesto-ai/core/discussions)** requesting it
3. Consider contributing it yourself!

---

## Contributing Guides

We welcome guide contributions! See our [Guide Writing Guidelines](https://github.com/manifesto-ai/core/blob/main/docs/GUIDE_TEMPLATE.md).

**Good guide topics:**
- Common patterns you discovered
- Integration with popular libraries
- Solutions to frequent problems
- Complete example applications

**Guide requirements:**
- Working code examples
- Step-by-step instructions
- Common mistakes section
- Tested on latest version

---

## Summary

**Guides are for builders.** They show you how to accomplish tasks with Manifesto.

**Start with:**
1. [Getting Started](./getting-started) — Your first app
2. [Todo Example](./todo-example) — Complete example
3. [Re-entry Safe Flows](./reentry-safe-flows) — Avoid pitfalls

**Then explore:**
- [Effect Handlers](./effect-handlers) — External integration
- [Debugging](./debugging) — Troubleshooting

**Finally master:**
- [Core Concepts](/concepts/) — Deep understanding
- [Architecture](/architecture/) — System design
- [Specifications](/internals/spec/) — Normative contracts

---

**Ready to build? Start with [Getting Started](./getting-started).**
