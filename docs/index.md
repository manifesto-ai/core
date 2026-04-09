---
layout: home

hero:
  name: Manifesto
  text: Semantic Layer for Deterministic Domain State
  tagline: Define meaning once, then ship runtime, editor, agent, and inspection surfaces from the same MEL schema.
  actions:
    - theme: brand
      text: Start Building
      link: /quickstart
    - theme: alt
      text: Tooling Setup
      link: /guides/developer-tooling

features:
  - icon: 🎯
    title: Deterministic
    details: Same input -> same output. Always.
  - icon: 🧭
    title: Expandable
    details: Start with the base runtime, then add approval and sealed history only when you need them.
  - icon: 📐
    title: Schema-First
    details: MEL and DomainSchema stay at the center of every surface.
  - icon: 🛠️
    title: Toolable
    details: CLI, LSP, Studio, and agent tooling all derive from the same model.
  - icon: ⚡
    title: Effect Isolation
    details: Pure computation stays separate from IO.
---

## Build Your First App

Most teams should start with the base runtime and stay there until review or history becomes a real requirement.

1. Read [Quickstart](/quickstart) to get one app running.
2. Continue to the [Tutorial](/tutorial/) to learn the base runtime properly.
3. Use [Guides](/guides/) only when you hit a concrete problem.

Start with `@manifesto-ai/sdk` and `@manifesto-ai/compiler`. Add Lineage or Governance only later.

## Add Only What You Need Later

| Need | Go Here | Why |
|------|---------|-----|
| Set up CLI, editor, AI, or Studio workflows | [Developer Tooling](/guides/developer-tooling) | Add surrounding DX without changing the runtime path |
| Add approval, review, or sealed history | [When You Need Approval or History](/guides/approval-and-history) | Escalate from direct dispatch only when the project needs it |
| Look up a package you already know | [API Reference](/api/) | Use package docs as lookup, not onboarding |
| Understand the model more deeply | [Concepts](/concepts/), [Architecture](/architecture/), [Internals](/internals/) | Deep-dive material after the app path feels normal |

## Quick Example

```mel
domain Counter {
  state { count: number = 0 }
  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();
await app.dispatchAsync(app.createIntent(app.MEL.actions.increment));
console.log(app.getSnapshot().data.count); // 1
```

## Keep These Defaults

- Build the first app before reading package reference pages front-to-back.
- Treat direct dispatch and projected `getSnapshot()` reads as the default mental model.
- Add tooling, approval/history, and deep-dive docs only when the app path already feels concrete.
