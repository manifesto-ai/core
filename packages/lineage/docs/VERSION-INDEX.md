# Lineage Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-04-29

## Current Contract

| Version | Document | ADR | Notes | Status |
|---------|----------|-----|-------|--------|
| v5.x | [SPEC](lineage-SPEC.md) | [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md), [ADR-026](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md), [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Lineage-mode SDK v5 decorator surface with law-aware `submit()`, `WorldRecord` lineage result refs, ADR-025 `state` / `namespaces` hash alignment, and canonical removal of root `commitAsync*` write verbs. | Current |

## Superseded Contract

| Version | Document | ADR | Notes | Status |
|---------|----------|-----|-------|--------|
| v3.x | Git history / prior living SPEC revisions | [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md), [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Decorator runtime with `withLineage(...).activate()`, `commitAsync()`, `commitAsyncWithReport()`, restore/head/branch/world queries, and continuity substrate. These names are historical migration inputs, not v5 compatibility targets. | Superseded |
| v2.0.0 | [SPEC](lineage-SPEC-2.0.0v.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Service-first hard-cut lineage contract. | Superseded |
| v1.0.1 | [SPEC](lineage-SPEC-1.0.1v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Split-native baseline patch release. | Historical |
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction. | Historical |

## Reading Order

1. Read [lineage-SPEC.md](lineage-SPEC.md) for the current Lineage v5 living contract.
2. Read [SDK SPEC](../../sdk/docs/sdk-SPEC.md) for the common action-candidate grammar and mode-specific submit result skeletons.
3. Read [ADR-026](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md) for the law-aware `submit()` rationale.
4. Read [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md) for `snapshot.state`, `snapshot.namespaces`, `snapshotHash`, `worldId`, and restore ontology.
5. Read [GUIDE.md](GUIDE.md) only as current implementation guidance while the v5 source cut is in progress; it still reflects the v3 runtime implementation until the Lineage development slice lands.

## Notes

- The current normative Lineage contract is v5 even though source implementation may still be mid-cut on `feature/v5`.
- `@manifesto-ai/lineage` owns continuity storage semantics; SDK owns the common app-facing action-candidate grammar.
- Root `commitAsync()` and `commitAsyncWithReport()` are superseded by lineage-mode `actions.x.submit()` and the submit result `report` field in the canonical v5 public surface.
- `@manifesto-ai/lineage` remains the continuity decorator in the governed composition path; `@manifesto-ai/governance` owns authority and settlement semantics.
