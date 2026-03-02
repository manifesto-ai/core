# Manifesto Runtime Documentation Index

> **Package:** `@manifesto-ai/runtime`
> **Last Updated:** 2026-03-02
> **Visibility:** Internal — not intended for direct consumption

> **RETIRED:** This package is retired per [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md) (Protocol-First SDK Reconstruction).
> Runtime responsibilities are absorbed into `createManifesto()` in `@manifesto-ai/sdk`.
> See: [SDK SPEC v1.0.0](../../sdk/docs/sdk-SPEC-v1.0.0.md) | [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md)

---

## Latest Version

- **Package:** Retired (per ADR-010)
- **Last SPEC:** [v0.2.0](runtime-SPEC-v0.2.0.md) (Superseded, no successor)

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v0.2.0 | [SPEC](runtime-SPEC-v0.2.0.md) | — | Internal orchestration ADR-009 alignment | Superseded (no successor) |
| v0.1.0 | [SPEC](runtime-SPEC-v0.1.0.md) | — | Internal orchestration baseline | Superseded (no successor) |

---

## Reading Guide

1. For the current public API contract, see [SDK SPEC v1.0.0](../../sdk/docs/sdk-SPEC-v1.0.0.md).
2. For the retirement decision, see [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md).
3. For historical reference, [runtime-SPEC-v0.2.0.md](runtime-SPEC-v0.2.0.md) documents the pre-retirement architecture.
4. For compliance test mapping (historical), see [runtime-SPEC-compliance-test-suite](runtime-SPEC-compliance-test-suite.md).

---

## Relationship to Other Packages (Historical)

```text
@manifesto-ai/sdk (public API — createManifesto)
  └── [retired] @manifesto-ai/runtime (absorbed into createManifesto internal wiring)
        └── core, host, world, compiler
```

After ADR-010, the architecture is:

```text
@manifesto-ai/sdk (createManifesto — sole composition function)
  ├── @manifesto-ai/core      (pure computation)
  ├── @manifesto-ai/host      (effect execution)
  ├── @manifesto-ai/world     (governance, lineage)
  └── @manifesto-ai/compiler  (MEL → DomainSchema)
```
