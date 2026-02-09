# Integration

> Connect Manifesto with UI frameworks, AI agents, and evolving schemas.

---

## Available Integrations

| Integration | Description | Prerequisites |
|-------------|-------------|---------------|
| [React](./react) | Hooks, Provider, selective re-rendering | Tutorial completed |
| [AI Agents](./ai-agents) | Translator pipeline, natural language to intents | Tutorial completed, basic LLM knowledge |
| [Schema Evolution](./schema-evolution) | AI-driven schema changes, migration strategies | Core concepts understood |

---

## How Integration Works

Manifesto's architecture separates **computation** (Core) from **execution** (Host) and **governance** (World). Integrations connect through the **App** layer:

```
UI Framework  <-->  App  <-->  Host  <-->  Core
AI Agent      <-->  App  <-->  Host  <-->  Core
```

App handles:
- **Actions** -- UI events become domain intents via `app.act()`
- **Subscriptions** -- State changes flow to subscribers via `app.subscribe()`
- **Actor identity** -- Each integration source is a tracked actor

---

## Coming Soon

- **Vue** -- Composition API integration
- **Svelte** -- Store-based integration
- **Angular** -- Service-based integration
- **CLI** -- Command-line tools for automation

---

## See Also

- **[Tutorial](/tutorial/)** -- Learn Manifesto basics first
- **[How-to Guides](/guides/)** -- Solve specific problems
- **[API Reference](/api/)** -- Package documentation
