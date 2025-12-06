# Changelog

All notable changes to the Manifesto project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive English documentation
- Architecture and philosophy documentation
- Schema reference documentation (Entity, View, Action, Expression, Reaction)
- API reference documentation for engine, React, and Vue packages
- Guide documentation for common patterns

---

## [0.0.1] - 2024

Initial development release.

### Added

#### Core Architecture
- **3-Layer Schema System**: Entity, View, and Action schemas for complete form modeling
- **Expression DSL**: Mapbox-style array-based expressions for safe, serializable logic
- **Reaction DSL**: Declarative event-driven field interactions

#### @manifesto-ai/schema Package
- `EntitySchema` type with support for all data types (string, number, boolean, date, enum, reference, array, object)
- `ViewSchema` type with 17 component types and flexible layouts
- `ActionSchema` type for multi-step workflows
- Builder APIs (`field`, `viewField`, `on`, `actions`, `api`, `transform`)
- Type-safe schema construction with TypeScript

#### @manifesto-ai/engine Package
- `FormRuntime` for managing form state and lifecycle
- `ExpressionEvaluator` for safe expression evaluation (no `eval()`)
- `DependencyTracker` for optimized re-evaluation using DAG
- `SchemaLoader` for loading and validating schemas
- `LegacyAdapter` for integrating with legacy APIs
- Result monad pattern for error handling

#### @manifesto-ai/react Package
- `FormRenderer` component for rendering view schemas
- `useFormRuntime` hook for state management
- Field components for all 17 input types
- `DebugPanel` component for development
- Tailwind CSS styling

#### @manifesto-ai/vue Package
- `FormRenderer` component for Vue 3
- `useFormRuntime` composable
- Field components for all input types
- Vue-specific event handling and styling

#### @manifesto-ai/example-schemas Package
- Contact form example
- Product form example
- Cascade select example
- Validation patterns example

#### Development Tools
- Storybook integration for React and Vue
- Monorepo structure with pnpm workspaces
- Turbo for build orchestration
- Vitest for testing
- TypeScript strict mode

### Architecture Highlights
- **Framework Agnostic Engine**: Core logic independent of UI framework
- **Semantic UI Layer**: Abstract component types (textInput, select, etc.) mapped to framework components
- **AI-Native Design**: Schemas designed for AI generation and manipulation
- **Safe Expressions**: No runtime code evaluation, fully serializable
- **Dependency Tracking**: Automatic optimization of reactive updates

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.0.1 | 2024 | Initial development release |

---

## Upgrade Guide

### From Previous Versions

This is the initial release. No upgrade path required.

### Future Upgrades

When upgrading between versions:

1. Check the changelog for breaking changes
2. Update all `@manifesto-ai/*` packages together
3. Run `pnpm install` to update dependencies
4. Check for deprecated APIs and migrate
5. Run tests to verify functionality

---

## Deprecation Policy

- Deprecated features are marked with `@deprecated` JSDoc tags
- Deprecated features remain functional for at least one minor version
- Breaking changes are documented in the changelog
- Migration guides are provided for major changes

---

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.

### For Contributors

1. Make your changes
2. Run `pnpm changeset` to create a changeset
3. Select the packages affected
4. Choose version bump type (patch/minor/major)
5. Write a summary of changes
6. Commit the changeset file with your PR

### For Maintainers

1. Review and merge PRs with changesets
2. Run `pnpm changeset version` to update versions
3. Review generated changelog entries
4. Commit version changes
5. Run `pnpm changeset publish` to publish

---

## Links

- [Documentation](./docs/README.md)
- [Getting Started](./docs/getting-started.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [GitHub Repository](https://github.com/anthropics/manifesto-ai)

---

[Unreleased]: https://github.com/anthropics/manifesto-ai/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/anthropics/manifesto-ai/releases/tag/v0.0.1
