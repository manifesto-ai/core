# React — Foundational Design Rationale (FDR)

> **Version:** 1.0
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in @manifesto-ai/react

---

## Overview

This document records the foundational design decisions that shape @manifesto-ai/react.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-R001: Factory Pattern (createManifestoApp)

### Decision

The primary API is a factory function `createManifestoApp(domain, options)` that returns a complete app object with Provider and hooks.

```typescript
const App = createManifestoApp(TodoDomain, { initialState: { todos: [] } });

// Returns:
// App.Provider - Context provider
// App.useValue - Select state
// App.useDispatch - Get dispatch
// App.useActions - Get typed actions
```

### Context

Users need a simple way to integrate Manifesto into React applications. The integration requires:
- Bridge creation and lifecycle management
- Context setup
- Type-safe hooks
- Action dispatcher generation

### Rationale

**Zero-config setup with full type safety**

| Concern | Why Factory Pattern |
|---------|---------------------|
| **Type inference** | Factory captures domain types at call site, flowing to all hooks |
| **Encapsulation** | Bridge lifecycle managed internally, no leaky abstractions |
| **Developer experience** | Single import, single call, everything works |
| **Testing** | Easy to create test instances with different initial state |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| **Global hooks** | No type safety, can't have multiple domains |
| **HOC pattern** | Verbose, poor TypeScript inference |
| **Render props** | Clunky, out of fashion |
| **Redux-style connect** | Too much boilerplate, weak typing |

### Consequences

**Enables:**
- One-liner setup for new apps
- Full type inference from Zod schemas
- Easy testing with different configurations
- Multiple domains in same app (separate factories)

**Constrains:**
- Factory must be called at module level
- Can't dynamically change domain after creation

**Requires:**
- Domain must be defined before creating app
- Initial state must match schema

---

## FDR-R002: Selector-Based Subscription (useValue)

### Decision

`useValue` takes a selector function and only re-renders when the selected value changes.

```typescript
// Only re-renders when todos changes
const todos = App.useValue(s => s.todos);

// Only re-renders when filter changes
const filter = App.useValue(s => s.filter);
```

### Context

React re-renders can be expensive. Manifesto snapshots contain all state, and we need fine-grained subscriptions to avoid unnecessary re-renders.

### Rationale

**Performance through precision**

| Concern | Why Selector Pattern |
|---------|---------------------|
| **Performance** | Only re-render when relevant data changes |
| **Composability** | Selectors can derive values |
| **Familiarity** | Same pattern as Reselect, Zustand |
| **Type safety** | Selector return type is inferred |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| **Full snapshot subscription** | Every component re-renders on any change |
| **Path-based subscription** | Strings lose type safety |
| **Proxy-based tracking** | Complex, magic behavior, debugging difficulty |
| **Atom-based (Jotai/Recoil)** | Different mental model, requires atom definition |

### Consequences

**Enables:**
- Optimal re-render behavior
- Derived value computation in selectors
- Easy optimization (memoized selectors)

**Constrains:**
- Selectors should be pure functions
- New objects in selectors cause extra re-renders

**Requires:**
- Users understand selector identity rules
- Stable selector references (useCallback if inline)

---

## FDR-R003: Typed Action Dispatchers (useActions)

### Decision

`useActions` returns an object with type-safe functions for each domain action.

```typescript
const { add, toggle, remove } = App.useActions();

add({ title: "Buy milk" });      // Type-safe input
toggle({ id: "123" });           // Type-safe input
```

### Context

Domain actions have typed inputs (from Zod schemas). Users need a way to dispatch actions with full type checking.

### Rationale

**Developer experience and safety**

| Concern | Why Typed Dispatchers |
|---------|----------------------|
| **Type safety** | Input validation at compile time |
| **Autocomplete** | IDE shows available actions and their inputs |
| **Refactoring** | Rename action, all usages update |
| **Discoverability** | Destructuring shows available actions |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| **String-based dispatch** | No type safety, typos possible |
| **Generic dispatch only** | Loses action-specific typing |
| **Action creators** | Extra boilerplate, separate from hooks |
| **Proxy-based actions** | Magic behavior, poor debugging |

