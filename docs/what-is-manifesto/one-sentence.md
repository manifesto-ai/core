# Manifesto in One Sentence

> **Purpose:** Quick, audience-specific explanations of what Manifesto is
> **Reading time:** 3 minutes

---

## The Shortest Version

**Manifesto is a semantic state layer for building AI-governed applications with deterministic computation and full accountability.**

---

## For Different Audiences

### For Software Developers

**Manifesto is Redux where reducers are data structures, effects are declarations, and every action has a built-in audit trail.**

You define domain logic as JSON-serializable schemas. Core computes pure state transitions. Host executes side effects. World governs who can do what.

**Key difference from Redux:** Core never executes IO. Effects are declarations that Host fulfills. Same input → same output, always.

### For AI Researchers

**Manifesto is a deterministic semantic runtime where LLMs can propose actions, humans can approve them, and every computation is reproducible.**

LLMs generate IntentBodies (data, not code). World Protocol evaluates authority. Core computes state transitions purely. Complete trace enables verification.

**Key property:** All domain logic is JSON-serializable, making it perfect for LLM generation and modification.

### For Product Managers

**Manifesto is a way to let AI agents help users while ensuring humans stay in control and every action is auditable.**

Think of it as "Git for application state" with built-in permissions. AI can propose changes. You define who can approve what. Every change is recorded with who, what, when, and why.

**Business value:** AI agents can work autonomously within guardrails you define. Complete compliance and audit trails built-in.

### For Technical Leaders

**Manifesto is an architecture pattern that separates pure computation from execution, enabling deterministic testing, time-travel debugging, and AI-safe state management.**

Traditional systems mix logic and effects, making them non-deterministic and hard to test. Manifesto enforces strict separation: Core computes (pure), Host executes (impure), World governs (authority).

**ROI:** Dramatically reduced debugging time, easier compliance, safer AI integration, testable business logic without mocks.

### For Distributed Systems Engineers

**Manifesto is Event Sourcing where we store Intents instead of Events, with Snapshot as the source of truth instead of event logs.**

World Protocol manages proposal → authority → decision → execution. Each committed World is content-addressable and forms a DAG. Snapshot is materialized (not rebuilt from events).

**Trade-off:** Larger storage (snapshots vs events), but instant access and guaranteed determinism.

### For Frontend Engineers

**Manifesto is a type-safe state manager where you define domains with Zod, write zero string paths, and get deterministic computation for free.**

Builder provides DSL with full TypeScript inference. React hooks (`useValue`, `useActions`) connect to state. Bridge handles event routing. No more string-based selectors.

**DX win:** IDE autocomplete for state paths, compile-time type checking, no runtime surprises.

### For Backend Engineers

**Manifesto is a pure domain layer that handles business logic while you handle persistence and infrastructure.**

Core computes state transitions. Host (your code) registers effect handlers for API calls, database access, etc. Effects return patches, not values. Snapshot is serializable.

**Integration:** Core doesn't care about your database, HTTP framework, or message queue. You provide effect handlers, Manifesto provides determinism.

### For DevOps/SRE

**Manifesto is a system where production bugs are deterministically reproducible from trace logs.**

Every computation produces a complete trace. Load production trace, replay locally, get identical result. No "works on my machine" problems.

**Ops benefit:** Incidents become reproducible test cases. Time-travel debugging without complex distributed tracing.

### For Security Engineers

**Manifesto is a framework with built-in authorization (World Protocol) and complete audit trails for every state change.**

All intents go through authority evaluation before execution. Every decision is recorded with actor, authority, reason, and timestamp. Lineage DAG tracks state provenance.

**Security model:** Defense in depth via centralized authorization. Compliance via immutable audit trail. AI safety via proposal → approval workflow.

### For Data Scientists

**Manifesto is a way to build deterministic pipelines where every transformation is traceable and reproducible.**

Flows are DAGs of transformations. Computed values are always recalculated from source. Same input → same output. Complete trace of derivation.

**ML integration:** Use Manifesto for deterministic feature engineering. Guarantee training reproducibility. Audit ML decision paths.

---

## Analogies

### Manifesto is like...

#### ...Git for Application State

Just as Git tracks every change to your codebase:
- Every commit has an author
- Every change is traceable
- You can checkout any previous state
- Merge conflicts are explicit

Manifesto does this for application state:
- Every World has an actor
- Every change is traceable through trace
- You can replay any computation
- Authority conflicts are explicit

#### ...A Constitution for Your App

Just as a constitution defines:
- Who has what authority
- What processes must be followed
- What rights are protected
- How disputes are resolved

Manifesto's World Protocol defines:
- Who can perform what actions (Authority)
- What evaluation process is followed (Proposal → Decision)
- What invariants are guaranteed (Determinism, Accountability)
- How conflicts are resolved (Authority rejection)

#### ...TypeScript for Runtime Behavior

Just as TypeScript:
- Makes JavaScript behavior explicit via types
- Catches errors at compile time
- Enables IDE autocomplete
- Is erased at runtime (compiles to JS)

Manifesto:
- Makes state transitions explicit via schemas
- Catches errors at schema-validation time
- Enables IDE autocomplete via Zod inference
- Compiles to pure computation (Core)

#### ...React Hooks for Backend Logic

Just as React hooks:
- Extract reusable stateful logic
- Compose via rules (order matters)
- Are declarative (describe, not execute)
- Provide guarantees (no class lifecycle bugs)

