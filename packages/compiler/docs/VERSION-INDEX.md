# MEL Compiler Documentation Index

> **Package:** `@manifesto-ai/compiler`
> **Last Updated:** 2026-04-14

---

## Latest Version

- **Current Full SPEC:** [v1.0.0](SPEC-v1.0.0.md) (Full)
- **FDR:** [v0.5.0](FDR-v0.5.0.md) (Full)

**Note:** [v1.0.0](SPEC-v1.0.0.md) is the current integrated compiler contract. It rolls up the old v0.7.0 baseline plus the v0.8.0 `SchemaGraph` and v0.9.0 `dispatchable when` addenda, reflects the landed `TypeDefinition`-backed support for nullable and record schema-position types, clarifies that any future additive MEL surface forms must preserve existing builtin meanings and lower only through the compiler-owned MEL → Core boundary, and records the admitted bounded sugar function forms in parser-free function-call shape.

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.0 | [SPEC](SPEC-v1.0.0.md) | [FDR](FDR-v0.5.0.md) | Full | Current |
| v0.9.0 | [SPEC](SPEC-v0.9.0.md) | [FDR](../../sdk/docs/FDR-v3.1.0-draft.md) | Historical Addendum (merged into v1.0.0) | Superseded |
| v0.8.0 | [SPEC](SPEC-v0.8.0.md) | [FDR](../../sdk/docs/FDR-v3.1.0-draft.md) | Historical Addendum (merged into v1.0.0) | Superseded |
| v0.7.0 | [SPEC](SPEC-v0.7.0.md) | [FDR](FDR-v0.5.0.md) | Historical Full Baseline | Superseded |
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

### For Current

1. Read [SPEC-v1.0.0.md](SPEC-v1.0.0.md) for the current full compiler contract.
2. Use [SPEC-v0.8.0.md](SPEC-v0.8.0.md) and [SPEC-v0.9.0.md](SPEC-v0.9.0.md) only for historical addendum context.
3. For rationale history, use [FDR-v0.5.0.md](FDR-v0.5.0.md).

### For v0.4.0 (Historical Patch)

1. Read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) for the consolidated spec.
2. For historical diff: [SPEC-v0.4.0-patch.md](SPEC-v0.4.0-patch.md)
3. For rationale: [FDR-v0.5.0.md](FDR-v0.5.0.md) + [FDR-v0.4.0-patch.md](FDR-v0.4.0-patch.md)

### For Stable (v0.3.3)

1. Read [SPEC-v0.3.3.md](SPEC-v0.3.3.md) (complete)
2. For rationale: [FDR-v0.3.3.md](FDR-v0.3.3.md)
