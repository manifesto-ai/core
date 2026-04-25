# Concepts

> Second-pass vocabulary and mental-model reference.

If you are still trying to get the first app running, go back to [Quick Start](/guide/quick-start) and [Tutorial](/tutorial/). This section is for when the app path mostly makes sense and you want the vocabulary to click.

## Core Concepts

| Concept | Definition | Key Principle |
|---------|------------|---------------|
| [Shared Semantic Model](./shared-semantic-model.md) | One domain, many surfaces | Define once, project everywhere |
| [Snapshot](./snapshot.md) | Default runtime read model over canonical state | Read projected by default, canonical intentionally |
| [Intent](./intent.md) | Request to perform a domain action | Intents are proposals, not commands |
| [Flow](./flow.md) | Declarative computation as data | Flows describe, they do not execute |
| [Effect](./effect.md) | Declaration of external operation | Core declares, Host fulfills |
| [World Records](./world.md) | Lineage records and governed composition | Lineage records preserve continuity; Governance authorizes legitimacy |

## Two Runtime Shapes

| Path | Use It When |
|------|-------------|
| Base runtime | You want direct dispatch through `createManifesto() -> activate()` |
| Governed composition | You need approval, continuity, or sealed history on top of the same domain model |

## The Fundamental Equation

```
compute(schema, snapshot, intent, context) -> (snapshot', requirements, trace)
```

- **Pure**: Same inputs always produce same outputs
- **Total**: Always returns a result
- **Traceable**: Every step is recorded
- **Complete at the canonical boundary**: the canonical snapshot substrate is the whole truth; SDK `getSnapshot()` is the projected default read model

## See Also

- [Quick Start](/guide/quick-start) for the runnable path
- [Tutorial](/tutorial/) for the learning path
- [Architecture](/architecture/) for the system-level picture
- [Internals](/internals/) for specs and historical decisions
