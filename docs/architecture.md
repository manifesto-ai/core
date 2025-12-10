# Manifesto AI Architecture

This document describes the high-level architecture of Manifesto AI.

## Overview

Manifesto AI follows a **3-layer architecture** that separates concerns between core business logic, framework integration, and consumer-specific projections.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROJECTION LAYER                              │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │ projection-ui │  │ projection-   │  │ projection-graphql      │  │
│  │               │  │ agent         │  │                         │  │
│  │ UI States     │  │ AI Context    │  │ GraphQL Schema          │  │
│  │ Field/Action  │  │ Suggestions   │  │ Resolvers               │  │
│  │ Events        │  │ Risk Analysis │  │ Subscriptions           │  │
│  └───────────────┘  └───────────────┘  └─────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Reads state, metadata, policies
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          BRIDGE LAYER                                │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐   │
│  │   bridge     │  │ bridge-       │  │ bridge-react-hook-form  │   │
│  │   (vanilla)  │  │ zustand       │  │                         │   │
│  │              │  │               │  │                         │   │
│  │ Adapter/     │  │ Zustand       │  │ React Hook Form         │   │
│  │ Actuator     │  │ Integration   │  │ Integration             │   │
│  └──────────────┘  └───────────────┘  └─────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Syncs state bidirectionally
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           CORE LAYER                                 │
│  ┌─────────┐ ┌───────────┐ ┌────────┐ ┌─────┐ ┌─────────┐          │
│  │ Domain  │ │Expression │ │ Effect │ │ DAG │ │ Runtime │          │
│  │         │ │    DSL    │ │        │ │     │ │         │          │
│  │ Schema  │ │           │ │ Result │ │Graph│ │Snapshot │          │
│  │ Actions │ │ Evaluator │ │ Runner │ │     │ │ Subs    │          │
│  │ Policies│ │ Analyzer  │ │        │ │     │ │         │          │
│  └─────────┘ └───────────┘ └────────┘ └─────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Core Layer (`@manifesto-ai/core`)

The foundation of Manifesto AI. This layer is framework-agnostic and contains pure business logic.

#### Domain Module

Defines the structure and rules of your business domain:

```typescript
const domain = defineDomain('order', {
  dataSchema: z.object({ ... }),     // Source of truth
  stateSchema: z.object({ ... }),    // UI state
  derived: { ... },                   // Computed values
  async: { ... },                     // Async data sources
  actions: { ... },                   // Domain operations
  fieldPolicies: { ... }             // Field-level policies
});
```

**Key concepts:**
- **dataSchema**: Persistent business data
- **stateSchema**: Transient UI state
- **derived**: Computed from data/state
- **async**: External data with caching
- **actions**: Operations with preconditions and effects
- **fieldPolicies**: Relevance, editability, requirements

#### Expression Module

JSON-based DSL for declarative logic:

```typescript
// Instead of: total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
const expression = {
  $sum: {
    $map: [
      { $get: 'data.items' },
      { $multiply: ['$item.price', '$item.quantity'] }
    ]
  }
};
```

**Features:**
- Type-safe evaluation
- Path extraction for dependencies
- Expression analysis and optimization
- String representation for debugging

#### Effect Module

Safe side-effect handling using monadic patterns:

```typescript
const submitEffect = sequence([
  setState('state.isSubmitting', true),
  apiCall({ method: 'POST', url: '/api/orders', body: { $get: 'data' } }),
  conditional(
    { $get: 'response.success' },
    navigate('/success'),
    setState('state.error', { $get: 'response.error' })
  ),
  setState('state.isSubmitting', false)
]);
```

**Effect types:**
- `setValue` / `setState`: State modifications
- `apiCall`: HTTP requests
- `navigate`: URL navigation
- `delay`: Timing
- `sequence` / `parallel`: Composition
- `conditional` / `catchEffect`: Control flow

#### DAG Module

Dependency tracking using Directed Acyclic Graphs:

