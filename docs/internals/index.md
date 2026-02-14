# Internals

> For contributors, implementers, and deep-dive readers.

This section contains detailed technical documentation for those who want to understand or contribute to Manifesto's implementation.

## Architecture

- [Architecture Overview](./architecture) - Layer structure and boundaries (v2.0)
- [Glossary](./glossary) - Term definitions

## Architecture Decision Records (ADRs)

Records of significant architectural decisions:

| ID | Title | Status |
|----|-------|--------|
| [ADR-001](./adr/001-layer-separation) | Layer Separation after Host v2.0.1 | Accepted |
| [ADR-002](./adr/002-dx-improvement-mel-namespace-onceIntent) | DX 개선 — `$mel` 자동 주입 + `onceIntent` | Proposed |
| [ADR-003](./adr/003-world-owns-persistence) | World Owns Persistence | Proposed |
| [ADR-004](./adr/004-app-package-internal-decomposition) | App Package Internal Decomposition | Proposed |
| [ADR-005](./adr/005-dx-improvement-snapshot-path-dsl) | DX 개선 — Snapshot Path DSL (`${...}`) 도입 | Withdrawn |
| [ADR-006](./adr/006-runtime-reframing) | Publish Boundary, Canonicalization, and Channel Separation Rules | Proposed |
| [ADR-007](./adr/007-sdk-runtime-split-kickoff) | SDK/Runtime Split Kickoff Gate and Staged Locking | Accepted |

Status meanings (Proposed, Accepted, Withdrawn, etc.) are defined in [ADR Status Definitions](./adr/#adr-status-definitions).

## Specifications

Formal specifications for each package. See the [Specifications Hub](./spec/) for links to all package specifications with current versions.

## Design Rationale (FDRs)

Foundational Design Records explaining the "why" behind decisions. See the [FDR Hub](./fdr/) for links to all package FDRs.

## Contributing

See the [Contributing Guide](https://github.com/manifesto-ai/core/blob/main/CONTRIBUTING.md) for how to contribute to Manifesto.
