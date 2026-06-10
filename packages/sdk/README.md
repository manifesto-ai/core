# @manifesto-ai/sdk

> Base runtime entry point for Manifesto applications.

`@manifesto-ai/sdk` is the package most apps should start with. It turns a MEL
domain into an activated runtime with typed actions, `snapshot()` reads, and
subscriptions.

For the step-by-step app path, start with the main
[Quick Start](../../docs/guide/quick-start.md) and
[Tutorial](../../docs/tutorial/index.md). Use the package-level spec only when
you need the exact runtime contract.

## When to Use It

Use the SDK when you want:

- the shortest path to a running base runtime
- typed action submission through `action.*`
- optional typed effect authoring through `@manifesto-ai/sdk/effects`
- action check/preview/submit, observers, availability queries, optional diagnostics, and `snapshot()` reads in one package
- generated domain facades from `@manifesto-ai/codegen`
- advanced inspection and simulation helpers when you are building tools around an app

## Smallest Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const manifesto = createManifesto<TodoDomain>(TodoMel, {});
const app = manifesto.activate();

await app.action.addTodo.submit("Review docs");
console.log(app.snapshot().state.todos);
```

The base runtime covers the ordinary app loop: submit typed actions, read
snapshots, and observe state or lifecycle events. Availability, preview, and
inspection helpers are available when UI, agent, or debugging tooling needs
them.

Effect authoring helpers live on the dedicated `@manifesto-ai/sdk/effects` subpath. The root package stays centered on `createManifesto()`.

If you need review, approval, policy, audit history, or restore later,
compose optional `@manifesto-ai/lineage` and `@manifesto-ai/governance`
extensions before `activate()`.
If you are building low-level runtime tooling after activation, use
`@manifesto-ai/sdk/extensions`.

## Docs

- [Quick Start](../../docs/guide/quick-start.md)
- [React Integration](../../docs/integration/react.md)
- [Web App + Agent](../../docs/integration/web-app-and-agent.md)
- [Public API Reference](../../docs/api/sdk.md)
- [SDK Guide](docs/GUIDE.md)
- [SDK Specification](docs/sdk-SPEC.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
