# Internals

> For contributors, implementers, and deep-dive readers.

If you are onboarding to the public product surface, stop here and go to [Docs Home](/), [Quick Start](/guide/quick-start), or [Tutorial](/tutorial/). Internals are intentionally the last stop, not the first one.

This section contains detailed technical documentation for those who want to understand or contribute to Manifesto's implementation.

## Maintained Internals

Use these pages when you need the current contributor-facing rules around documentation, testing, and glossary terms.

- [Glossary](./glossary) - Term definitions
- [Test Conventions](./test-conventions) - Test naming and discovery
- [Documentation Governance](./documentation-governance) - Docs maintenance rules
- [Current Contract](./spec/current-contract) - Single current-only contract entry for external consumers
- [Layer Boundaries](/architecture/layers) - Normative layer spec (in Architecture section)

---

## Historical Collections

These indexes are preserved for architectural history and normative traceability. They are not the fastest way to learn the current public surface.

- [Architecture Decision Records](./adr/) - Historical decision record index
- [Specifications](./spec/) - Current package specs plus historical references
- [Design Rationale (FDR)](./fdr/) - Rationale index and archived rationale references
- [Retired Runtime Pages](./retired/app) - Removed package retirement records

---

## Architecture Decision Records (ADRs)

Records of significant architectural decisions:

| ID | Title | Status |
|----|-------|--------|
| [ADR-001](./adr/001-layer-separation) | Layer Separation after Host v2.0.1 | Accepted |
| [ADR-002](./adr/002-dx-improvement-mel-namespace-onceIntent) | DX improvement — automatic `$mel` injection + `onceIntent` | Implemented |
| [ADR-003](./adr/003-world-owns-persistence) | World Owns Persistence | Proposed |
| [ADR-004](./adr/004-app-package-internal-decomposition) | App Package Internal Decomposition | Proposed |
| [ADR-005](./adr/005-dx-improvement-snapshot-path-dsl) | DX improvement — Snapshot Path DSL (`${...}`) introduction | Withdrawn |
| [ADR-006](./adr/006-runtime-reframing) | Publish Boundary, Canonicalization, and Channel Separation Rules | Proposed |
| [ADR-007](./adr/007-sdk-runtime-split-kickoff) | SDK/Runtime Split Kickoff Gate and Staged Locking | Superseded |
| [ADR-008](./adr/008-sdk-first-transition-and-app-retirement) | SDK-First Public Entry and App Package Retirement | Deprecated |
| [ADR-009](./adr/009-structured-patch-path) | Structured PatchPath (Segments) | Implemented |
| [ADR-010](./adr/010-major-hard-cut) | Protocol-First SDK Reconstruction | Implemented |
| [ADR-011](./adr/011-host-boundary-reset-and-executionkey-serialization) | Host Boundary Reset Completeness Policy | Implemented |
| [ADR-012](./adr/012-remove-computed-prefix) | Remove `computed.` Prefix from Computed Snapshot Keys | Implemented |
| [ADR-013a](./adr/013a-mel-statement-composition-flow-and-include) | MEL Statement Composition — `flow` and `include` | Implemented |
| [ADR-013b](./adr/013b-entity-collection-primitives) | Entity Collection Primitives — `findById`, `existsById`, `updateById`, `removeById` | Implemented |
| [ADR-014](./adr/014-split-world-protocol) | Split World Protocol into Governance and Lineage Packages | Implemented |
| [ADR-015](./adr/015-snapshot-ontological-purification) | Snapshot Ontological Purification — Remove Accumulated History from Point-in-Time State | Implemented |
| [ADR-016](./adr/016-merkle-tree-lineage) | Merkle Tree Lineage — Positional World Identity via Parent-Linked Hashing | Implemented |
| [ADR-017](./adr/017-capability-decorator-pattern) | Capability Decorator Pattern — Semantic Transformation of SDK Surface | Implemented |
| [ADR-018](./adr/018-public-snapshot-boundary) | Public Snapshot Boundary — User-Facing Snapshot Projection and CanonicalSnapshot Separation | Implemented |
| [ADR-019](./adr/019-post-activation-extension-kernel) | Post-Activation Extension Kernel — Safe Public Seam for Arbitrary-Snapshot Operations | Implemented |
| [ADR-020](./adr/020-intent-level-dispatchability) | Intent-Level Dispatchability — `dispatchable when` Clause | Implemented |
| [ADR-021](./adr/021-mel-structural-annotation-system-meta-sidecar) | MEL Structural Annotation System — `@meta` Sidecar | Accepted |
| [ADR-022](./adr/022-compiler-owned-source-location-sidecar-source-map-index) | Compiler-Owned Source Location Sidecar (`SourceMapIndex`) | Accepted |
| [ADR-023](./adr/023-object-spread-sugar-in-mel) | Object Spread Sugar in MEL | Accepted |
| [ADR-024](./adr/024-compiler-owned-mel-source-fragment-editing-primitive) | Compiler-Owned MEL Source Fragment Editing Primitive | Accepted |
| [ADR-025](./adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation) | Snapshot Ontology Hard Cut — `data` Retirement and Namespace Separation | Accepted |

Status meanings (Proposed, Accepted, Implemented, Withdrawn, etc.) are defined in [ADR Status Definitions](./adr/#adr-status-definitions).

There is no standalone `ADR-013` page. The mixed proposal was split into [ADR-013a](./adr/013a-mel-statement-composition-flow-and-include) and [ADR-013b](./adr/013b-entity-collection-primitives).

### Documentation Governance

- [Documentation Governance](./documentation-governance.md) — Core documentation operating rules for ADR/SPEC/FDR, link consistency, archival policy, and PR documentation gates

## Specifications

Formal specifications for each package. See the [Specifications Hub](./spec/) for links to all package specifications with current versions, plus draft package specs that have not yet landed in the active workspace.

## Design Rationale (FDRs)

Foundational Design Records explaining the "why" behind decisions. See the [FDR Hub](./fdr/) for links to all package FDRs.

## Contributing

See the [Contributing Guide](https://github.com/manifesto-ai/core/blob/main/CONTRIBUTING.md) for how to contribute to Manifesto.
