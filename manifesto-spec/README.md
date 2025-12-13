# Manifesto Core Specification

**Status**: Working Draft
**Version**: 1.0.0
**Last Updated**: December 2024

---

## Introduction

This specification defines **Manifesto Core**, a semantic state protocol for AI-native applications. Manifesto enables AI agents to interact with application state through semantic addressing, declarative expressions, and explicit effects.

This specification is intended for library implementers who wish to create conforming implementations across different platforms and programming languages.

---

## Table of Contents

### Core Specification

1. [Section 1 -- Overview](./spec/Section%201%20--%20Overview.md)
2. [Section 2 -- Snapshot](./spec/Section%202%20--%20Snapshot.md)
3. [Section 3 -- Semantic Path](./spec/Section%203%20--%20Semantic%20Path.md)
4. [Section 4 -- Effect](./spec/Section%204%20--%20Effect.md)
5. [Section 5 -- Expression](./spec/Section%205%20--%20Expression.md)
6. [Section 6 -- Validation](./spec/Section%206%20--%20Validation.md)
7. [Section 7 -- Execution](./spec/Section%207%20--%20Execution.md)

### Appendices

- [Appendix A -- Notation Conventions](./Appendix%20A%20--%20Notation%20Conventions.md)
- [Appendix B -- Grammar Summary](./Appendix%20B%20--%20Grammar%20Summary.md)
- [Appendix C -- Conformance Checklist](./Appendix%20C%20--%20Conformance%20Checklist.md)

### Contributing & History

- [Contributing Guide](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

---

## Conformance

A conforming implementation of Manifesto Core MUST fulfill all normative requirements. Normative requirements are indicated using RFC 2119 keywords: **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL**.

Sections marked as *Non-normative* are provided for explanatory purposes and do not impose implementation requirements.

### Conformance Levels

Manifesto Core defines three conformance levels. An implementation MAY claim conformance at any level by satisfying all requirements of that level and all lower levels.

#### Level 1: Core Conformance

A Level 1 conforming implementation:

- MUST implement the `DomainSnapshot` structure as defined in Section 2
- MUST implement `SemanticPath` resolution as defined in Section 3
- MUST implement basic Expression evaluation (literals, `get`, comparison, and logical operators)
- MUST implement `SetValueEffect` and `SetStateEffect`

#### Level 2: Standard Conformance

A Level 2 conforming implementation:

- MUST satisfy all Level 1 requirements
- MUST implement all ten Effect types as defined in Section 4
- MUST implement the complete Expression DSL as defined in Section 5
- MUST implement DAG-based propagation as defined in Section 7
- MUST implement validation as defined in Section 6

#### Level 3: Full Conformance

A Level 3 conforming implementation:

- MUST satisfy all Level 2 requirements
- MUST implement the subscription system
- MUST implement AI support features (`explain`, `getImpact`)
- MUST implement Field Policy evaluation

---

## Versioning

This specification follows [Semantic Versioning](https://semver.org/):

- **Major** version changes indicate breaking changes to normative requirements
- **Minor** version changes indicate new features that are backwards-compatible
- **Patch** version changes indicate clarifications or editorial corrections

---

## License

This specification is licensed under the MIT License.

---

## Acknowledgments

This specification draws inspiration from:

- [GraphQL Specification](https://spec.graphql.org/)
- [JSON Schema](https://json-schema.org/)
- [MapGL Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/)
