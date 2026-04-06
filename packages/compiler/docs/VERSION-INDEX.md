# MEL Compiler Documentation Index

> **Package:** `@manifesto-ai/compiler`
> **Last Updated:** 2026-04-06

---

## Latest Version

- **SPEC:** [v0.7.0](SPEC-v0.7.0.md) (Full)
- **FDR:** [v0.5.0](FDR-v0.5.0.md) (Full)

**Note:** v0.7.0 is the current normative MEL compiler contract. It adds statement composition via `flow` / `include` (ADR-013a) and entity collection primitives `findById()`, `existsById()`, `updateById()`, `removeById()` (ADR-013b). FDR remains at the v0.5.0 rationale baseline.

**Companion Addendum Track:** [v0.8.0](SPEC-v0.8.0.md) is the implemented companion addendum over v0.7.0 for SDK projected introspection. It does not replace the v0.7.0 base spec yet.

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v0.8.0 | [SPEC](SPEC-v0.8.0.md) | [FDR](../../sdk/docs/FDR-v3.1.0-draft.md) | Companion Addendum (Base: v0.7.0) | Draft |
| v0.7.0 | [SPEC](SPEC-v0.7.0.md) | [FDR](FDR-v0.5.0.md) | Full | Current |
| v0.6.0 | — (historical baseline; no standalone file in repo) | [FDR](FDR-v0.5.0.md) | Full | Superseded by v0.7.0 |
| v0.5.0 | [SPEC](SPEC-v0.5.0.md) | [FDR](FDR-v0.5.0.md) | Full | Draft |
| v0.5.0 | [SPEC](SPEC-v0.5.0-patch.md) | [FDR](FDR-v0.5.0-patch.md) | Patch (Base: v0.4.0) | Merged |
| v0.4.0 | [SPEC](SPEC-v0.4.0-patch.md) | [FDR](FDR-v0.4.0-patch.md) | Patch (Base: v0.3.3) | Merged |
| v0.3.3 | [SPEC](SPEC-v0.3.3.md) | [FDR](FDR-v0.3.3.md) | Full | Final |
| v0.3.2 | — (archived) | — (archived) | Full | Superseded |
| v0.3.1 | — (archived) | — (archived) | Full | Superseded |
| v0.3.0 | — (archived) | — (archived) | Full | Superseded |
| v0.2.5 | — | — (archived) | Full | Superseded |

---

## Reading Guide

### For v0.8.0 Addendum

1. Read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) for the current compiler baseline.
2. Read [SPEC-v0.8.0.md](SPEC-v0.8.0.md) for the additive `SchemaGraph` extraction addendum.
3. Read [../../sdk/docs/FDR-v3.1.0-draft.md](../../sdk/docs/FDR-v3.1.0-draft.md) for the consumer-side rationale companion.

### For Latest (v0.7.0)

1. Read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) (full specification)
2. For the two new proposal tracks, read [ADR-013a](../../../docs/internals/adr/013a-mel-statement-composition-flow-and-include.md) and [ADR-013b](../../../docs/internals/adr/013b-entity-collection-primitives.md)
3. For baseline rationale: [FDR-v0.5.0.md](FDR-v0.5.0.md)

### For v0.4.0 (Historical Patch)

1. Read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) for the consolidated spec.
2. For historical diff: [SPEC-v0.4.0-patch.md](SPEC-v0.4.0-patch.md)
3. For rationale: [FDR-v0.5.0.md](FDR-v0.5.0.md) + [FDR-v0.4.0-patch.md](FDR-v0.4.0-patch.md)

### For Stable (v0.3.3)

1. Read [SPEC-v0.3.3.md](SPEC-v0.3.3.md) (complete)
2. For rationale: [FDR-v0.3.3.md](FDR-v0.3.3.md)
