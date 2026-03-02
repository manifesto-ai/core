# @manifesto-ai/runtime

> Internal execution orchestration engine for the Manifesto protocol stack

> **Internal Package:** not intended for direct end-user consumption. Use `@manifesto-ai/sdk`.

---

## Overview

`@manifesto-ai/runtime` orchestrates SDK, Host, and World.

- Action pipeline: prepare -> authorize -> execute -> persist -> finalize
- Policy/memory/branch/subscription management
- WorldStore integration for snapshot and delta persistence

---

## ADR-009 Runtime Alignment

### Patch Persistence Envelope

Runtime persistence adapters MUST version serialized patch payloads:

```typescript
type PersistedPatchEnvelope = {
  _patchFormat: 2;
  patches: readonly Patch[];
};
```

### Restore Boundary Rules

- Restore ingress MUST accept only `_patchFormat: 2`.
- `_patchFormat: 1` or missing tag MUST be hard-rejected.
- Legacy rejection MUST trigger fresh genesis initialization (epoch reset policy).

---

## Pipeline Note

- Domain state changes are applied through `Patch[]`.
- System transitions are represented through Core `SystemDelta` channel.
- Runtime MUST NOT rely on direct patching of `system.*` fields.

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/sdk](./sdk) | Public API layer (consumes Runtime) |
| [@manifesto-ai/core](./core) | Pure computation |
| [@manifesto-ai/host](./host) | Effect execution |
| [@manifesto-ai/world](./world) | Governance and lineage |
| [@manifesto-ai/compiler](./compiler) | MEL compilation |
