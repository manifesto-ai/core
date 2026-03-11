# Concepts

> Quick reference for Manifesto's core building blocks.

Manifesto is a semantic layer for deterministic domain state. You declare what your domain means once; every surface — UI, API, agent, automation — reads from the same Snapshot. Understanding these concepts provides the foundation for building with Manifesto.

---

## Concept Map

```
                    Intent
                      |
                      v
                    World  -----------> Authority
                      |                    |
                      v                    v
                    Host  <---------- Decision
                      |
                      v
     +----------------+----------------+
     |                                 |
     v                                 v
   Core                             Effect
     |                             Handler
     v                                 |
   Flow  ---> Effect Declaration ------+
     |                                 |
     v                                 v
  Patches  ----------------------> Snapshot
```

**Data flows:**
1. **Intent** enters through **World** for governance
2. **World** evaluates **Authority** and produces **Decision**
3. Approved intents go to **Host** for execution
4. **Host** calls **Core** which interprets **Flow**
5. **Flow** produces patches and declares **Effects**
6. **Host** executes effects, applies patches to **Snapshot**

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
| [Snapshot](./snapshot.md) | Complete state at a point in time | If it's not in Snapshot, it doesn't exist |
| [Intent](./intent.md) | Request to perform a domain action | Intents are proposals, not commands |
| [Flow](./flow.md) | Declarative computation as data | Flows describe, they don't execute |
| [Effect](./effect.md) | Declaration of external operation | Core declares, Host fulfills |
| [World](./world.md) | Governance layer for authority | World governs, Host executes |

---

## The Fundamental Equation

```
compute(schema, snapshot, intent, context) -> (snapshot', requirements, trace)
```

- **Pure**: Same inputs always produce same outputs
- **Total**: Always returns a result (never throws)
- **Traceable**: Every step is recorded
- **Complete**: Snapshot is the whole truth

---

## Quick Reference

| What You Want | Which Concept | Where Defined |
|---------------|---------------|---------------|
| Store domain state | Snapshot | `snapshot.data` |
| Request state change | Intent | `manifesto.dispatch(createIntent("action", input, intentId))` |
| Describe computation | Flow | MEL `action`, `when`, `once` |
| Perform IO | Effect | MEL `effect type.name({ into: path })` |
| Authorize actions | World | `world.registerActor(actor, policy)` |

---

## See Also

- [Architecture Overview](/architecture/) - How concepts fit into layers
- [Getting Started Guide](/quickstart) - Build something
- [Specifications](/internals/spec/) - Normative definitions
