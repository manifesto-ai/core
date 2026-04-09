# MEL Domain Basics

> A MEL domain names your state, derived values, and allowed actions.

MEL is the authoring format for Manifesto domains. It compiles to schema data that the runtime can compute deterministically.

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

  computed doubled = mul(count, 2)

  action increment() {
    onceIntent {
      patch count = add(count, 1)
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
| `onceIntent` | Makes the action body run once for one dispatched intent |
| `patch` | Writes the next state through the runtime |

## In Your App

```typescript
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();
```

## Common Mistake

MEL is not executed like JavaScript. It defines the semantic model. TypeScript code activates that model, creates intents, and reads Snapshots.

## Next

Learn what belongs in [State](./state), then what belongs in [Computed Values](./computed-values). For full syntax, use the [MEL Reference](/mel/REFERENCE).
