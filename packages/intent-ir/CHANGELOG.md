# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v0.2.0
- `in` operator for membership testing
- `ListTerm` type for array/set values
- OR/NOT conditions (boolean logic extension)
- Multi-value per Role support

## [0.1.0] - 2025-01-12

### Added

#### Schema (SPEC §6-10)
- **Functional Heads**: Force, EventClass, Role, Modality, TimeKind, VerifyMode, OutputType, OutputFormat enumerations
- **Event Schema**: lemma (uppercase ASCII) + EventClass validation
- **Term Types**: 5-type discriminated union
  - `EntityRefTerm`: Domain entity references with discourse resolution
  - `PathRefTerm`: Semantic path references
  - `ArtifactRefTerm`: Document/code/data artifact references
  - `ValueTerm`: Typed literals with semantic shape
  - `ExprTerm`: Mathematical/logical expressions (LaTeX, AST, code)
- **Predicate System**: Scoped LHS paths with 9 comparison operators
- **Auxiliary Specs**: TimeSpec, VerifySpec, OutputSpec
- **Cross-field Validation**: Zod refinements for conditional requirements

#### Canonicalization (SPEC §11)
- **Semantic Mode** (`canonicalizeSemantic`): Removes `ValueTerm.raw` for similarity search
- **Strict Mode** (`canonicalizeStrict`): Normalizes `ValueTerm.raw` for exact caching
- **RFC 8785 JCS**: JSON Canonicalization Scheme compliance
- **Idempotency**: `canonicalize(canonicalize(ir)) === canonicalize(ir)`
- **Order Invariance**: Predicate order doesn't affect canonical form

#### Key System (SPEC §12)
- **intentKey**: SHA-256 from IntentBody + schemaHash (protocol identity)
- **strictKey**: SHA-256 from ResolvedIntentIR + footprint + context (reproduction cache)
- **simKey**: 64-bit SimHash for similarity search
- **simhashDistance**: Hamming distance for similarity comparison

#### Lexicon & Feature Checking (SPEC §14)
- **Lexicon Interface**: Event/entity resolution
- **createLexicon Factory**: Build Lexicon from configuration
- **checkFeatures Algorithm**:
  - Lemma existence check
  - EventClass consistency check
  - Required role validation
  - Term kind restrictions
  - Entity type validation
  - Policy hints (destructive → requiresConfirm)
- **Error-as-Value Pattern**: CheckResult discriminated union

#### Lowering (SPEC §13)
- **lower Function**: IntentIR → IntentBody transformation
- **Reference Resolution**: Integration with Resolver
- **Condition Mapping**: `cond` → `input.filter`
- **Scope Proposal**: Optional write-boundary derivation

#### Resolver (SPEC §8.2)
- **createResolver Factory**: Default resolver implementation
- **Discourse Reference Resolution**:
  - `this` → focus entity
  - `that` → most recent non-focus
  - `last` → most recent of same type
  - `id` → pass-through
  - absent `ref` → collection scope (preserved)
- **Deterministic**: No LLM involvement

#### Public API
- Comprehensive barrel exports from `index.ts`
- Type exports for all schemas and interfaces

### Technical Details
- **Dependencies**: `@manifesto-ai/core` (sha256, toJcs)
- **Peer Dependencies**: `zod ^4.3.5`
- **Test Coverage**: 69 tests across 6 test files
- **SPEC Compliance**: ~98% adherence to SPEC-0.1.0v

---

## Version Policy

This package follows [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes, documentation | PATCH | 0.1.0 → 0.1.1 |
| New optional features | MINOR | 0.1.x → 0.2.0 |
| Breaking changes, new enum values | MAJOR | 0.x.y → 1.0.0 |

**Important**: Adding new values to any enum (Force, EventClass, Role, etc.) is a **BREAKING** change requiring a MAJOR version bump, as it breaks exhaustive pattern matching in consumers.

---

## Wire Version vs Package Version

| Version Type | Format | Purpose |
|--------------|--------|---------|
| Wire version (`v` field) | `"0.1"` | Runtime compatibility check |
| Package version | `"0.1.0"` | npm/pnpm versioning |

Wire version changes only on MAJOR or MINOR changes. Package PATCH versions are for documentation and bug fixes only.
