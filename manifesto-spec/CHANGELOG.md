# Changelog

All notable changes to the Manifesto Core Specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this specification adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Appendix C -- Conformance Checklist for implementation verification
- Section 4.10.1: ApiRequest type definition for API call effects
- Section 4.11.3: Builder function defaults documentation
- Section 5.19: EvalResult type and evaluate function signature
- Section 7.5.5: Async result path handling specification
- Section 7.5.6: Pending effects execution order specification
- Section 7.8.8: ChangedPaths scope clarification
- Section 7.11.4: ExplanationTree cycle prevention algorithm

### Changed
- Section 7.8: Updated PathListener signature to match implementation
- Section 7.9: Updated PreconditionStatus structure to match implementation
- Section 7.10: Updated ResolvedFieldPolicy structure to match implementation

---

## [1.0.0] - 2024-12-13

### Added

**Core Specification Documents:**
- Section 1 -- Overview: Design principles and architecture
- Section 2 -- Snapshot: DomainSnapshot type and operations
- Section 3 -- Semantic Path: Path grammar and domain types
- Section 4 -- Effect: 10 effect types with execution semantics
- Section 5 -- Expression: Complete expression DSL (50+ operators)
- Section 6 -- Validation: Validation rules and error codes
- Section 7 -- Execution: DAG propagation and runtime behavior

**Appendices:**
- Appendix A -- Notation Conventions: RFC 2119 keywords, algorithm notation
- Appendix B -- Grammar Summary: Complete BNF-like grammar reference

**Supporting Documents:**
- README.md: Entry point with conformance levels
- CONTRIBUTING.md: RFC process for specification changes

### Conformance Levels

Three conformance levels defined:

1. **Level 1 (Core)**: DomainSnapshot, SemanticPath, basic expressions, core effects
2. **Level 2 (Standard)**: Full expression DSL, all effect types, DAG propagation
3. **Level 3 (Full)**: Subscription system, field policies, AI support features

---

## Versioning Policy

### Major Version (X.0.0)
- Breaking changes to normative requirements
- Removal of required features
- Changes that make existing compliant implementations non-compliant

### Minor Version (0.X.0)
- New features added in a backward-compatible manner
- New optional effect types or expression operators
- New conformance level requirements (optional for existing levels)

### Patch Version (0.0.X)
- Editorial changes and clarifications
- Typo fixes
- Example corrections
- Cross-reference updates

---

## Migration Guides

### Future Migrations

Migration guides will be added here when breaking changes are introduced in future versions.

---

## Deprecation Policy

Features marked as deprecated:

1. Will remain functional for at least one major version
2. Will emit warnings when used
3. Will include migration guidance to replacement features
4. Will be removed in the next major version after deprecation

Currently, no features are deprecated.
