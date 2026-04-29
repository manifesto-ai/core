# MEL Compiler Documentation Index

> **Package:** `@manifesto-ai/compiler`
> **Last Updated:** 2026-04-25

---

## Latest Version

- **Current Full SPEC:** [v5.0.0](SPEC-v1.2.0.md) (Full, in-place current file)
- **FDR:** [v0.5.0](FDR-v0.5.0.md) (Full)

**Note:** [v5.0.0](SPEC-v1.2.0.md) is the current integrated compiler contract. It carries forward the v1.3.0 baseline and aligns the compiler contract to ADR-025: MEL `state {}` maps to runtime `snapshot.state`, compiler-owned bookkeeping uses `snapshot.namespaces.mel`, and `onceIntent` writes through the `NamespaceDelta` channel.

**ADR Sources:** [ADR-021](../../../docs/internals/adr/021-mel-structural-annotation-system-meta-sidecar.md) defines the current structural-annotation sidecar contract, [ADR-022](../../../docs/internals/adr/022-compiler-owned-source-location-sidecar-source-map-index.md) defines the current source-location sidecar contract, [ADR-024](../../../docs/internals/adr/024-compiler-owned-mel-source-fragment-editing-primitive.md) defines the current source-fragment editing boundary, and [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md) defines the v5 Snapshot ontology and namespace separation.

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v5.0.0 | [SPEC](SPEC-v1.2.0.md) | [FDR](FDR-v0.5.0.md) | Full | Current |
| v1.3.0 | — (same file path before in-place v5.0.0 update) | [FDR](FDR-v0.5.0.md) | Historical Full Predecessor | Superseded |
| v1.2.0 | — (same file path before in-place v1.3.0 update) | [FDR](FDR-v0.5.0.md) | Historical Full Predecessor | Superseded |
| v1.1.0 | [SPEC](SPEC-v1.1.0.md) | [FDR](FDR-v0.5.0.md) | Historical Full Predecessor | Superseded |
| v1.0.0 | [SPEC](SPEC-v1.0.0.md) | [FDR](FDR-v0.5.0.md) | Historical Full Predecessor | Superseded |
| v0.9.0 | [SPEC](SPEC-v0.9.0.md) | [FDR](../../sdk/docs/FDR-v3.1.0.md) | Historical Addendum (merged into v1.0.0) | Superseded |
| v0.8.0 | [SPEC](SPEC-v0.8.0.md) | [FDR](../../sdk/docs/FDR-v3.1.0.md) | Historical Addendum (merged into v1.0.0) | Superseded |
| v0.7.0 | [SPEC](SPEC-v0.7.0.md) | [FDR](FDR-v0.5.0.md) | Historical Full Baseline | Superseded |
| v0.6.0 | — (historical baseline; no standalone file in repo) | [FDR](FDR-v0.5.0.md) | Full | Superseded by v0.7.0 |
| v0.5.0 | [SPEC](SPEC-v0.5.0.md) | [FDR](FDR-v0.5.0.md) | Historical Full Baseline | Superseded |
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

1. Read [SPEC-v1.2.0.md](SPEC-v1.2.0.md) for the current full compiler contract (currently v5.0.0 in-place).
2. Use [SPEC-v0.8.0.md](SPEC-v0.8.0.md) and [SPEC-v0.9.0.md](SPEC-v0.9.0.md) only for historical addendum context.
3. For rationale history, use [FDR-v0.5.0.md](FDR-v0.5.0.md).
4. If you are working on tooling sidecars, read [SPEC-v1.2.0.md](SPEC-v1.2.0.md), then [ADR-021](../../../docs/internals/adr/021-mel-structural-annotation-system-meta-sidecar.md) and [ADR-022](../../../docs/internals/adr/022-compiler-owned-source-location-sidecar-source-map-index.md) for architectural rationale.
5. If you are working on authoring-time compiler source edits, read [ADR-024](../../../docs/internals/adr/024-compiler-owned-mel-source-fragment-editing-primitive.md) for the boundary rationale behind `compileFragmentInContext()`.
6. If you are working on `onceIntent`, namespace lowering, or Snapshot ontology, read [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md).

### For v0.4.0 (Historical Patch)

1. Read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) for the consolidated spec.
2. For historical diff: [SPEC-v0.4.0-patch.md](SPEC-v0.4.0-patch.md)
3. For rationale: [FDR-v0.5.0.md](FDR-v0.5.0.md) + [FDR-v0.4.0-patch.md](FDR-v0.4.0-patch.md)

### For Stable (v0.3.3)

1. Read [SPEC-v0.3.3.md](SPEC-v0.3.3.md) (complete)
2. For rationale: [FDR-v0.3.3.md](FDR-v0.3.3.md)
