# Governance

<!-- INSTRUCTION:
OSS에서 의외로 중요한 문서입니다.
"어떤 변경이 어떻게 결정되는가"를 명확히 합니다.
-->

> **Status:** Active  
> **Last Updated:** [DATE]

---

## Overview

This document describes how decisions are made in the [PROJECT_NAME] project, including:
- What constitutes a breaking change
- How specifications (SPEC) and design documents (FDR) are modified
- The RFC process for significant changes
- Versioning policy

---

## Decision-Making Principles

<!-- INSTRUCTION:
프로젝트의 의사결정 원칙.
-->

1. **[Principle 1]**: [Description]
2. **[Principle 2]**: [Description]
3. **[Principle 3]**: [Description]

---

## What is a Breaking Change?

<!-- INSTRUCTION:
매우 중요합니다.
사용자들이 "이게 breaking인지 아닌지" 명확히 알 수 있어야 합니다.
-->

### Definitely Breaking (Major Version Bump)

| Category | Examples |
|----------|----------|
| **Type changes** | Removing a field, changing a type, renaming exports |
| **Behavioral changes** | Changing return values, altering invariants |
| **Contract changes** | Modifying MUST requirements in SPEC |

### Not Breaking (Minor/Patch)

| Category | Examples |
|----------|----------|
| **Additions** | New optional fields, new exports, new features |
| **Bug fixes** | Correcting behavior to match SPEC |
| **Documentation** | Clarifications that don't change behavior |

### Gray Areas (Case-by-Case)

| Situation | Decision Process |
|-----------|------------------|
| Fixing a bug that people depend on | RFC required |
| Deprecation (not removal) | Minor version, with warning |
| Performance changes | Not breaking unless SLA exists |

---

## Versioning Policy

<!-- INSTRUCTION:
SemVer 기반이지만, SPEC 버전과의 관계를 명확히.
-->

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
- Package `@[org]/core@2.3.4` implements `Core SPEC v1.2`
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

<!-- INSTRUCTION:
중요한 변경은 RFC(Request for Comments)를 통해.
-->

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
| SPEC changes | [Core maintainers / BDFL / Committee] |
| FDR additions | [Same] |
| New packages | [Same] |
| Breaking changes | [Same] |

---

## SPEC Modification Rules

<!-- INSTRUCTION:
SPEC 문서 변경에 대한 특별 규칙.
-->

### Normative vs Non-Normative

| Section Type | Can Change Without RFC? |
|--------------|------------------------|
| Normative (MUST/MUST NOT) | ❌ Never |
| Normative (SHOULD) | ⚠️ Rarely, with justification |
| Non-normative (examples) | ✅ Yes |
| Appendix | ✅ Yes |

### Version Bumping

| Change | SPEC Version |
|--------|--------------|
| New MUST requirement | Major bump |
| New SHOULD recommendation | Minor bump |
| Clarification (no behavior change) | Patch bump |
| Example updates | No bump |

---

## FDR Modification Rules

<!-- INSTRUCTION:
FDR 문서는 "역사 기록"이므로 특별한 규칙이 필요.
-->

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

<!-- INSTRUCTION:
누가 결정권을 가지고 있는지.
-->

| Role | Person | Responsibilities |
|------|--------|------------------|
| [BDFL / Lead] | [@handle](github) | Final decision on RFCs |
| Core Maintainer | [@handle](github) | Review PRs, approve minor changes |
| Core Maintainer | [@handle](github) | Review PRs, approve minor changes |

---

## Code of Conduct

All participants in this project are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Questions?

If you're unsure whether your change needs an RFC or have questions about this process, please:
1. Open a [Discussion](link)
2. Ask in [Discord/Slack](link)

---

*End of Governance Document*
