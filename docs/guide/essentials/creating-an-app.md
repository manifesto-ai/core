# Creating an App

> Create a runtime from a MEL domain.

A Manifesto app starts from a MEL domain and becomes runnable after `activate()`.

## The App Shape

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";

const app = createManifesto(TodoMel, {}).activate();
```

`app` is the base runtime handle. It can submit actions, publish snapshots,
notify observers, expose read-only inspection data, and clean itself up.

For normal app code, start with three verbs:

- `app.action.<name>.submit(...)` changes state through a domain action.
- `app.snapshot()` reads the current public Snapshot.
- `app.dispose()` shuts the runtime down when the app unmounts or exits.

## Add The Generated Domain Type

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import type { TodoDomain } from "./domain/todo.domain";
import TodoMel from "./domain/todo.mel";

const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
```

That generic type comes from the generated facade in [Code Generation](/guides/code-generation).
You can omit it while learning the runtime shape.

## Domain And Effects

The first argument is the compiled MEL domain. The second argument is the
effect handler map.

```typescript
const app = createManifesto(TodoMel, {}).activate();
```

Pass `{}` while the domain does not declare external effects. Add a handler map
later when you reach the [Effects](./effects) guide or
[Effect Handlers](/guides/effect-handlers).

## The Minimal Loop

```typescript
const result = await app.action.addTodo.submit("Create the app");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.todos);
}
app.dispose();
```

## Common Mistake

`createManifesto()` does not expose runtime verbs by itself. Call `activate()` before using `action`, `snapshot()`, `observe`, or `inspect`.

## Next

Read the current and returned state in [Reading Snapshots](./reading-snapshots),
then learn how domain [State](./state), [Computed Values](./computed-values),
and [Actions](./actions-and-intents) appear from app code. After that, keep
later publications in sync with [Subscriptions](./subscriptions) and learn
action gates in [Availability](./availability). Walk through the longer
[first app tutorial](/tutorial/01-your-first-app) when you want to build the
same path step by step.
