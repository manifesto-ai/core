# Concepts

> Second-pass reference for Manifesto's core building blocks and runtime choices.

If you are new and still choosing where to begin, go back to [Start Here](/start-here). This section is for when the quickstart or tutorial already mostly makes sense and you want the vocabulary to snap into place.

Manifesto is a semantic layer for deterministic domain state. You declare what your domain means once; every surface reads from the same Snapshot model. The main choice is not the semantics. It is the runtime shape you assemble around them.

---

## Runtime Map

```
caller
  -> choose runtime
     -> SDK base runtime
        -> activate()
        -> createIntent(MEL.actions.*)
        -> dispatchAsync()
        -> Host
        -> Core
        -> Snapshot
     -> Governed composition
        -> withLineage()
        -> withGovernance()
        -> activate()
        -> proposeAsync()
        -> Governance + Lineage
        -> Host
        -> Core
        -> Snapshot + sealed world history
```

## Two Public Paths

### Direct Dispatch

Use `@manifesto-ai/sdk` when you want the shortest path from typed intent to terminal snapshot.

```text
caller -> SDK -> Host -> Core -> Snapshot
```

### Governed Composition

Use Lineage and Governance decorators when you need explicit legitimacy and continuity.

```text
actor -> Governance -> Host -> Core -> Snapshot
                           \
                            -> Lineage + sealed world history
```

---

## When to Use Manifesto

### Perfect Fit

Manifesto excels when you need:

- **Determinism**: Identical inputs must produce identical outputs (testing, replay, debugging)
- **Traceability**: Every state change must be explainable — who requested it, why, and what changed
- **Semantic clarity**: Domain meaning defined once, consumed by every surface
- **Compute/execute separation**: Pure domain logic separated from IO and effects
- **Multi-surface consistency**: UI, API, agents, and automation reading the same Snapshot

### Not Redux/Zustand

| You Need | Use This |
|----------|----------|
| Simple UI state sync | Redux, Zustand |
| Global state with DevTools | Redux |
| Deterministic domain semantics across surfaces | **Manifesto** |

### Not LangChain/AutoGen

| You Need | Use This |
|----------|----------|
| LLM orchestration | LangChain |
| Multi-agent conversations | AutoGen |
| Deterministic state layer that agents operate on | **Manifesto** |

### Good Fit

Consider Manifesto for:

- **Complex domain logic**: Business rules spanning many entities
- **State machines**: Workflows with strict transition rules
- **Collaborative apps**: Multiple users/AI modifying shared state

### Not Ideal For

Simpler alternatives exist for:

- **Simple UI state**: Form inputs, toggles, modals - use React state
- **Rapid prototyping**: When you need to move fast - use simpler state management
- **Read-heavy apps**: If state rarely changes - consider static generation
- **Performance-critical paths**: Real-time gaming, animation - native solutions

---

## Core Concepts

| Concept | Definition | Key Principle |
|---------|------------|---------------|
| [Shared Semantic Model](./shared-semantic-model.md) | One domain, many surfaces | Define once, project everywhere |
| [Snapshot](./snapshot.md) | Default runtime read model over canonical state | Read projected by default, canonical intentionally |
| [Intent](./intent.md) | Request to perform a domain action | Intents are proposals, not commands |
| [Flow](./flow.md) | Declarative computation as data | Flows describe, they don't execute |
| [Effect](./effect.md) | Declaration of external operation | Core declares, Host fulfills |
| [World](./world.md) | Governed composition over governance + lineage | Governed composition makes legitimacy, continuity, and sealing explicit |

---

## The Fundamental Equation

```
compute(schema, snapshot, intent, context) -> (snapshot', requirements, trace)
```

- **Pure**: Same inputs always produce same outputs
- **Total**: Always returns a result (never throws)
- **Traceable**: Every step is recorded
- **Complete at the canonical boundary**: the canonical snapshot substrate is the whole truth; SDK `getSnapshot()` is the projected default read model

---

## Quick Reference

| What You Want | Which Concept | Where to Start |
|---------------|---------------|----------------|
| Run a domain quickly | Base runtime | `@manifesto-ai/sdk` |
| Add governance and lineage | World | `@manifesto-ai/lineage` + `@manifesto-ai/governance` |
| Store domain state | Snapshot | `snapshot.data` |
| Request state change | Intent | `instance.createIntent(...)` or `createIntentInstance()` |
| Describe computation | Flow | MEL `action`, `when`, `once` |
| Perform IO | Effect | MEL `effect type.name({ into: path })` |

---

## See Also

- [Architecture Overview](/architecture/) - How concepts fit into layers
- [Start Here](/start-here) - Choose the shortest reading path
- [Getting Started Guide](/quickstart) - Build something
- [Specifications](/internals/spec/) - Normative definitions
