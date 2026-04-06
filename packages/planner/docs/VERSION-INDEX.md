# Planner Documentation Index

> **Package:** `@manifesto-ai/planner`
> **Last Updated:** 2026-04-07

## Current Specification

- **Package Release:** v0.2.0
- **Contract Surface:** implemented planner slice with greedy + MCTS strategies
- **SPEC (Living Document):** [planner-SPEC.md](planner-SPEC.md)
- **README:** [../README.md](../README.md)
- **Guide:** [GUIDE.md](GUIDE.md)

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for the app-facing `withPlanner(...).activate()` path.
3. Read [planner-SPEC.md](planner-SPEC.md) for the current implemented contract.
4. Use the internal [planner draft spec](../../../docs/internals/spec/planner-SPEC-v1.2.0-draft.md) only for future-phase design beyond the current slice.

## Version Map

| Version | SPEC | ADR / Draft | Type | Status |
|---------|------|-------------|------|--------|
| v0.2.0 | [SPEC](planner-SPEC.md) | [Planner Draft v1.2.0](../../../docs/internals/spec/planner-SPEC-v1.2.0-draft.md), [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Implemented planner slice: builder + `withPlanner()` + greedy + MCTS strategies | Current |

## Notes

- The current planner package is implemented as a usable runtime slice with both bundled strategies landed.
- The internal draft spec remains useful for future planner phases such as tracing, richer candidate helpers, and broader search tooling.
- The truthful current package story is `createPlanner() -> withPlanner(governed, config).activate() -> preview()/plan()`.
