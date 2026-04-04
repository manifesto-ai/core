# Integration

> Connect Manifesto to React apps, agent loops, and later-stage approval/history workflows.

---

## Default Runtime, Then Optional Escalation

Manifesto has two runtime shapes:

- base runtime on `@manifesto-ai/sdk`
- an advanced runtime through `@manifesto-ai/lineage` + `@manifesto-ai/governance`

Both operate on the same semantic core. The difference is how much legitimacy, lineage, and sealing you want around the transition.

---

## When To Choose Which Path

| Need | Start Here |
|------|------------|
| Fast app wiring, rendering, and telemetry | [React](./react) |
| Agent-driven transitions without approval gates | [AI Agents](./ai-agents) |
| Editor, CLI, or agent-facing tooling around the same schema | [Developer Tooling](/guides/developer-tooling) |
| Explicit proposals, approvals, and branch history | [When You Need Approval or History](/guides/approval-and-history) |

If you only need Snapshot reads and direct intent dispatch, stay on the SDK path.

---

## The Default Shape

```text
External system -> activate() -> createIntent() -> dispatchAsync()
                                     -> subscribe()/on()/getSnapshot()
```

That shape stays the same whether the caller is a React component, a server route, a CLI command, or an AI worker.

---

## Tooling Around The Runtime

The same schema can also feed the current DX stack:

- [`@manifesto-ai/mel-lsp`](/api/mel-lsp) for editor and schema-introspection workflows
- [`@manifesto-ai/skills`](/api/skills) for loading current Manifesto guidance into Codex and other AI tools
- [`@manifesto-ai/studio-cli`](/api/studio-cli) and [`@manifesto-ai/studio-mcp`](/api/studio-mcp) for read-only graph, findings, snapshot, trace, lineage, and governance inspection

Those tools do not replace the runtime. They sit around it so humans and agents can author, inspect, and debug the same semantic model.

---

## When Governance Enters The Picture

If your integration later needs explicit approval, lineage, or audit history, add the advanced runtime on top of the same Snapshot model:

```text
createManifesto -> withLineage -> withGovernance -> activate -> proposal -> authority decision -> seal -> history
```

That flow is introduced in [When You Need Approval or History](/guides/approval-and-history), then spelled out in the advanced tutorials and the package guides for Governance and Lineage.

---

## See Also

- [Tutorial](/tutorial/) for the learning paths
- [World](../concepts/world) for advanced runtime composition
- [React](./react) for UI wiring
- [AI Agents](./ai-agents) for automation wiring
- [Developer Tooling](/guides/developer-tooling) for CLI, editor, Studio, and skill setup
- [Architecture](/architecture/) for the broader system model
