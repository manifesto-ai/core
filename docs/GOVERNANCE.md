# Governance

> **Status:** Active
> **Last Updated:** 2025-12

---

## Overview

This document describes how decisions are made in the Manifesto project, including:
- What constitutes a breaking change
- How specifications (SPEC) and design documents (FDR) are modified
- The RFC process for significant changes
- Versioning policy

---

## Decision-Making Principles

1. **Stability over features**: We prefer a stable, well-documented core over rapid feature additions
2. **Determinism is sacred**: Any change that affects computation determinism requires an RFC
3. **Backwards compatibility**: Breaking changes require major version bumps and migration guides
4. **Documentation first**: Significant changes require updated documentation before merge

---

## What is a Breaking Change?

### Definitely Breaking (Major Version Bump)

| Category | Examples |
|----------|----------|
| **Type changes** | Removing a field, changing a type, renaming exports |
| **Behavioral changes** | Changing return values, altering invariants |
| **Contract changes** | Modifying MUST requirements in SPEC |
| **Computation changes** | Any change that makes Core produce different output for same input |

### Not Breaking (Minor/Patch)

| Category | Examples |
|----------|----------|
| **Additions** | New optional fields, new exports, new features |
| **Bug fixes** | Correcting behavior to match SPEC |
| **Documentation** | Clarifications that don't change behavior |
| **Performance** | Optimizations that don't change output |

### Gray Areas (Case-by-Case)

| Situation | Decision Process |
|-----------|------------------|
| Fixing a bug that people depend on | RFC required |
| Deprecation (not removal) | Minor version, with warning |
| Performance changes | Not breaking unless SLA exists |
| Error message changes | Generally not breaking |

---

## Versioning Policy

### Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes
MINOR: New features, backward compatible
PATCH: Bug fixes, backward compatible
```

### Specification Versioning

SPEC documents have their own version, independent of package versions:

| SPEC Version | Meaning |
|--------------|---------|
| `1.0` | Stable, normative |
| `1.1` | Backward-compatible additions |
| `2.0` | Breaking changes from `1.x` |

**Relationship:**
- Package `@manifesto-ai/core@2.3.4` implements `Core SPEC v1.2`
- Multiple package versions may implement the same SPEC version

---

## Change Processes

### Trivial Changes (No Process)

- Typo fixes
- Documentation clarifications
- Code style improvements
- Test additions

**Process:** Direct PR → Review → Merge

### Standard Changes (Normal PR)

- Bug fixes
- New features within existing SPEC
- Performance improvements
- Dependency updates

**Process:**
1. Open issue (optional but recommended)
2. Submit PR with description
3. Review by maintainer(s)
4. Merge

### Significant Changes (RFC Required)

- New SPEC requirements
- Changes to existing SPEC
- New FDR entries
- Architectural changes
- Breaking changes

**Process:** See [RFC Process](#rfc-process) below.

---

## RFC Process

### When is an RFC Required?

- Any change to a SPEC document
- Any new FDR entry
- Any breaking change
- Any new package
- Any architectural change

### RFC Template

```markdown
# RFC: [Title]

## Summary
One paragraph explanation of the proposal.

## Motivation
Why are we doing this? What problem does it solve?

## Detailed Design
Technical details of the proposal.

## Alternatives Considered
What other approaches were considered and why were they rejected?

## Migration Path
How do existing users migrate? Is it breaking?

## Unresolved Questions
What aspects are still unclear?
```

### RFC Lifecycle

```
Draft → Proposed → Discussing → Accepted/Rejected → Implemented
                      │
                      └──→ Deferred
```

| Stage | Duration | Exit Criteria |
|-------|----------|---------------|
| Draft | Unlimited | Author marks ready |
| Proposed | 3 days minimum | Discussion opened |
| Discussing | 7-14 days | Consensus or decision |
| Accepted | - | Implementation PR opened |

### Who Decides?

| Change Type | Decision Maker |
|-------------|----------------|
| SPEC changes | Core maintainers |
| FDR additions | Core maintainers |
| New packages | Core maintainers |
| Breaking changes | Core maintainers |

---

## SPEC Modification Rules

### Normative vs Non-Normative

| Section Type | Can Change Without RFC? |
|--------------|------------------------|
| Normative (MUST/MUST NOT) | No |
| Normative (SHOULD) | Rarely, with justification |
| Non-normative (examples) | Yes |
| Appendix | Yes |

### Version Bumping

| Change | SPEC Version |
|--------|--------------|
| New MUST requirement | Major bump |
| New SHOULD recommendation | Minor bump |
| Clarification (no behavior change) | Patch bump |
| Example updates | No bump |

---

## FDR Modification Rules

### Core Principle

**FDR entries are historical records.** They document *why* decisions were made *at the time they were made*.

### What CAN be Changed

- Typos and grammar
- Formatting
- Adding cross-references
- Clarifying ambiguous wording (without changing meaning)

### What CANNOT be Changed

- The decision itself
- The rationale
- The alternatives rejected
- The consequences stated

### If a Decision Changes

**Do NOT modify the existing FDR.** Instead:

1. Create a new FDR entry (e.g., `FDR-042`)
2. Mark the old FDR as `Superseded by FDR-042`
3. Document why the decision changed

---

## Maintainers

| Role | Person | Responsibilities |
|------|--------|------------------|
| Lead | [@maintainer](https://github.com/maintainer) | Final decision on RFCs |
| Core Maintainer | [@contributor](https://github.com/contributor) | Review PRs, approve changes |

---

## Code of Conduct

All participants in this project are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Questions?

If you're unsure whether your change needs an RFC or have questions about this process, please:
1. Open a [Discussion](https://github.com/manifesto-ai/core/discussions)
2. Ask in the issue tracker

---

*End of Governance Document*
