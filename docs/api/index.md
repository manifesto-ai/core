# API Reference

> Complete API documentation for Manifesto packages

---

## Primary Package

| Package | Description |
|---------|-------------|
| [@manifesto-ai/app](./app) | High-level app facade. **Start here.** |

The `@manifesto-ai/app` package provides a simple, batteries-included API for building Manifesto applications. It combines Core, Host, World, and Memory into a cohesive interface.

---

## Core Packages

| Package | Description |
|---------|-------------|
| [@manifesto-ai/core](./core) | Pure computation engine |
| [@manifesto-ai/host](./host) | Effect execution runtime |
| [@manifesto-ai/world](./world) | Governance layer |

These packages form the foundation of Manifesto's architecture. Most users interact with them through `@manifesto-ai/app`, but they can be used directly for custom infrastructure.

---

## Additional Packages

| Package | Description | Spec |
|---------|-------------|------|
| @manifesto-ai/compiler | MEL to DomainSchema compilation | [Compiler Spec](/internals/spec/compiler-spec) |
| @manifesto-ai/builder | Type-safe domain definition DSL | [Builder Spec](/internals/spec/builder-spec) |
| @manifesto-ai/bridge | Event bridging and intent projection | [Bridge Spec](/internals/spec/bridge-spec) |
| @manifesto-ai/react | React bindings and hooks | [React Spec](/internals/spec/react-spec) |
| @manifesto-ai/translator | Natural language to semantic change | [Translator Spec](/internals/spec/translator-spec) |
| @manifesto-ai/memory | Context retrieval and verification | [Memory Spec](/internals/spec/memory-spec) |
| @manifesto-ai/lab | LLM governance and HITL tooling | [Lab Spec](/internals/spec/lab-spec) |
| @manifesto-ai/effect-utils | Effect handler utilities | [Effect Utils Spec](/internals/spec/effect-utils-spec) |

---

## Package Relationships

```
                Your Application
                      |
                      v
            ┌─────────────────┐
            │ @manifesto-ai/  │
            │      app        │  <-- Start here
            └─────────────────┘
                      |
     ┌────────────────┼────────────────┐
     v                v                v
┌─────────┐    ┌───────────┐    ┌───────────┐
│  core   │    │   host    │    │   world   │
│(compute)│    │ (execute) │    │ (govern)  │
└─────────┘    └───────────┘    └───────────┘
```

---

## Quick Start

```typescript
import { createApp } from "@manifesto-ai/app";

// Define domain in MEL
const mel = `
domain Counter {
  state {
    count: number = 0
  }

  action increment() {
    once(incrementIntent) {
      patch incrementIntent = $meta.intentId
      patch count = add(count, 1)
    }
  }
}
`;

// Create and use app
const app = createApp(mel);
await app.ready();

await app.act("increment").done();
console.log(app.getState().data.count); // 1
```

---

## Related Documentation

- **[Core Concepts](/concepts/)** - Understand Manifesto fundamentals
- **[Specifications](/internals/spec/)** - Normative contracts for implementations
- **[Architecture](/architecture/)** - System design and component relationships
