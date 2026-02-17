# @manifesto-ai/runtime

> **Runtime** is the internal orchestration engine for the Manifesto protocol stack.

> **Internal Package:** This package is not intended for direct consumption. Use `@manifesto-ai/sdk`.

---

## Overview

Runtime sits between SDK and protocol layers and executes the action lifecycle.

```text
SDK (public API)
    |
    v
Runtime (orchestration)
    |
    +--> Core (compute)
    +--> Host (execute)
    +--> World (govern)
```

---

## Responsibilities

- 5-stage action pipeline: prepare → authorize → execute → persist → finalize
- Shared type and error definitions
- Policy routing and scope validation
- Memory hub integration and context freezing
- Branch and world-store orchestration
- System runtime handling (`system.*` actions)

---

## Non-Responsibilities

- Public API contract design (SDK responsibility)
- Pure semantic computation (Core responsibility)
- Effect IO execution semantics (Host responsibility)
- Governance decisions and lineage policy (World responsibility)

---

## Installation

Runtime is consumed transitively by SDK.

```bash
pnpm add @manifesto-ai/sdk
```

---

## Relationship with Other Packages

| Relationship | Package | How |
|--------------|---------|-----|
| Consumed by | `@manifesto-ai/sdk` | SDK delegates orchestration to Runtime |
| Depends on | `@manifesto-ai/core` | Pure computation |
| Depends on | `@manifesto-ai/host` | Effect execution |
| Depends on | `@manifesto-ai/world` | Governance and lineage |
| Depends on | `@manifesto-ai/compiler` | MEL compilation |

---

## Documentation

- [runtime-SPEC-v0.1.0.md](docs/runtime-SPEC-v0.1.0.md)
- [VERSION-INDEX.md](docs/VERSION-INDEX.md)
- [ADR-008](../../docs/internals/adr/008-sdk-first-transition-and-app-retirement.md)

---

## License

[MIT](../../LICENSE)
