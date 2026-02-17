# ADR-008: SDK-First Public Entry and App Package Retirement

> **Status:** Accepted
> **Date:** 2026-02-17
> **Deciders:** Manifesto Architecture Team
> **Scope:** Global (SDK, Runtime, Docs, Release, CI)
> **Supersedes (partial):** ADR-007 §2.3/§2.5 Phase 1 entrypoint guardrails
> **Related:** ADR-001 (Layer Separation), ADR-006 (PUB/CHAN/CAN), ADR-007 (Split Kickoff)

---

## 1. Context

ADR-007 locked split kickoff with `@manifesto-ai/app` as the Phase 1 canonical entry point while Runtime/SDK were introduced.
By 2026-02-14, pre-alpha exit gates (`PUB-3`, `CHAN-1`, architecture sign-off) were recorded as closed, and transition planning was unlocked.

The remaining gap was operational:

1. Public docs still centered on `@manifesto-ai/app`.
2. SDK was not yet the single canonical package for new integrations.
3. App remained a compatibility facade without a retirement decision.

This ADR finalizes Phase 2 by making SDK-first normative and scheduling hard retirement of App.

---

## 2. Decision

### 2.1 Canonical Public Entry

`@manifesto-ai/sdk` is the canonical public entry for Manifesto applications.

- All user-facing quickstart/tutorial/guides MUST use `@manifesto-ai/sdk` imports.
- API reference MUST present SDK as "Start here".
- Runtime remains internal orchestration.

### 2.2 SDK Versioning

SDK is promoted to stable public status at `v1.0.0`.

- Public contract authority for entrypoint usage is SDK SPEC + this ADR.
- Runtime may continue on independent internal version cadence.

### 2.3 App Compatibility and Retirement

App retirement is fixed as a hard transition in two releases:

1. **R1:** `@manifesto-ai/app` remains compatibility-only and is marked deprecated.
2. **R2 (next regular release):** `@manifesto-ai/app` package is removed from workspace and release components.

After R2, App is a historical artifact only (legacy docs/changelog references).

### 2.4 Migration Tooling Requirement

Transition MUST provide deterministic migration tooling:

- An import rewrite utility (`@manifesto-ai/app` → `@manifesto-ai/sdk`) with dry-run mode.
- A migration guide documenting supported replacements and known non-equivalences.

### 2.5 Release and Compliance Guards

- Release configuration MUST exclude App after R2.
- CI MUST enforce no reintroduction of `@manifesto-ai/app` imports outside legacy/historical paths.

---

## 3. Consequences

### 3.1 Positive

1. Single public entrypoint reduces onboarding ambiguity.
2. SDK contract is explicit and independently evolvable.
3. Package boundary messaging aligns with implementation reality.

### 3.2 Trade-offs

1. Existing App imports require migration.
2. Historical references to App remain in ADR/FDR for traceability and cannot be blanket-edited.
3. CI and release policy gain stricter guardrails.

---

## 4. Non-Goals

This ADR does NOT:

- Introduce new architectural layers.
- Change Core/Host/World constitutional sovereignty boundaries.
- Change runtime execution semantics.

---

## 5. Implementation Markers

Phase 2 is considered implemented when all are true:

1. SDK appears as canonical entrypoint in user-facing docs.
2. App package is absent from release-please component map.
3. App package directory is removed.
4. CI import guard blocks non-legacy App references.

---

*End of ADR-008*
