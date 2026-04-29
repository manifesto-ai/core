# Governance Protocol Documentation Index

> **Package:** `@manifesto-ai/governance`
> **Last Updated:** 2026-04-29

## Current Specification

- **Package Release:** v5.x release train
- **Contract Surface:** v5 governance-mode SDK action-candidate surface with decorator-owned `submit()`, durable `ProposalRef`, runtime `waitForSettlement(ref)`, and governance control surface separation
- **SPEC (Living Document):** [governance-SPEC.md](governance-SPEC.md) - current ADR-026 governance-mode contract for Manifesto v5
- **README:** [../README.md](../README.md)
- **Guide:** [GUIDE.md](GUIDE.md)

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for `withGovernance()` usage.
3. Read [governance-SPEC.md](governance-SPEC.md) for the current living governance contract.
4. Read [ADR-026](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md) for the SDK v5 action-candidate surface.
5. Read [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md) for `snapshot.state`, `snapshot.namespaces`, and failure observation boundaries.
6. Use [governance-SPEC-2.0.0v.md](governance-SPEC-2.0.0v.md) only when you need the historical service-first baseline.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v5.x | [SPEC](governance-SPEC.md) | [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md), [ADR-026](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md), [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Governance-mode SDK v5 decorator surface with law-aware `submit()`, durable `ProposalRef`, `waitForSettlement(ref)`, and separated control surface | Current |
| v3.0.0 | Git history | [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Decorator runtime + governed activation with `proposeAsync()` and proposal settlement helpers | Superseded |
| v2.0.0 | [SPEC](governance-SPEC-2.0.0v.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Service-first split package contract | Superseded |
| v1.0.0 | [SPEC](governance-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Historical |

## Notes

- The current contract surface is the v5 governance-mode decorator model with `actions.x.submit()` / `action(name).submit()` as the canonical governed write ingress.
- `ProposalRef` is the durable settlement handle and must survive process boundaries.
- `pending.waitForSettlement()` and `app.waitForSettlement(ref)` observe settlement; they do not approve, reject, execute, seal, or publish by themselves.
- `approve()`, `reject()`, proposal lookup, decision lookup, and actor binding remain governance-owned control surface methods, not action submission verbs.
- V3 `proposeAsync()`, `waitForProposal()`, and `waitForProposalWithReport()` are historical migration inputs, not canonical v5 runtime root methods.
- Low-level service/store exports remain public, but they are no longer the canonical package story.
