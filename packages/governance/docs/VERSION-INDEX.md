# Governance Protocol Documentation Index

> **Package:** `@manifesto-ai/governance`
> **Last Updated:** 2026-04-13

## Current Specification

- **Package Release:** v3.7.0
- **Contract Surface:** v3.0 decorator runtime + governed activation + additive settlement observers `waitForProposal()` and `waitForProposalWithReport()`
- **SPEC (Living Document):** [governance-SPEC.md](governance-SPEC.md) - current contract, including `waitForProposal()` and `waitForProposalWithReport()`, through package release v3.x
- **README:** [../README.md](../README.md)
- **Guide:** [GUIDE.md](GUIDE.md)

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for `withGovernance()` usage.
3. Read [governance-SPEC.md](governance-SPEC.md) for the current living governance contract.
4. Use [governance-SPEC-2.0.0v.md](governance-SPEC-2.0.0v.md) only when you need the historical service-first baseline.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v3.0.0 | [SPEC](governance-SPEC.md) | [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Decorator runtime + governed activation | Current |
| v2.0.0 | [SPEC](governance-SPEC-2.0.0v.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Service-first split package contract | Superseded |
| v1.0.0 | [SPEC](governance-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Historical |

## Notes

- The current contract surface remains the v3.x governance decorator model with the additive `waitForProposal()` and `waitForProposalWithReport()` observers documented in [governance-SPEC.md](governance-SPEC.md).
- The truthful current application-facing contract is `withGovernance(manifesto, config).activate()`.
- Governance v3 requires explicit lineage composition and removes direct `dispatchAsync` / `commitAsync` from governed instances.
- `waitForProposal()` and `waitForProposalWithReport()` are additive observation helpers only. They do not replace `proposeAsync()` as the governed write path.
- Low-level service/store exports remain public, but they are no longer the canonical package story.
