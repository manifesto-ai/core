# Concepts

> Second-pass vocabulary and mental-model reference.

If you are still trying to get the first app running, go back to [Quick Start](/guide/quick-start) and [Tutorial](/tutorial/). This section is for when the app path mostly makes sense and you want the vocabulary to click.

## Core Concepts

| Concept | Definition | Key Principle |
|---------|------------|---------------|
| [Shared Domain Model](./shared-semantic-model.md) | One domain, many surfaces | Define once, call from UI, routes, and agents |
| [Snapshot](./snapshot.md) | Default runtime read model | Read `snapshot()` first; use full internal snapshots only for advanced tooling |
| [Intent](./intent.md) | Low-level request behind an action submission | App code submits actions, tooling may inspect intents |
| [Flow](./flow.md) | Declarative computation as data | Flows describe, they do not execute |
| [Effect](./effect.md) | Declaration of external operation | Core declares, Host fulfills |
| [World Records](./world.md) | In-depth record model for approval/history runtimes | Read it after the approval/history decision guide |

## Two Runtime Shapes

| Path | Use It When |
|------|-------------|
| Base runtime | You want direct action submission through `createManifesto() -> activate()` |
| Approval/history runtime | You need review, branch history, or sealed records on top of the same domain model |

## The Fundamental Equation

```
compute(schema, snapshot, intent, context) -> ComputeResult
```

- **Pure**: Same inputs always produce same outputs
- **Total**: Always returns a result
- **Traceable**: Every step is recorded
- **Complete at the internal boundary**: the runtime has the full state it needs;
  SDK `snapshot()` is the default app read model

## See Also

- [Quick Start](/guide/quick-start) for the runnable path
- [Tutorial](/tutorial/) for the learning path
- [When You Need Approval or History](/guides/approval-and-history) before reading World records
- [Architecture](/architecture/) for the system-level picture
- [Internals](/internals/) for specs and historical decisions
