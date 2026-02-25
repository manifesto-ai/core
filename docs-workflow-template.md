# Documentation Workflow Template (ADR → Living SPEC)

> **Purpose:** Keep multi-package architectural decisions consistent across ADR, SPEC, and FDR/version records.

---

## 1) Recommended Document Types

### ADR (`docs/internals/adr/`)
- **Format:** `ADR-XXX-<slug>.md`
- **Role:** Immutable decision log preserving context, alternatives, and consequences.
- **Lifecycle:** `Proposed -> Accepted -> Implemented / Deprecated / Superseded / Withdrawn`
- **Rule:** Mark as `Implemented` when absorbed into specs, and include the target SPEC/version/section.

### SPEC (`docs/*-SPEC.md` package specs)
- **Format:** `<layer>-SPEC.md` or `<layer>-SPEC-vX.Y.Z.md`
- **Role:** Single current canonical normative document (**Living Document**).
- **Rule:** Do not require patch-chain navigation for interpretation.
- **Change method:** Edit body directly, update `Changelog`, and refresh related indexes.

### FDR (`docs/internals/fdr/`, package-level FDR docs)
- **Format:** Contextual rationale documents.
- **Role:** Explain why decisions were made.
- **Rule:** Inline core rationale into SPEC `Rationale` blocks whenever possible.
- **Retention:** Prefer inlined rationale over long-lived standalone patch-like FDRs.

### Migration / Guide
- **Format:** Write only when user migration requires support.
- **Rule:** Informational only; must not replace normative specs.

---

## 2) Process

### 2-1. Decision

1. Draft ADR (`Context / Decision / Consequences`)
2. Obtain reviewer approval and set `Status: Accepted`
3. Confirm impact scope (`SPEC`, `FDR`, and tests)

### 2-2. Spec Integration

4. Apply changes directly to target SPECs (update living docs).
5. Record issue/version/impact in the spec `Changelog`.
6. Update package `VERSION-INDEX.md` or related indexes.
7. Inline rationale in SPECs or align standalone FDR docs if required.
8. Move temporary comparison docs, notes, and intermediate diffs to `archive/`.

### 2-3. Completion

9. Normalize ADR status (`Implemented` recommended).
10. Validate cross-links among ADR, SPEC, and FDR.
11. Confirm relevant tests/gates cover the introduced rule.

---

## 3) Minimal Templates

### ADR Template (Recommended)

```markdown
# ADR-XXX: <Title>

> **Status:** Proposed | Accepted | Implemented | Deprecated | Superseded | Withdrawn
> **Date:** YYYY-MM-DD
> **Date of Acceptance:** YYYY-MM-DD (optional)
> **Date of Implementation:** YYYY-MM-DD (optional)
> **Scope:** <packages/layers>
> **Implements:** <Layer>-SPEC vA.B.C (optional)

## Context

## Decision

## Alternatives

## Consequences

## Evidence
- SPEC: <file#section>
- Test: <path>
```

### SPEC Integration Checklist

- Identify any conflict with existing rules
- Classify as new API/behavior vs contextual correction
- Evaluate compatibility and migration impact

---

## 4) Anti-Patterns

- Keeping normative changes only in patch docs and never updating living SPECs.
- Accumulating patch chains that increase reading complexity.
- Closing ADRs without reflecting implementation/test/index updates.
- Omitting required cross-links between ADR/FDR/SPEC.

---

## 5) Completion Checklist

- [ ] ADR status is Accepted or Implemented
- [ ] Target SPECs are updated as living docs
- [ ] SPEC `Changelog` includes the change
- [ ] ADR includes evidence links (docs/tests)
- [ ] Temporary documents were moved to archive
- [ ] Relevant links are wired to `docs/internals/index.md`

---

*End of Template*