```
data.items ──┐
             ├──► derived.total ──► derived.canCheckout
data.tax ────┘                            │
                                          ▼
state.isSubmitting ─────────────► action.submit.available
```

**Capabilities:**
- Automatic dependency detection
- Efficient propagation
- Cycle detection
- Impact analysis

#### Runtime Module

Execution engine that ties everything together:

```typescript
const runtime = createRuntime(domain, { initialData, initialState });

// Read any path
runtime.get('data.items');
runtime.get('derived.total');
runtime.get('state.isLoading');

// Write data/state
runtime.set('data.items', newItems);
runtime.set('state.filter', 'active');

// Subscribe to changes
runtime.subscribe('derived.total', (value) => { ... });

// Execute actions
await runtime.executeAction('submit', { orderId: '123' });

// Check action availability
runtime.checkAction('submit');  // { available: true, reason: null }

// Explain values
runtime.explain('derived.total');
```

### Bridge Layer

Connects Manifesto runtime to external state management systems.

#### Adapter/Actuator Pattern

```
┌─────────────────┐                   ┌─────────────────┐
│  External Store │                   │    Manifesto    │
│                 │                   │    Runtime      │
│  (Zustand,      │    Adapter        │                 │
│   Redux,        │ ───────────────►  │    Snapshot     │
│   RHF, etc.)    │   Reads & Syncs   │                 │
│                 │                   │                 │
│                 │    Actuator       │                 │
│                 │ ◄───────────────  │    Effects      │
│                 │   Writes & Acts   │                 │
└─────────────────┘                   └─────────────────┘
```

**Adapter**: Reads from external store → updates runtime
**Actuator**: Receives commands from runtime → updates external store

#### Bridge Implementation

```typescript
// Create bridge
const bridge = createBridge({
  runtime,
  adapter: createZustandAdapter(store, { dataSelector: ... }),
  actuator: createZustandActuator(store, { setData: ... })
});

// Execute commands through bridge
await bridge.execute(setValue('data.name', 'John'));
await bridge.execute(executeAction('submit'));
```

### Projection Layer

Transforms runtime state for specific consumers.

#### UI Projection (`projection-ui`)

Converts domain policies to UI states:

```
Domain Policy          UI State
─────────────────────────────────
relevance    ──────►   visible
editability  ──────►   enabled
requirement  ──────►   required
validation   ──────►   errors
```

```typescript
const manager = createProjectionManager({ runtime, domain, fields: { paths } });

const fieldState = manager.getFieldState('data.email');
// { visible: true, enabled: true, required: true, validation: { valid: false, issues: [...] } }
```

#### Agent Projection (`projection-agent`)

Creates AI-consumable context:

```typescript
const context = projectAgentContext(runtime, domain);
// {
//   summary: 'Order is 75% complete with 2 issues',
//   paths: Map<path, { value, type, editable, required, formatted }>,
//   actions: Map<actionId, { available, blockedReasons, effects, risk }>,
//   suggestion: { action: 'submit', reason: '...', confidence: 0.9 }
// }
```

**Features:**
- Value formatting
- Action analysis
- Risk assessment
- Smart suggestions

#### GraphQL Projection (`projection-graphql`)

Generates GraphQL API from domain:

```typescript
const schema = generateGraphQLSchema(domain);
const resolvers = createResolvers(domain);

// Generated:
// - Query: domain, domainField, domainPolicies, domainActions
// - Mutation: setDomainField, domainActionName
// - Subscription: domainChanged, domainFieldChanged
```

## Data Flow

### Read Flow

```
User/AI requests data
         │
         ▼
┌─────────────────┐
│  Projection     │  Formats, analyzes, projects
│    Layer        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Runtime       │  Evaluates expressions, checks policies
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Snapshot      │  Source of truth
│   (data/state)  │
└─────────────────┘
```

### Write Flow

