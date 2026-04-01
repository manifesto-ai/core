# Integration

> Connect Manifesto to React apps, agent loops, or governed workflows.

---

## Two Integration Modes

Manifesto has two runtime shapes:

- base runtime on `@manifesto-ai/sdk`
- governed composition through `@manifesto-ai/lineage` + `@manifesto-ai/governance`

Both operate on the same semantic core. The difference is how much legitimacy, lineage, and sealing you want around the transition.

---

## When To Choose Which Path

| Need | Start Here |
|------|------------|
| Fast app wiring, rendering, and telemetry | [React](./react) |
| Agent-driven transitions without approval gates | [AI Agents](./ai-agents) |
| Explicit proposals, approvals, and branch history | [Governed tutorial track](/tutorial/05-governed-composition) |

If you only need Snapshot reads and direct intent dispatch, stay on the SDK path.

---

## The Default Shape

```text
External system -> activate() -> createIntent() -> dispatchAsync()
                                     -> subscribe()/on()/getSnapshot()
```

That shape stays the same whether the caller is a React component, a server route, a CLI command, or an AI worker.

---

## When Governance Enters The Picture

If your integration needs explicit approval, lineage, or audit history, add the governed track on top of the same Snapshot model:

```text
createManifesto -> withLineage -> withGovernance -> activate -> proposal -> authority decision -> seal -> history
```

That flow is spelled out in the governed tutorial track and in the package guides for Governance and Lineage.

---

## See Also

- [Tutorial](/tutorial/) for the learning paths
- [World](../concepts/world) for governed composition
- [React](./react) for UI wiring
- [AI Agents](./ai-agents) for automation wiring
- [Architecture](/architecture/) for the broader system model
