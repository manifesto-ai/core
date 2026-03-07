# Integration

> Connect a `ManifestoInstance` to the rest of your system.

---

## What Integration Means Today

The current SDK gives you one runtime handle:

- `dispatch()` to submit intents
- `subscribe()` to react to snapshot changes
- `on()` to observe per-intent lifecycle events
- `getSnapshot()` to read the latest terminal snapshot

Every integration pattern in this section builds on those same methods.

---

## Available Integration Paths

| Path | Use It When |
|------|-------------|
| [React](./react) | You want UI components to render snapshot slices |
| [AI Agents](./ai-agents) | You want an agent to propose or execute intents |

---

## The Default Shape

```text
External system -> createIntent() -> manifesto.dispatch()
                                     -> subscribe()/on()/getSnapshot()
```

That shape stays the same whether the caller is:

- a React component
- a server route
- a CLI command
- an AI worker

---

## Optional Governance

If your integration needs explicit actor approval, audit lineage, or proposal review, add `@manifesto-ai/world` on top of the same Snapshot and Intent model. The default `createManifesto()` path does not wire World implicitly.

---

## See Also

- [Tutorial](/tutorial/) for the onboarding path
- [Guides](/guides/) for effect handlers, debugging, and re-entry safety
- [Architecture](/architecture/) for the broader system model
