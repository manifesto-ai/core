# React Specification v1.0

> **Status:** Draft
> **Scope:** Normative
> **Version:** 1.0.0
> **Applies to:** @manifesto-ai/react package

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Definitions](#3-definitions)
4. [Types](#4-types)
5. [Behavior](#5-behavior)
6. [Invariants](#6-invariants)
7. [Error Handling](#7-error-handling)
8. [Explicit Non-Goals](#8-explicit-non-goals)
9. [Compliance](#9-compliance)

---

## 1. Purpose

This document defines the React binding specification for Manifesto.

This specification governs:
- The factory API (`createManifestoApp`)
- Context and Provider behavior
- Hook contracts (`useValue`, `useDispatch`, `useActions`)
- Type inference rules

This document is **normative**.

---

## 2. Scope

### 2.1 What IS Governed

| Aspect | Description |
|--------|-------------|
| Factory API | `createManifestoApp` function and returned object |
| Provider behavior | How `Provider` manages Bridge lifecycle |
| Hook contracts | What each hook returns and when it re-renders |
| Type inference | How types flow from DomainModule to hooks |

### 2.2 What is NOT Governed

| Aspect | Governed By |
|--------|-------------|
| Bridge implementation | Bridge SPEC |
| Domain definition | Builder SPEC |
| State computation | Core SPEC |
| Governance | World SPEC |

### 2.3 Relationship to Other Specs

```
┌─────────────────┐
│  Builder SPEC   │
└────────┬────────┘
         │ DomainModule
         ▼
┌─────────────────┐
│   THIS SPEC     │ (React bindings)
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐
│  Bridge SPEC    │
└─────────────────┘
```

---

## 3. Definitions

### 3.1 ManifestoApp

The object returned by `createManifestoApp()`. Contains Provider component and hooks.

### 3.2 Provider

A React component that creates and manages the Bridge instance, providing it via context.

### 3.3 Selector

A function that extracts a value from the snapshot: `(snapshot) => value`.

### 3.4 RFC 2119 Keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 4. Types

### 4.1 Core Types

```typescript
/**
 * Options for createManifestoApp
 */
type ManifestoAppOptions<TState> = {
  /** Initial state (required) */
  readonly initialState: TState;

  /** Default actor for proposals */
  readonly defaultActor?: ActorRef;

  /** Custom Bridge configuration */
  readonly bridgeConfig?: Partial<BridgeConfig>;
};

/**
 * The ManifestoApp object returned by createManifestoApp
 */
type ManifestoApp<TState, TComputed, TActions> = {
  /** Provider component */
  readonly Provider: React.FC<{ children: React.ReactNode }>;

  /** Select value from snapshot */
  readonly useValue: <T>(selector: (state: TState & TComputed) => T) => T;

  /** Get dispatch function */
  readonly useDispatch: () => DispatchFn;

  /** Get type-safe action dispatchers */
  readonly useActions: () => ActionDispatchers<TActions>;
};
```

### 4.2 Hook Types

```typescript
/**
 * Dispatch function type
 */
type DispatchFn = (body: IntentBody) => Promise<ProposalResult>;

/**
 * Action dispatchers mapped from domain actions
 */
type ActionDispatchers<TActions> = {
  [K in keyof TActions]: TActions[K] extends ActionRef<infer TInput>
    ? (input: TInput) => Promise<ProposalResult>
    : never;
};

/**
 * Type inference utilities
 */
type InferState<T> = T extends DomainModule<infer S, any, any> ? S : never;
type InferComputed<T> = T extends DomainModule<any, infer C, any> ? C : never;
type InferActions<T> = T extends DomainModule<any, any, infer A> ? A : never;
```

### 4.3 Context Types

```typescript
/**
 * Value provided by BridgeContext
 */
type BridgeContextValue = {
  readonly bridge: Bridge;
} | null;

/**
 * Props for BridgeProvider
 */
type BridgeProviderProps = {
  readonly bridge: Bridge;
  readonly children: React.ReactNode;
};
```

---

## 5. Behavior

### 5.1 createManifestoApp

#### 5.1.1 Factory Behavior

`createManifestoApp` **MUST** return a ManifestoApp object with Provider and hooks.

```typescript
function createManifestoApp<TState, TComputed, TActions>(
  domain: DomainModule<TState, TComputed, TActions>,
  options: ManifestoAppOptions<TState>
): ManifestoApp<TState, TComputed, TActions>;
```

#### 5.1.2 Type Preservation

`createManifestoApp` **MUST** preserve type information from DomainModule through to hooks.

```typescript
// Given:
const domain = defineDomain(z.object({ count: z.number() }), ...);
const App = createManifestoApp(domain, { initialState: { count: 0 } });

// Then:
App.useValue(s => s.count);  // MUST infer number
App.useValue(s => s.foo);    // MUST be type error
```

### 5.2 Provider Behavior

#### 5.2.1 Bridge Lifecycle

Provider **MUST** create Bridge on mount and dispose on unmount.

```typescript
// REQUIRED behavior
function Provider({ children }) {
  const bridge = useMemo(() => createBridge(...), []);

  useEffect(() => {
    return () => bridge.dispose();
  }, [bridge]);

  return <BridgeContext.Provider value={{ bridge }}>{children}</BridgeContext.Provider>;
}
```

#### 5.2.2 Single Instance

Provider **MUST NOT** create multiple Bridge instances during its lifetime.

#### 5.2.3 Nested Providers

Nested Providers **MAY** create separate Bridge instances. Inner Provider takes precedence.

### 5.3 Hook Behavior

#### 5.3.1 useValue

`useValue` **MUST** return the selected value from current snapshot.

`useValue` **MUST** re-render component when selected value changes.

`useValue` **MUST NOT** re-render when unrelated parts of snapshot change.

```typescript
// Reference implementation
function useValue<T>(selector: (snapshot) => T): T {
  const { bridge } = useBridge();
  const [value, setValue] = useState(() => selector(bridge.getSnapshot()));

  useEffect(() => {
    return bridge.subscribe((snapshot) => {
      const newValue = selector(snapshot);
      if (!Object.is(value, newValue)) {
        setValue(newValue);
      }
    });
  }, [bridge, selector]);

  return value;
}
```

#### 5.3.2 useDispatch

`useDispatch` **MUST** return a stable dispatch function.

The dispatch function **MUST** return a Promise that resolves to ProposalResult.

```typescript
function useDispatch(): DispatchFn {
  const { bridge } = useBridge();
  return useCallback(
    (body: IntentBody) => bridge.dispatch(body),
    [bridge]
  );
}
```

#### 5.3.3 useActions

`useActions` **MUST** return an object with type-safe action dispatchers.

Each action dispatcher **MUST** accept the action's input type.

Each action dispatcher **MUST** return `Promise<ProposalResult>`.

```typescript
// Given action: add: ActionRef<{ title: string }>
const { add } = App.useActions();
add({ title: "Test" });  // MUST be valid
add({ name: "Test" });   // MUST be type error
```

### 5.4 Low-Level API

#### 5.4.1 BridgeProvider

`BridgeProvider` **MUST** provide the given Bridge via context.

`BridgeProvider` **MUST NOT** manage Bridge lifecycle (caller's responsibility).

#### 5.4.2 useBridge

`useBridge` **MUST** return the Bridge from context.

`useBridge` **MUST** throw if used outside BridgeProvider.

#### 5.4.3 useSnapshot

`useSnapshot` **MUST** return the full SnapshotView.

`useSnapshot` **MUST** re-render on any snapshot change.

---

## 6. Invariants

The following invariants **MUST ALWAYS HOLD**:

### 6.1 Context Invariants

| ID | Invariant |
|----|-----------|
| INV-R001 | Hooks used outside Provider MUST throw |
| INV-R002 | Provider MUST provide non-null context value |
| INV-R003 | Bridge MUST be disposed when Provider unmounts |

### 6.2 Re-render Invariants

| ID | Invariant |
|----|-----------|
| INV-R010 | useValue MUST only re-render when selected value changes |
| INV-R011 | useDispatch return value MUST be referentially stable |
| INV-R012 | useActions return value MUST be referentially stable |

### 6.3 Type Invariants

| ID | Invariant |
|----|-----------|
| INV-R020 | Action dispatchers MUST match domain action input types |
| INV-R021 | useValue selector MUST receive correct state type |

---

## 7. Error Handling

### 7.1 Error Types

```typescript
type ReactError =
  | { kind: 'no_provider'; message: string }
  | { kind: 'invalid_domain'; message: string }
  | { kind: 'dispatch_failed'; message: string; cause?: Error };
```

### 7.2 Error Conditions

| Error | Condition | Required Response |
|-------|-----------|-------------------|
| `no_provider` | Hook used outside Provider | MUST throw Error |
| `invalid_domain` | Invalid DomainModule passed | MUST throw Error |
| `dispatch_failed` | Dispatch promise rejected | MUST reject with error |

### 7.3 Recovery

Dispatch errors **MUST** be catchable via Promise.catch or try/catch with async/await.

```typescript
// User code
try {
  await add({ title: "" });
} catch (e) {
  // Handle error
}
```

---

## 8. Explicit Non-Goals

This specification does **NOT** define:

| Non-Goal | Reason | Defined By |
|----------|--------|------------|
| Server-side rendering | Framework-specific | Application concern |
| Suspense integration | Not yet stable | Future version |
| Concurrent mode | React-internal | React documentation |
| Vue/Svelte bindings | Different packages | Separate specs |

---

## 9. Compliance

### 9.1 Compliance Requirements

An implementation claiming compliance with **React SPEC v1.0** MUST:

1. Implement `createManifestoApp` factory with correct type inference
2. Implement Provider with correct Bridge lifecycle
3. Implement all hooks with correct behavior
4. Enforce all invariants (INV-R*)
5. Follow all MUST requirements

### 9.2 Compliance Verification

Compliance can be verified by:

1. **Type checking:** TypeScript compilation succeeds
2. **Invariant testing:** All INV-R* hold under test scenarios
3. **Behavior testing:** All MUST requirements are enforced
4. **Re-render testing:** Components only re-render when expected

---

## Appendix A: Quick Reference

### A.1 Core Types Summary

```typescript
type ManifestoApp<S, C, A> = {
  Provider: React.FC;
  useValue: <T>(selector: (state: S & C) => T) => T;
  useDispatch: () => DispatchFn;
  useActions: () => ActionDispatchers<A>;
}
```

### A.2 Key Invariants Summary

| Category | Key Rule |
|----------|----------|
| Context | Hooks throw outside Provider |
| Re-render | Only on relevant changes |
| Types | Full inference from domain |

---

## Appendix B: Cross-Reference

### B.1 Related Specifications

| Spec | Relationship |
|------|--------------|
| Bridge SPEC | React wraps Bridge |
| Builder SPEC | Consumes DomainModule |

### B.2 FDR Reference

| FDR | Explains |
|-----|----------|
| FDR-R001 | Why factory pattern |
| FDR-R002 | Why selector-based subscription |

---

*End of React Specification v1.0*
