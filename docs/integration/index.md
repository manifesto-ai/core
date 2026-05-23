# Integration

> Connect Manifesto from a working app to UI, shared server runtime, and agent automation.

---

## Start With The Base Runtime

Most integrations start with the SDK runtime:

```text
createManifesto(schema, effects) -> activate() -> action.x.submit()
                                                       -> snapshot()/observe.*
```

That shape stays the same whether the caller is a React component, a server route, a CLI command, or an AI worker.

Add approval and history later only when the product needs explicit review,
durable history, or audit queries around those same transitions.

---

## First Web App + Agent Sequence

If your goal is a web app plus agent, follow this order:

This sequence assumes you already have the Todo domain from
[Building a Todo App](/tutorial/04-todo-app). If not, build that first, then
come back here.

| Step | Go Here | Use It For |
|------|---------|------------|
| 1 | [Bundler Setup](/guides/bundler-setup) | Import `.mel` files in Vite or another bundler |
| 2 | [Code Generation](/guides/code-generation) | Emit the generated Todo facade for TypeScript |
| 3 | [React](./react) | Render a browser-owned Todo UI and submit typed actions |
| 4 | [Web App + Agent](./web-app-and-agent) | Move the runtime to the server so UI and agent tools share state |

## Other Paths Later

| Need | Go Here |
|------|---------|
| Deeper agent-only or server-worker tool loops | [AI Agents](./ai-agents) |
| Fulfill declared effects and return patches | [Effect Handlers](/guides/effect-handlers) |
| Editor, CLI, or agent-facing tooling around the same schema | [Developer Tooling](/guides/developer-tooling) |
| Explicit proposals, approvals, and branch history | [When You Need Approval or History](/guides/approval-and-history) |

If you only need current-state reads and direct action submission, stay on the SDK path.

---

## Tooling Around The Runtime

The same domain can also feed editor, inspection, and agent-assistance tools:

- [`@manifesto-ai/mel-lsp`](/api/mel-lsp) for editor feedback while writing `.mel`
- [`@manifesto-ai/skills`](/api/skills) for loading current Manifesto guidance into Codex and other AI tools
- [`@manifesto-ai/studio-cli`](/api/studio-cli) and [`@manifesto-ai/studio-mcp`](/api/studio-mcp) for deeper read-only inspection after the app path is clear

Those tools do not replace the runtime. They sit around it so humans and agents
can author, inspect, and debug the same domain model.

---

## When Approval Or History Enters The Picture

If your integration later needs explicit approval, branch history, or audit
queries, add the advanced runtime on top of the same app model. That
decision point is introduced in [When You Need Approval or History](/guides/approval-and-history),
then spelled out in the advanced tutorials and package guides.

---

## See Also

- [Tutorial](/tutorial/) for the learning paths
- [React](./react) for UI wiring
- [Web App + Agent](./web-app-and-agent) for sharing one server-side runtime
- [AI Agents](./ai-agents) for deeper automation wiring
- [Bundler Setup](/guides/bundler-setup) for `.mel` imports
- [Code Generation](/guides/code-generation) for generated domain facades
- [Effect Handlers](/guides/effect-handlers) for effect fulfillment
- [Developer Tooling](/guides/developer-tooling) for CLI, editor, Studio, and skill setup
- [When You Need Approval or History](/guides/approval-and-history) for deciding when to add review or history
- [Architecture](/architecture/) for the broader system model
