# Documentation Governance (ADR/FDR/SPEC Operating Rules)

> **Purpose:** Reduce branching and inconsistency when reading docs, and separate decision history from current normative rules.

This guide defines core documentation operations for Manifesto. These rules align with the ADR-007 to ADR-011 process.

---

## 1. Single Source Principle

### 1-1. SPEC = Canonical Current Normative Source

- For each layer/package, the `-SPEC` must be the canonical normative source.
- Normative interpretation must not require navigating patch chains (e.g., `-patch.md` sequences).
- Update the living SPEC immediately and append a `Changelog` entry whenever rules change.
- After a hard cut, maintained docs should describe only the current canonical surface.
- Historical documents stay historical by index and label, not by being mixed into active prose.

### 1-2. ADR = Immutable Record of Decisions

- ADR records why a decision was made and what it changes.
- When implementation is complete, mark ADR as `Implemented` and reference the SPEC/section updated.
- ADRs preserve historical decision traceability; operational effectiveness belongs in SPEC.

### 1-3. FDR = Rationale Layer

- FDRs capture motivation and reasoning.
- For Core/Host/World, keep key rationale inline in SPEC `Rationale` blocks whenever possible.
- Standalone FDR files are for supplemental, academic, or historical context.

### 1-4. Reading Order

- Prefer maintained docs first: README, package landing pages, API docs, concept docs, and current package indexes.
- Use historical ADR/SPEC/FDR material only after the current surface is understood.
- Do not use archive documents to infer current public APIs or canonical import paths.

---

## 2. Document Lifecycle

### ADR Status Transitions

`Proposed -> Accepted -> Implemented`  
Other statuses: `Deprecated`, `Superseded`, `Withdrawn`

- **Accepted:** Decision approved; implementation may not yet be complete.
- **Implemented:** Implemented and validated in normative documentation.
- **Superseded:** Replaced by a newer ADR.

### Spec Adoption Process

1. Create and approve ADR.
2. Apply updates directly to the target living SPEC.
3. Update `Changelog` and indexes.
4. Align FDR inline updates where required.
5. Move temporary docs to `archive/`.
6. Mark ADR as `Implemented`.

---

## 3. Mandatory Operating Rules

### Rule A: Patch-Document Responsibility
- Use `*-patch.md` docs only for operational patch work or historical archival.
- Normative contracts (authority, failure handling, snapshot semantics) must always be readable from SPEC text.

### Rule B: Cross-Link Requirement
- ADRs must link to related SPECs, tests, or FDRs.
- SPECs should include references for constraints, exceptions, and migration guidance.
- `docs/internals/spec/index.md` and `docs/internals/adr/index.md` must stay synchronized for status/version updates.

### Rule C: Version Tracking
- Update package version indexes (e.g., `packages/*/docs/VERSION-INDEX.md`) when SPEC versions change.
- Track history via SPEC `Changelog` and Git history.

---

## 4. PR Documentation Checklist

- [ ] ADR status is updated correctly
- [ ] SPEC body reflects changes in living docs with immediate readability
- [ ] SPEC `Changelog` updated
- [ ] ADR/SPEC/FDR links are consistent
- [ ] Working drafts and temporary notes are archived

---

## 5. Guardrail Recommendations (Automation)

Recommended short-term automated guardrails:

1. Label-based documentation gate: enforce ADR/SPEC link checks when docs are modified.
2. ADR/index consistency check script (status missing, broken links).
3. Consistency check between `docs/internals/spec/index.md` and `docs/internals/adr/index.md` during documentation build.

---

*End of Document*
