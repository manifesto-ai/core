# What is Manifesto?

> **Purpose:** Introduction and navigation for understanding Manifesto
> **Audience:** Anyone new to Manifesto
> **Reading time:** 2 minutes

---

## Overview

This section answers the fundamental question: **What is Manifesto and why should I care?**

Manifesto is a semantic state layer for building AI-governed applications with deterministic computation and full accountability. But what does that mean? Why does it exist? When should you use it?

This section provides multiple entry points depending on your background and needs.

---

## What You'll Learn

### Quick Understanding

If you want to quickly grasp what Manifesto is and whether it's relevant to you:

**Start here:**
1. [One-Sentence Definitions](./one-sentence) — Manifesto explained for your specific role (3 min)
2. [The Problem Manifesto Solves](./problem) — What problems drive Manifesto's design (10 min)
3. [Manifesto vs. Others](./manifesto-vs-others) — How it compares to Redux, XState, Event Sourcing, etc. (15 min)

### Deep Understanding

If you want to understand the philosophy and architecture:

**Continue to:**
1. [Core Concepts](/core-concepts/) — Snapshot, Intent, Effect, Flow, World
2. [Architecture Overview](/architecture/) — Layered design and data flow
3. [Design Rationale](/rationale/) — Why things are the way they are

---

## Recommended Reading Order

### Path 1: Evaluator (15 minutes)

**Goal:** Decide if Manifesto is right for your project

1. [One-Sentence Definitions](./one-sentence) — Find your role, read that section
2. [The Problem Manifesto Solves](./problem) — Read "The Three Core Problems" and "Who Should Use Manifesto"
3. [Manifesto vs. Others](./manifesto-vs-others) — Compare with tools you know

**Decision point:** If Manifesto seems like a good fit, proceed to Path 2. Otherwise, you've saved time learning this isn't what you need.

### Path 2: Builder (1 hour)

**Goal:** Build your first Manifesto application

1. [Getting Started](/guides/getting-started) — Follow the tutorial
2. [Todo Example](/guides/todo-example) — See a complete application
3. [Core Concepts](/core-concepts/) — Understand Snapshot, Intent, Effect, Flow

**Outcome:** You can build basic Manifesto applications.

### Path 3: Expert (4+ hours)

**Goal:** Master Manifesto's architecture and capabilities

1. [Architecture](/architecture/) — Understand the six layers
2. [Specifications](/specifications/) — Read normative contracts
3. [Design Rationale](/rationale/) — Understand why decisions were made
4. Advanced guides: [Re-entry Safe Flows](/guides/reentry-safe-flows), [Effect Handlers](/guides/effect-handlers)

**Outcome:** You can design complex systems with Manifesto and contribute to the project.

---

## Pages in This Section

### [One-Sentence Definitions](./one-sentence)

Quick, role-specific explanations:
- For software developers
- For AI researchers
- For product managers
- For technical leaders
- Plus analogies ("Git for application state", "Constitution for your app")

**When to read:** You want a quick understanding tailored to your background.

### [The Problem Manifesto Solves](./problem)

Deep dive into the three core problems:
1. **Unpredictability** — Non-deterministic behavior, hidden state
2. **Unaccountability** — No audit trail, can't answer "who/why"
3. **Untestability** — Requires mocks, brittle tests

Plus: How Manifesto solves them, real-world scenarios, decision tree.

**When to read:** You want to understand the motivation and see if your problems match.

### [Manifesto vs. Others](./manifesto-vs-others)

Detailed comparisons with:
- Redux (state management)
- Zustand (lightweight state)
- MobX (reactive state)
- XState (finite state machines)
- Event Sourcing (event-driven architecture)
- Workflow orchestrators (Temporal, Airflow)

**When to read:** You're familiar with other tools and want to understand how Manifesto differs.

---

## Key Concepts (Quick Reference)

If you just need a cheat sheet:

