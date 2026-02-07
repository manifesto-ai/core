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

| Package | Description |
|---------|-------------|
| [@manifesto-ai/compiler](./compiler) | MEL to DomainSchema compilation and `.mel` toolchain adapters |
| [@manifesto-ai/intent-ir](./intent-ir) | Intent intermediate representation and key derivation |

See [Specifications](/internals/spec/) for detailed package specifications.

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