Manifesto Flows:
- Extract reusable domain logic
- Compose via sequencing
- Are declarative (data, not code)
- Provide guarantees (determinism, termination)

#### ...SQL for State Transformations

Just as SQL:
- Is declarative (what, not how)
- Is optimizable (query planner)
- Has guarantees (ACID)
- Is serializable (store as text)

Manifesto Flows:
- Are declarative (what to patch)
- Are optimizable (future: static analysis)
- Have guarantees (determinism, immutability)
- Are serializable (JSON schema)

---

## What Manifesto Is NOT

To clarify what Manifesto IS, here's what it is NOT:

### NOT an AI Agent Framework

**What AI frameworks do:**
- Provide agent orchestration
- Manage tool calling
- Handle LLM prompting
- Implement reasoning loops

**What Manifesto does:**
- Provides semantic state layer
- Manages authority for AI actions
- Ensures deterministic execution
- Generates audit trails

**Use together:** Use LangChain/AutoGPT/etc. for agent logic, use Manifesto for state management.

### NOT a Workflow Orchestrator

**What workflow orchestrators do (Temporal, Airflow):**
- Execute long-running processes (hours/days)
- Manage distributed execution
- Handle durable workflows
- Provide retry/compensation

**What Manifesto does:**
- Compute state transitions (ms/seconds)
- Ensure deterministic computation
- Declare requirements (not execute them)
- Guarantee termination

**Use together:** Use Temporal for orchestration, use Manifesto for domain logic.

### NOT a Database

**What databases do:**
- Persist data
- Query data
- Handle concurrent access
- Manage transactions

**What Manifesto does:**
- Compute state transitions
- Validate schemas
- Apply patches
- Generate traces

**Use together:** Use Postgres/MongoDB/etc. for persistence, use Manifesto for computation. Host connects them.

### NOT a Backend Framework

**What backend frameworks do (Express, FastAPI):**
- Handle HTTP requests
- Route endpoints
- Manage middleware
- Serve responses

**What Manifesto does:**
- Define domain semantics
- Compute state transitions
- Ensure governance
- Generate patches

**Use together:** Use Express/FastAPI for HTTP layer, use Manifesto for domain layer.

### NOT Event Sourcing

**Similarities:**
- Both maintain history
- Both enable replay
- Both provide audit trails

**Differences:**
- Event Sourcing stores events (facts), Manifesto stores intents (proposals)
- Event Sourcing rebuilds state from events, Manifesto stores snapshots
- Event Sourcing focuses on temporal queries, Manifesto focuses on determinism

**When to use which:** Event Sourcing if event log is primary model, Manifesto if deterministic computation is priority.

---

## The Core Mental Model

The simplest way to understand Manifesto:

```
Traditional systems mix three concerns:
  What should happen (logic)
  How to execute it (effects)
  Who can do it (authorization)

Manifesto separates them:
  Core:  What should happen (pure computation)
  Host:  How to execute it (effect handlers)
  World: Who can do it (authority evaluation)
```

**Why this matters:**

- **What** is testable without mocks
- **How** is replaceable (mock APIs, swap databases)
- **Who** is auditable (compliance, security)

**The guarantee:**

```typescript
compute(schema, snapshot, intent) → (snapshot', requirements, trace)
```

Same inputs → same outputs, **always**.

---

## Quick Reference Card

| Question | Answer |
|----------|--------|
| **What is it?** | Semantic state layer with deterministic computation |
| **Who is it for?** | Apps needing AI governance, accountability, or determinism |
| **How is it different?** | Pure computation separated from execution |
| **What's the main benefit?** | Same input → same output, always. Plus audit trails. |
| **What's the trade-off?** | More upfront structure, less imperative flexibility |
| **When should I use it?** | Complex domains, AI agents, compliance requirements |
| **When shouldn't I use it?** | Simple UI state, rapid prototyping, workflow orchestration |

---

## The Elevator Pitch

**30 seconds:**

"Manifesto separates pure computation from effect execution, giving you deterministic state management with built-in audit trails. Perfect for AI-governed applications where you need to know who did what, when, and why. Core computes, Host executes, World governs."

**60 seconds:**

"Traditional state management mixes business logic with side effects, making it non-deterministic and hard to test. Manifesto splits them: Core computes pure state transitions (same input → same output), Host executes effects and returns patches, World governs who can do what. This gives you deterministic testing without mocks, complete audit trails for compliance, and safe AI agent integration. All domain logic is JSON-serializable, making it perfect for LLM generation and modification."

**2 minutes:**

"Modern applications have three problems: they're unpredictable (side effects everywhere), unaccountable (who changed what?), and untestable (mocks required). Manifesto solves these by enforcing architectural separation.

Core is a pure semantic calculator. Given a schema, snapshot, and intent, it computes patches and effect requirements. Same inputs always produce same outputs. Testable without mocks.

Host executes those effects (API calls, database access). Effects return patches, not values. Everything flows through Snapshot—no hidden state.

World manages governance. All intents go through authority evaluation. Every decision is recorded with who, what, when, why.

The result? Deterministic computation, complete accountability, and AI-safe state management. Perfect for applications where correctness, compliance, and AI governance matter."

---

## Related Documents

- [The Problem Manifesto Solves](/what-is-manifesto/problem) - Detailed problem analysis
- [Manifesto vs. Others](/what-is-manifesto/manifesto-vs-others) - Comparison with alternatives
- [What is Manifesto?](/what-is-manifesto/) - Section overview
- [Core Concepts](/core-concepts/) - Deep dive into key concepts