| Concept | One-Liner | Learn More |
|---------|-----------|------------|
| **Manifesto** | Semantic state layer with deterministic computation and governance | [Problem](./problem) |
| **Core** | Pure semantic calculator (no IO) | [Core Concepts](/core-concepts/) |
| **Host** | Effect executor (handles IO) | [Host Concept](/core-concepts/host) |
| **World** | Governance layer (authority + audit) | [World Concept](/core-concepts/world) |
| **Snapshot** | Complete state at a point in time | [Snapshot Concept](/core-concepts/snapshot) |
| **Intent** | Request to perform an action | [Intent Concept](/core-concepts/intent) |
| **Flow** | Declarative computation (data, not code) | [Flow Concept](/core-concepts/flow) |
| **Effect** | Declaration of external operation | [Effect Concept](/core-concepts/effect) |

---

## Frequently Asked Questions

### Is Manifesto a state manager like Redux?

Partially. Manifesto provides state management, but adds:
- **Governance** (World Protocol for authority)
- **Determinism** (guaranteed same input → same output)
- **Accountability** (built-in audit trails)
- **AI-native** (schemas are JSON, perfect for LLM generation)

See [Manifesto vs. Redux](./manifesto-vs-others#manifesto-vs-redux) for details.

### Do I need AI to use Manifesto?

No. The governance, determinism, and accountability features are valuable for any application. AI governance is one use case, not a requirement.

Use Manifesto if you need:
- Deterministic computation
- Audit trails
- Complex domain logic
- Multi-actor authorization

### Is this overkill for my simple app?

Probably yes. If you're building:
- Simple UI state management → Use `useState` or Zustand
- Rapid prototype → Use Redux
- Small app with no governance → Use MobX

Manifesto is designed for complex domains where correctness, accountability, and determinism matter.

See [Who Should Use Manifesto](./problem#who-should-use-manifesto) for decision tree.

### How is this different from Event Sourcing?

**Key difference:** We store **intents** (proposals), not events (facts).

| Event Sourcing | Manifesto |
|----------------|-----------|
| Stores events | Stores intents + worlds |
| Rebuild state from events | Snapshot is source of truth |
| Event log is primary | Snapshot is primary |
| No built-in governance | World Protocol for authority |

See [Manifesto vs. Event Sourcing](./manifesto-vs-others#manifesto-vs-event-sourcing) for full comparison.

### Can I use this with my existing stack?

Yes. Manifesto is a domain layer that integrates with:
- **Frontend:** React, Vue, Svelte (via Bridge)
- **Backend:** Express, FastAPI, any framework (via Host)
- **Database:** Postgres, MongoDB, any database (via effect handlers)
- **AI:** LangChain, AutoGPT, any agent framework (via World Protocol)

Manifesto doesn't replace your stack. It provides semantic state management.

---

## Next Steps

### If You're Just Starting

1. Read [One-Sentence Definitions](./one-sentence) for your role
2. Skim [The Problem](./problem) to see if it resonates
3. If interested, try [Getting Started](/guides/getting-started)

### If You're Evaluating

1. Read [The Problem](./problem) completely
2. Read [Manifesto vs. Others](./manifesto-vs-others) for tools you know
3. Check [Specifications](/specifications/) for technical depth
4. Join our [Discord](https://discord.gg/manifesto) to ask questions

### If You're Ready to Build

1. Follow [Getting Started](/guides/getting-started)
2. Build the [Todo Example](/guides/todo-example)
3. Explore [Core Concepts](/core-concepts/)
4. Read advanced guides as needed

---

## Get Help

- **Discord:** [Join our community](https://discord.gg/manifesto)
- **GitHub:** [Discussions](https://github.com/manifesto-ai/core/discussions)
- **Documentation:** [Guides](/guides/) and [Architecture](/architecture/)

---

## Summary

**What is Manifesto?**

A semantic state layer that separates pure computation (Core) from execution (Host) and provides built-in governance (World), enabling deterministic, accountable, AI-safe applications.

**Why does it exist?**

Traditional state management mixes logic with effects, making systems non-deterministic, unaccountable, and untestable. Manifesto enforces separation of concerns.

**Who should use it?**

Applications needing deterministic computation, AI governance, audit trails, or complex domain logic.

**Who shouldn't use it?**

Simple UI state, rapid prototypes, or workflow orchestration use cases.

---

**Ready to learn more?**

Choose your path:
- **Quick:** [One-Sentence Definitions](./one-sentence)
- **Problem-focused:** [The Problem Manifesto Solves](./problem)
- **Comparison-focused:** [Manifesto vs. Others](./manifesto-vs-others)
- **Hands-on:** [Getting Started](/guides/getting-started)
