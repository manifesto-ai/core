# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Projection module for AI Agent context (`@manifesto-ai/core`)
- Comprehensive example projects in `/examples` directory

---

## [0.3.0] - 2024-12-24

### @manifesto-ai/core

#### Added
- **Projection System**: AI-optimized state projections for agent context
  - `createProjection()` function for state slicing
  - `ProjectionSpec` type definitions
- **Agent Module**: Types and interfaces for AI decision loops
  - `AgentContext`, `AgentDecision`, `ActionIntent` types
  - Agent runtime integration utilities
- **TaskFlow**: Async task orchestration with dependency resolution
- **ViewSnapshot**: Immutable snapshot creation for UI rendering
- `defineDerived()` helper for derived path definitions
- Schema validation with Zod integration

#### Changed
- Effect handlers now return `Result<void, HandlerError>` for better error handling
- Async path convention unified (`.result`, `.loading`, `.error` suffixes)
- DAG propagation optimized with batch updates
- Runtime subscription system refactored for better performance

#### Fixed
- Race condition in async effect execution
- Memory leak in subscription cleanup
- Deterministic ordering of derived value computation

### @manifesto-ai/compiler (New Package)

#### Added
- **Pass System**: 7-pass compilation pipeline
  - `SchemaPass`: TypeScript interface extraction
  - `DerivedPass`: Computed value detection
  - `ActionPass`: Action handler extraction
  - `AsyncPass`: Async operation detection
  - `PolicyPass`: Validation rule extraction
  - `MetadataPass`: Semantic metadata extraction
  - `FragmentPass`: Final fragment assembly
- **Linker**: Fragment linking with conflict detection
  - Multi-artifact fragment merging
  - `DuplicatePath`, `TypeMismatch`, `SemanticConflict` detection
- **Verifier**: Domain validation with Core integration
  - `useCoreValidation` option for `validateDomain()` integration
  - Issue aggregation with severity levels
- **LLM Adapters**: Production-ready AI integrations
  - `createAnthropicAdapter()` with Claude API support
  - `createOpenAIAdapter()` with GPT-4 support
  - Rate limiting, retry logic, timeout handling
- **Session**: Compilation session management with observability
- **Patch System**: Fragment-level update generation

### @manifesto-ai/bridge-react (New Package)

#### Added
- **BridgeProvider**: React context provider for runtime integration
- **React Hooks**:
  - `useManifestoValue()`: Subscribe to path values
  - `useManifestoAction()`: Dispatch domain actions
  - `useManifestoDerived()`: Access derived values
  - `useManifestoState()`: Read/write state paths
  - `useManifestoEffect()`: Trigger effects
  - `useManifestoSelector()`: Custom state selection
  - `useManifestoSubscription()`: Low-level subscription
  - `useManifestoSnapshot()`: Full state snapshot

---

## [0.2.0] - 2024-11-15

### @manifesto-ai/core

#### Added
- ViewSnapshot functionality for UI state capture
- Enhanced DAG propagation with topological sorting
- Expression DSL improvements

#### Changed
- Updated runtime architecture for better composability

---

## [0.1.0] - 2024-10-01

### @manifesto-ai/core

#### Added
- Initial release of Manifesto Core
- **Domain Definition**: `defineDomain()` function
- **Semantic Path System**: Type-safe path addressing
- **Expression DSL**: S-expression based computations
- **Effect System**: Monadic side-effect handling
- **DAG Propagation**: Automatic dependency tracking
- **Runtime**: Reactive state management
- **Policy System**: Validation and business rules

---

## Migration Guides

- [Migrating to v0.3.0](./docs/MIGRATION-v0.3.md)

## Links

- [Documentation](./docs/)
- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api/)
