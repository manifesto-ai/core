# Concepts

> Quick reference for Manifesto's core building blocks.

Manifesto models applications as semantic spaces where state transitions are computed, not executed. Understanding these six concepts provides the foundation for building with Manifesto.

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

- **AI as First-Class Actor**: AI agents participate as equals with humans in a governed system
- **Determinism**: Identical inputs must produce identical outputs (testing, replay)
- **Verifiable AI Behavior**: LLM decisions need audit trails and authority controls
- **Compliance**: Every state change must be traceable and explainable
- **Multi-actor systems**: Different users/AI agents with different permissions

### Not Redux/Zustand

| You Need | Use This |
|----------|----------|
| Simple UI state sync | Redux, Zustand |
| Global state with DevTools | Redux |
| AI-human collaboration with governance | **Manifesto** |

### Not LangChain/AutoGen

| You Need | Use This |
|----------|----------|
| LLM orchestration | LangChain |
| Multi-agent conversations | AutoGen |
| Deterministic state with AI actors | **Manifesto** |

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
| [AI Native OS Layer](./ai-native-os-layer.md) | Manifesto's core identity | Not state management, not AI framework |
| [Snapshot](./snapshot.md) | Complete state at a point in time | If it's not in Snapshot, it doesn't exist |
| [Intent](./intent.md) | Request to perform a domain action | Intents are proposals, not commands |
| [Flow](./flow.md) | Declarative computation as data | Flows describe, they don't execute |
| [Effect](./effect.md) | Declaration of external operation | Core declares, Host fulfills |
| [World](./world.md) | Governance layer for authority | World governs, Host executes |

---

## The Fundamental Equation

```
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
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
| Request state change | Intent | `createIntent(type, input)` |
| Describe computation | Flow | `flow.seq()`, `flow.when()` |
| Perform IO | Effect | `flow.effect(type, params)` |
| Authorize actions | World | `world.registerAuthority()` |

---

## See Also

- [Architecture Overview](/architecture/) - How concepts fit into layers
- [Getting Started Guide](/quickstart) - Build something
- [Specifications](/internals/spec/) - Normative definitions
