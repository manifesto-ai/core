# Contributing to the Manifesto Core Specification

Thank you for your interest in contributing to the Manifesto Core Specification. This document outlines the process for proposing changes and the guidelines for contributions.

---

## Types of Contributions

### Editorial Changes

Editorial changes improve clarity, fix typos, or correct formatting without changing the meaning of the specification. Examples include:

- Fixing spelling or grammatical errors
- Improving sentence structure for clarity
- Fixing broken links or cross-references
- Updating formatting for consistency

Editorial changes can be submitted directly as pull requests.

### Substantive Changes

Substantive changes modify the normative requirements of the specification. Examples include:

- Adding new features or types
- Modifying existing algorithms
- Changing validation rules
- Adding new conformance requirements

Substantive changes require an RFC (Request for Comments) process.

---

## RFC Process

### Step 1: Open an Issue

Before writing an RFC, open an issue to discuss the proposal:

1. Describe the problem or use case
2. Outline your proposed solution
3. Discuss with maintainers and community

### Step 2: Write the RFC

If the discussion is positive, write a formal RFC:

```markdown
# RFC: [Title]

## Summary

Brief description of the proposal.

## Motivation

Why is this change needed? What problem does it solve?

## Detailed Design

Technical details of the proposal:
- New types or grammar
- Algorithm changes
- Example usage

## Backward Compatibility

How does this affect existing implementations?
- Breaking changes
- Migration path

## Alternatives Considered

Other approaches that were considered and why they were rejected.

## Open Questions

Unresolved issues that need community input.
```

### Step 3: Review Period

RFCs undergo a review period:

- **Minor changes**: 2 weeks
- **Major changes**: 4 weeks
- **Breaking changes**: 8 weeks

### Step 4: Final Comment Period

After initial review, enter Final Comment Period (FCP):

- Duration: 1 week
- Last chance for objections
- Requires maintainer approval

### Step 5: Merge or Close

Based on feedback:
- **Approved**: RFC is merged and implementation begins
- **Rejected**: RFC is closed with explanation
- **Deferred**: RFC is kept open for future consideration

---

## Style Guidelines

### Writing Style

1. **Be precise**: Use exact terminology
2. **Be concise**: Avoid unnecessary words
3. **Be consistent**: Follow existing patterns
4. **Be normative**: Use RFC 2119 keywords correctly

### RFC 2119 Keywords

Use these keywords for normative statements:

- **MUST**: Absolute requirement
- **MUST NOT**: Absolute prohibition
- **SHOULD**: Recommendation
- **SHOULD NOT**: Not recommended
- **MAY**: Optional

### Formatting

1. Use GitHub-flavored Markdown
2. One sentence per line (for better diffs)
3. Use code blocks with language hints
4. Number examples consistently

### Grammar Notation

Follow the established BNF-like notation:

```
RuleName : Definition

Definition : Alternative1 | Alternative2

Sequence : Part1 Part2

Optional : Part?

OneOrMore : Part+

ZeroOrMore : Part*
```

### Algorithm Notation

Follow the established algorithm format:

```
AlgorithmName(param1, param2):
1. Let {variable} be {value}.
2. If {condition}:
   a. {action}
3. Return {result}.
```

---

## Pull Request Guidelines

### Before Submitting

1. Read this contributing guide
2. Check existing issues and PRs
3. For substantive changes, complete RFC process
4. Run local validation if available

### PR Description

Include:

1. **Summary**: What does this change do?
2. **Motivation**: Why is this change needed?
3. **Type**: Editorial or Substantive
4. **RFC**: Link to RFC (if applicable)
5. **Checklist**:
   - [ ] Grammar is valid
   - [ ] Examples are correct
   - [ ] Cross-references are updated
   - [ ] Appendix B is updated (if grammar changed)

### Review Process

1. Maintainer assigns reviewers
2. Address feedback promptly
3. Squash commits if requested
4. Maintain single focus per PR

---

## Governance

### Maintainers

Maintainers have final authority on specification changes. Current maintainers are listed in the repository.

### Decision Making

- **Consensus**: Preferred for all decisions
- **Voting**: Used when consensus cannot be reached
- **Maintainer Override**: Rare, documented cases only

### Versioning

The specification follows semantic versioning:

- **Major**: Breaking changes to normative requirements
- **Minor**: New features, backward compatible
- **Patch**: Editorial changes, clarifications

---

## Community Guidelines

### Code of Conduct

Be respectful, constructive, and professional. We follow standard open source community guidelines.

### Communication

- **Issues**: For bugs, feature requests, discussions
- **Pull Requests**: For proposed changes
- **Discussions**: For general questions

### Response Times

Maintainers aim to respond within:

- **Issues**: 1 week
- **Pull Requests**: 2 weeks
- **RFC Reviews**: During review period

---

## Implementation Notes

### Reference Implementation

The reference implementation is available at:
- `packages/core` - TypeScript implementation

Changes to the specification SHOULD be accompanied by corresponding changes to the reference implementation.

### Conformance Tests

When adding new features:
1. Add test cases to the conformance test suite
2. Document expected behavior
3. Provide both valid and invalid examples

---

## Getting Help

If you have questions:

1. Check existing documentation
2. Search closed issues
3. Open a new discussion
4. Reach out to maintainers

We appreciate all contributions, from typo fixes to major feature proposals!
