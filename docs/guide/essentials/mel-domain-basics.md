# MEL Domain Basics

> A MEL domain names your state, derived values, and allowed actions.

MEL is the authoring format for Manifesto domains. It compiles to data the
runtime can run the same way each time.

## A Small Domain

```mel
domain Counter {
  type Label = {
    text: string
  }

  state {
    count: number = 0
    label: Label = { text: "Counter" }
  }

  computed doubled = count * 2

  action increment() {
    onceIntent {
      patch count = count + 1
    }
  }
}
```

## What Each Part Means

| Part | Purpose |
|------|---------|
| `domain Counter` | Names the domain model |
| `type Label` | Defines a reusable MEL type |
| `state` | Declares source-of-truth data and defaults |
| `computed` | Declares values derived from current state |
| `action` | Declares a typed transition that callers can request |
| `onceIntent` | Makes the action body run once for one submitted action |
| `patch` | Writes the next state through the runtime |

## In Your App

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto(CounterMel, {}).activate();
```

## Common Mistake

MEL is not executed like JavaScript. It defines the domain model. TypeScript
code activates that model, submits actions, and reads Snapshots.

## Next

Read [MEL For App Developers](./mel-for-app-developers) for the small syntax set
you need before wiring UI, routes, or agents. Then create the runtime in
[Creating an App](./creating-an-app) and read it in
[Reading Snapshots](./reading-snapshots). After that, learn what belongs in
[State](./state) and [Computed Values](./computed-values). For full syntax, use
the [MEL Reference](/mel/REFERENCE).
