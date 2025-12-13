# Section 1 -- Overview

## 1.1 Introduction

**Manifesto Core** is a semantic state protocol designed for AI-native applications. It provides a structured approach for AI agents to interact with application state through semantic addressing, declarative computations, and explicit side effects.

Traditional application architectures scatter business logic across UI components, event handlers, and backend services. Manifesto consolidates this logic into a single, declarative domain model that both humans and AI agents can understand and manipulate.

### 1.1.1 Purpose

This specification defines:

1. **DomainSnapshot**: The structure representing application state at a point in time
2. **SemanticPath**: The addressing system for accessing values within a snapshot
3. **Expression**: A declarative DSL for computing derived values
4. **Effect**: A type system for describing side effects
5. **Execution**: The runtime model for propagating changes and executing effects

### 1.1.2 Audience

This specification is intended for:

- Library implementers creating Manifesto-compatible runtimes
- Tool developers building code generators, validators, or debuggers
- Platform developers integrating Manifesto into frameworks

---

## 1.2 Design Principles

Manifesto Core is built on five foundational principles:

### 1.2.1 Semantic-First

Every value in a Manifesto domain has a **SemanticPath** - a unique, meaningful address that describes what the value represents.

```
data.user.email       // User's email address
state.cart.isOpen     // Whether cart drawer is open
derived.order.total   // Computed order total
actions.checkout      // Checkout action
```

This addressing scheme enables AI agents to understand application state without visual interpretation.

### 1.2.2 Declarative

Business rules are expressed as **data**, not code. Expressions are JSON-serializable structures that can be:

- Statically analyzed for dependencies
- Optimized before execution
- Understood by AI agents

**Example № 1** *Declarative expression*

```typescript
// A derived value that computes cart total
{
  deps: ['data.cart.items'],
  expr: ['reduce', ['get', 'data.cart.items'],
    ['+', ['get', '$acc'], ['*', ['get', '$.price'], ['get', '$.quantity']]],
    0
  ]
}
```

### 1.2.3 Observable

All state changes are **explicit** and **traceable**:

- Snapshots are immutable and versioned
- Changes produce new snapshots with incremented versions
- Diff computation identifies exactly what changed

### 1.2.4 Deterministic

Given the same inputs, Manifesto produces the same outputs:

- Expression evaluation is pure (no side effects)
- Derived values are computed from a directed acyclic graph (DAG)
- Effect execution follows predictable ordering

### 1.2.5 AI-Readable

The domain model is designed for machine comprehension:

- Semantic metadata describes the purpose of each value
- Preconditions explain when actions are available
- Effect descriptions document what will happen

---

## 1.3 Architecture Overview

### 1.3.1 Three-Layer Architecture

Manifesto follows a three-layer architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Projection Layer                      │
│  (UI Projection, Agent Projection, GraphQL Projection)  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      Domain Layer                        │
│        (ManifestoDomain + DomainRuntime)                │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      Bridge Layer                        │
│     (Adapters for External State: Zustand, Forms)       │
└─────────────────────────────────────────────────────────┘
```

1. **Domain Layer**: The core semantic model and runtime
2. **Projection Layer**: View transformations for different consumers
3. **Bridge Layer**: Adapters connecting to external state management

### 1.3.2 Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Input   │────►│ Snapshot │────►│   DAG    │────►│  Output  │
│ (Effect) │     │ (State)  │     │(Compute) │     │(Derived) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │                                                   │
      │                                                   │
      ▼                                                   ▼
┌──────────┐                                       ┌──────────┐
│  Async   │                                       │  Events  │
│ Effects  │                                       │ (UI/Log) │
└──────────┘                                       └──────────┘
```

1. Effects modify `data` or `state` namespaces
2. Changes trigger DAG propagation
3. Derived values are recomputed in topological order
4. Async effects may be triggered by conditions
5. Events are emitted for external consumption

---

## 1.4 Core Abstractions