### Consequences

**Enables:**
- Compile-time validation of action inputs
- IDE autocomplete for actions
- Safe refactoring

**Constrains:**
- Actions must be known at domain definition time
- Dynamic actions not directly supported

**Requires:**
- Domain must define actions with input types
- Builder must export ActionRef types

---

## FDR-R004: Bridge Lifecycle in Provider

### Decision

The Provider component creates the Bridge on mount and disposes it on unmount.

```typescript
function Provider({ children }) {
  const bridge = useMemo(() => createBridge(...), []);

  useEffect(() => {
    return () => bridge.dispose();
  }, [bridge]);

  return <BridgeContext.Provider value={{ bridge }}>{children}</BridgeContext.Provider>;
}
```

### Context

Bridge instances hold subscriptions, timers, and other resources. These must be properly cleaned up to avoid memory leaks.

### Rationale

**Predictable resource management**

| Concern | Why Provider Manages Lifecycle |
|---------|-------------------------------|
| **Memory safety** | Resources always cleaned up |
| **Simplicity** | Users don't manage lifecycle |
| **React idiom** | Follows useEffect cleanup pattern |
| **Encapsulation** | Bridge details hidden from user |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| **User manages Bridge** | Easy to forget cleanup, memory leaks |
| **Global singleton** | Can't have multiple instances, testing hard |
| **Ref-based storage** | More complex, same result |

### Consequences

**Enables:**
- Automatic resource cleanup
- Multiple instances (testing, multiple domains)
- React StrictMode compatibility

**Constrains:**
- Bridge lifecycle tied to Provider mount/unmount
- Can't share Bridge across Provider instances

---

## FDR-R005: Low-Level API for Advanced Use Cases

### Decision

Provide low-level `BridgeProvider` and hooks (`useBridge`, `useSnapshot`) alongside the factory API.

```typescript
// Low-level usage
const bridge = createBridge({ ... });

<BridgeProvider bridge={bridge}>
  <App />
</BridgeProvider>

// In component
const bridge = useBridge();
const snapshot = useSnapshot();
```

### Context

Some users need custom Bridge setup (custom World, special configuration). The factory API should not be the only option.

### Rationale

**Flexibility without complexity**

| Concern | Why Low-Level API |
|---------|-------------------|
| **Custom setup** | Users can configure Bridge however needed |
| **Testing** | Easy to inject mock Bridge |
| **Gradual adoption** | Start low-level, migrate to factory |
| **Framework building** | Build higher-level abstractions |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| **Factory only** | Too limiting for advanced users |
| **Config explosion** | Factory options become unwieldy |
| **Escape hatches** | Ad-hoc solutions are messy |

### Consequences

**Enables:**
- Custom Bridge configuration
- Easy testing with mocks
- Building custom abstractions

**Constrains:**
- Users must understand Bridge lifecycle
- Low-level API has less type safety

**Requires:**
- Clear documentation of both APIs
- Examples for common patterns

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| R001 | Factory pattern | Zero-config with full types |
| R002 | Selector-based subscription | Performance through precision |
| R003 | Typed action dispatchers | Developer experience and safety |
| R004 | Provider manages lifecycle | Predictable resource management |
| R005 | Low-level API available | Flexibility without complexity |

---

## Cross-Reference

### Related SPECs

| SPEC Section | Relevant FDR |
|--------------|--------------|
| §5.1 createManifestoApp | FDR-R001 |
| §5.3.1 useValue | FDR-R002 |
| §5.3.3 useActions | FDR-R003 |
| §5.2 Provider | FDR-R004 |
| §5.4 Low-Level API | FDR-R005 |

### Related FDRs in Other Packages

| Other FDR | Relationship |
|-----------|--------------|
| Bridge FDR-B001 | Bridge design informs React bindings |
| Builder FDR | Type inference flows from Builder to React |

---

*End of React FDR*
