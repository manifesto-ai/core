# API Reference

> Complete API documentation for Manifesto packages

---

## Primary Package

| Package | Description |
|---------|-------------|
| [@manifesto-ai/sdk](./sdk) | Public developer API. **Start here.** |

---

## Core Packages

| Package | Description |
|---------|-------------|
| [@manifesto-ai/core](./core) | Pure computation engine |
| [@manifesto-ai/host](./host) | Effect execution runtime |
| [@manifesto-ai/world](./world) | Governance layer |

---

## Additional Packages

| Package | Description |
|---------|-------------|
| [@manifesto-ai/compiler](./compiler) | MEL compiler and patch IR lowering |
| [@manifesto-ai/codegen](./codegen) | DomainSchema to TypeScript + Zod codegen |
| [@manifesto-ai/intent-ir](./intent-ir) | Intent intermediate representation |

See [Specifications](/internals/spec/) for normative contracts.

---

## Package Relationships

```mermaid
flowchart TB
  APP["Your Application"] --> SDK["@manifesto-ai/sdk"]
  SDK --> H["@manifesto-ai/host"]
  SDK --> W["@manifesto-ai/world"]
  SDK --> COMP["@manifesto-ai/compiler"]
  H --> C["@manifesto-ai/core"]
  W --> C
  COMP --> C
```

---

## Quick Start

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const instance = createManifesto({
  schema: domainSchema,
  effects: {
    "counter.save": async () => [
      { op: "set", path: [{ kind: "prop", name: "saved" }], value: true },
    ],
  },
});

instance.dispatch({ type: "increment", intentId: crypto.randomUUID() });
console.log(instance.getSnapshot().data);
```

---

## Related Documentation

- **[Core Concepts](/concepts/)** - Manifesto fundamentals
- **[Specifications](/internals/spec/)** - Normative contracts
- **[Architecture](/architecture/)** - System design and boundaries