```
User/AI makes change
         │
         ▼
┌─────────────────┐
│    Bridge       │  Validates, transforms
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Runtime       │  Applies change to snapshot
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      DAG        │  Propagates to dependents
│  Propagation    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Subscriptions  │  Notifies listeners
│                 │
└────────┬────────┘
         │
         ├──────────────────────────┐
         ▼                          ▼
┌─────────────────┐      ┌─────────────────┐
│   Projections   │      │   External      │
│   Update        │      │   Stores        │
└─────────────────┘      └─────────────────┘
```

### Action Execution Flow

```
Execute Action Request
         │
         ▼
┌─────────────────┐
│   Runtime       │  Check preconditions
│                 │
└────────┬────────┘
         │
         ▼
    Preconditions
    Satisfied?
    /          \
   No          Yes
   │            │
   ▼            ▼
┌──────┐  ┌─────────────┐
│Return│  │Build Effect │
│Error │  │Descriptor   │
└──────┘  └──────┬──────┘
                 │
                 ▼
         ┌─────────────┐
         │Run Effect   │
         │Handler      │
         └──────┬──────┘
                │
         ┌──────┴──────┐
         │             │
         ▼             ▼
    ┌────────┐   ┌─────────┐
    │Internal│   │External │
    │Effects │   │Effects  │
    │(set)   │   │(api)    │
    └────────┘   └─────────┘
                      │
                      ▼
              ┌─────────────┐
              │Result<T>    │
              │Ok | Err     │
              └─────────────┘
```

## Key Design Decisions

### 1. Semantic Paths

Every value has a unique, meaningful address:

```
data.user.profile.name      # Business data
state.form.isSubmitting     # UI state
derived.user.fullName       # Computed value
async.user.permissions      # Async data
```

**Benefits:**
- AI can reference specific values
- Debugging is straightforward
- Subscriptions are granular
- Policies can target specific paths

### 2. Expression DSL over Code

Expressions are data, not executable code:

```typescript
// Instead of functions
const isValid = (data) => data.email.includes('@') && data.age >= 18;

// We use expressions
const isValid = {
  $and: [
    { $includes: [{ $get: 'data.email' }, '@'] },
    { $gte: [{ $get: 'data.age' }, 18] }
  ]
};
```

**Benefits:**
- Serializable (JSON)
- Analyzable (dependencies, purity)
- AI-readable and writable
- Transformable (optimization)

### 3. Effects as Descriptions

Side effects are described, not executed immediately:

```typescript
// This doesn't make an API call
const effect = apiCall({ method: 'POST', url: '/api/orders' });

// This does
await runEffect(effect, runtime, { apiHandler: fetch });
```

**Benefits:**
- Testable without mocking
- Composable safely
- Predictable execution order
- Traceable for debugging

### 4. Result Type for Errors

Errors are values, not exceptions:

```typescript
const result = await runEffect(effect, runtime);

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.log('Error:', result.error.code, result.error.message);
}
```

**Benefits:**
- Type-safe error handling
- Forced error consideration
- Composable error chains
- No surprise exceptions

## Package Dependencies

```
@manifesto-ai/core (no dependencies except zod)
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
@manifesto-ai/bridge              @manifesto-ai/projection-ui
         │                                 │
         ├───────────┐                     │
         │           │                     │
         ▼           ▼                     │
bridge-zustand  bridge-react-hook-form     │
                                           │
                     ┌─────────────────────┘
                     │
                     ▼
          @manifesto-ai/projection-agent
                     │
                     │
                     ▼
          @manifesto-ai/projection-graphql
```

All packages depend on `@manifesto-ai/core` as a peer dependency.

## Extension Points

### Custom Adapters

Implement `Adapter` interface for new state management systems.

### Custom Actuators

Implement `Actuator` interface for custom side-effect handling.

### Custom Projections

Create new projection layers by consuming runtime state and domain definitions.

### Custom Effect Handlers

Provide custom handlers for `apiCall`, `navigate`, and other effects.

### Custom Formatters

Add domain-specific value formatters for agent projection.

## Further Reading

- [Getting Started](./getting-started.md) - Quick tutorial
- [Core Concepts](./concepts.md) - Deep dive into concepts
- [Core Package](../packages/core/README.md) - Full API reference