### 1.4.1 DomainSnapshot

A **DomainSnapshot** represents the complete state of a domain at a specific point in time. It contains four namespaces:

| Namespace | Purpose | Writability |
|-----------|---------|-------------|
| `data` | User input and domain data | Writable via `SetValueEffect` |
| `state` | System and async state | Writable via `SetStateEffect` |
| `derived` | Computed values | Read-only (auto-computed) |
| `validity` | Validation results | Read-only (auto-computed) |

See [Section 2 -- Snapshot](./Section%202%20--%20Snapshot.md) for the complete specification.

### 1.4.2 SemanticPath

A **SemanticPath** is a string that uniquely identifies a value within a snapshot. Paths follow dot notation with optional bracket access for arrays:

```
data.users[0].name
state.form.errors
derived.analytics.conversionRate
```

See [Section 3 -- Semantic Path](./Section%203%20--%20Semantic%20Path.md) for the complete specification.

### 1.4.3 Expression

An **Expression** is a JSON-serializable structure that computes a value. Expressions are pure functions with no side effects.

```typescript
// Simple literal
42

// Path access
['get', 'data.user.age']

// Arithmetic
['+', ['get', 'data.price'], ['get', 'data.tax']]

// Conditional
['case',
  [['<', ['get', 'data.age'], 18], 'minor'],
  [['<', ['get', 'data.age'], 65], 'adult'],
  'senior'
]
```

See [Section 5 -- Expression](./Section%205%20--%20Expression.md) for the complete specification.

### 1.4.4 Effect

An **Effect** describes a side effect to be executed. Effects are data until executed by the runtime.

Manifesto defines ten effect types:

| Category | Effects |
|----------|---------|
| State | `SetValueEffect`, `SetStateEffect` |
| IO | `ApiCallEffect`, `NavigateEffect` |
| Temporal | `DelayEffect` |
| Control | `SequenceEffect`, `ParallelEffect`, `ConditionalEffect`, `CatchEffect` |
| Event | `EmitEventEffect` |

See [Section 4 -- Effect](./Section%204%20--%20Effect.md) for the complete specification.

### 1.4.5 Dependency Graph (DAG)

The runtime builds a **Directed Acyclic Graph** from path dependencies. When values change, the DAG determines:

1. Which derived values need recomputation
2. The order of recomputation (topological sort)
3. Which async effects should trigger

See [Section 7 -- Execution](./Section%207%20--%20Execution.md) for the complete specification.

---

## 1.5 Glossary

| Term | Definition |
|------|------------|
| **Action** | A named operation with preconditions and effects |
| **Bridge** | An adapter connecting external state to the runtime |
| **DAG** | Directed Acyclic Graph for dependency tracking |
| **Domain** | A complete business model definition |
| **Effect** | A description of a side effect |
| **Expression** | A declarative computation |
| **Namespace** | A top-level category within a snapshot |
| **Path** | See SemanticPath |
| **Precondition** | A requirement that must be satisfied before an action |
| **Projection** | A view transformation of the domain |
| **Propagation** | The process of updating derived values after changes |
| **Runtime** | The engine that executes the domain model |
| **Schema** | A Zod type definition for validation |
| **SemanticMeta** | Metadata describing a path's purpose |
| **SemanticPath** | A unique address for a value |
| **Snapshot** | Complete state at a point in time |
| **Source** | An external input path |
| **Validation** | The process of checking value correctness |

---

## 1.6 Document Organization

This specification is organized as follows:

- **Section 1 (this section)**: Overview and introduction
- **Section 2**: DomainSnapshot structure and operations
- **Section 3**: SemanticPath syntax and resolution
- **Section 4**: Effect types and semantics
- **Section 5**: Expression DSL
- **Section 6**: Validation rules
- **Section 7**: Execution model and runtime

Appendices provide:

- **Appendix A**: Notation conventions
- **Appendix B**: Complete grammar summary
