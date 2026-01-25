# Internals

> For contributors, implementers, and deep-dive readers.

This section contains detailed technical documentation for those who want to understand or contribute to Manifesto's implementation.

## Architecture

- [Architecture Overview](./architecture) - Layer structure and boundaries (v2.0)
- [Glossary](./glossary) - Term definitions

## Architecture Decision Records (ADRs)

Records of significant architectural decisions:

| ID | Title | Status |
|----|-------|--------|
| [ADR-001](./adr/001-layer-separation) | Layer Separation after Host v2.0.1 | Accepted |

## Specifications

Formal specifications for each package:

| Package | Specification |
|---------|--------------|
| App | [app-spec](./spec/app-spec) |
| Core | [core-spec](./spec/core-spec) |
| Host | [host-spec](./spec/host-spec) |
| World | [world-spec](./spec/world-spec) |
| Builder | [builder-spec](./spec/builder-spec) |
| Compiler | [compiler-spec](./spec/compiler-spec) |
| Intent IR | [intent-ir-spec](./spec/intent-ir-spec) |

## Design Rationale (FDRs)

Foundational Design Records explaining the "why" behind decisions:

| Package | FDR |
|---------|-----|
| App | [app-fdr](./fdr/app-fdr) |
| Core | [core-fdr](./fdr/core-fdr) |
| Host | [host-fdr](./fdr/host-fdr) |
| World | [world-fdr](./fdr/world-fdr) |
| Builder | [builder-fdr](./fdr/builder-fdr) |
| Compiler | [compiler-fdr](./fdr/compiler-fdr) |
| Intent IR | [intent-ir-fdr](./fdr/intent-ir-fdr) |

## Contributing

See the [Contributing Guide](https://github.com/manifesto-ai/core/blob/main/CONTRIBUTING.md) for how to contribute to Manifesto.
