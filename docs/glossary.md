# Glossary

Common terms and concepts used in Manifesto.

## Core Concepts

### Semantic Path

A unique, addressable identifier for any piece of data or state in the system.

```typescript
'data.user.name'      // Source path
'state.isLoading'     // State path
'derived.fullName'    // Derived path
'async.fetchUser'     // Async path
```

**Prefixes:**
- `data.*` - Persistent data
- `state.*` - Transient UI state
- `derived.*` - Computed values
- `async.*` - Async operations

### Domain

The central configuration that defines your application's data model, computed values, and actions.

```typescript
const domain = defineDomain({
  id: 'my-domain',
  name: 'My Domain',
  dataSchema: z.object({ ... }),
  stateSchema: z.object({ ... }),
  paths: { ... },
  actions: { ... },
});
```

### Source Path

A path representing raw, writable data. The fundamental building blocks of state.

### Derived Path

A computed value that automatically updates when its dependencies change.

```typescript
'derived.total': {
  deps: ['data.price', 'data.quantity'],
  expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
}
```

### Async Path

A path that handles asynchronous operations with automatic loading/error states.

Sub-paths:
- `async.x.result` - The resolved value
- `async.x.loading` - Boolean loading state
- `async.x.error` - Error if failed

---

## Expression DSL

### Expression

A serializable representation of computation using S-expression syntax.

```typescript
['*', ['get', 'data.price'], 2]  // price * 2
```

### Operators

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Comparison**: `==`, `!=`, `>`, `<`, `>=`, `<=`
- **Logical**: `and`, `or`, `not`
- **Control**: `if`, `switch`

### get

Retrieves a value from a semantic path.

```typescript
['get', 'data.count']
```

---

## Effect System

### Effect

A description of a side effect to be executed. Effects are data, not code.

Types:
- `setValue` - Update a path value
- `setState` - Update state path
- `apiCall` - Make HTTP request
- `navigate` - Change route
- `delay` - Wait for time
- `sequence` - Run effects in order
- `parallel` - Run effects concurrently

### Effect Handler

Implementation that executes effects. Provided by the runtime.

### Result Type

A discriminated union representing success or failure.

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

---

## Runtime

### Runtime

The execution engine that manages state, evaluates expressions, and propagates changes.

```typescript
const runtime = createRuntime({
  domain: myDomain,
  initialData: { ... },
});
```

### Snapshot

An immutable view of the current state at a point in time.

```typescript
const snapshot = runtime.getSnapshot();
// { data: {...}, state: {...}, derived: {...} }
```

### Subscription

A callback registered to receive updates when paths change.

```typescript
const unsubscribe = runtime.subscribePath('data.count', (value) => {
  console.log('Count changed:', value);
});
```

---

## DAG (Directed Acyclic Graph)

### Dependency Graph

The structure tracking which paths depend on which other paths.

### Propagation

The process of updating derived values when source values change.

### Topological Sort

Ordering of nodes ensuring dependencies are computed before dependents.

---

## Policy

### Field Policy

Rules governing field behavior based on conditions.

- `relevantWhen` - When field is shown
- `editableWhen` - When field is editable
- `requiredWhen` - When field is required

### Precondition

A condition that must be true for an action to execute.

```typescript
preconditions: [
  { path: 'derived.isValid', expect: 'true', reason: 'Form must be valid' }
]
```

### Condition Reference

A reference to a path with an expected value.

```typescript
{ path: 'state.isAdmin', expect: 'true', reason: 'Admin required' }
```

---

## Compiler

### Fragment

A piece of domain information extracted from source code.

Types:
- `SchemaFragment` - Type definitions
- `DerivedFragment` - Computed values
- `ActionFragment` - Action definitions
- `PolicyFragment` - Validation rules

### Pass

A compilation phase that extracts specific information.

- `SchemaPass` - Extracts types
- `DerivedPass` - Finds computed values
- `ActionPass` - Identifies actions
- `AsyncPass` - Detects async ops
- `PolicyPass` - Extracts validation
- `MetadataPass` - Gets semantic info
- `FragmentPass` - Assembles fragments

### Linker

Combines fragments from multiple sources into a unified domain.

### Verifier

Validates the linked domain for correctness.

---

## React Integration

### RuntimeProvider

React context provider that makes runtime available to hooks.

```tsx
<RuntimeProvider runtime={runtime} domain={domain}>
  <App />
</RuntimeProvider>
```

### useValue

Hook to subscribe to a path value.

```tsx
const { value } = useValue<number>('data.count');
```

### useSetValue

Hook to get a function for updating values.

```tsx
const { setValue } = useSetValue();
setValue('data.count', 42);
```

### useDerived

Hook to access derived (computed) values.

```tsx
const { value } = useDerived<number>('derived.total');
```

---

## AI Integration

### Projection

A filtered view of state optimized for AI consumption.

### Agent Context

Structured information provided to AI agents including:
- Available actions
- Current state
- Field policies
- Validation status

### Decision Loop

The cycle of AI observing state, deciding action, and receiving feedback.

---

## Error Types

### EffectError

Error during effect execution.

### HandlerError

Error from an effect handler method.

### PropagationError

Error during DAG propagation.

### ValidationError

Schema validation failure.
