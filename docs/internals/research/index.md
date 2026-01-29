# Research Documentation

This section contains research-oriented documentation for Manifesto components, intended for academic researchers, computational linguists, and formal methods practitioners.

## Available Research Documents

### Intent IR

The Intent IR package has comprehensive research documentation covering theoretical foundations, comparative analysis with related formalisms, and formal definitions with proofs.

<div class="tip custom-block" style="padding-top: 8px">

**[Intent IR Research](/internals/research/intent-ir/)** - Theoretical foundations, comparative analysis, and formal specifications for the Intent Intermediate Representation.

</div>

## Document Types

Research documentation is organized into three categories:

| Document Type | Purpose | Audience |
|---------------|---------|----------|
| **Theory** | Theoretical foundations and linguistic basis | Linguists, NLP researchers |
| **Comparison** | Analysis against related formalisms | Semantic representation researchers |
| **Formal** | Mathematical definitions and proofs | Type theorists, verification engineers |

## Normative Hierarchy

Research documents are **INFORMATIVE** and supplement the normative specifications:

```
SPEC (Normative - highest authority)
  ↓
FDR (Normative - design rationale)
  ↓
Research (Informative - academic depth)
  ↓
README (Informative - quick reference)
```

When research documents and SPEC documents conflict, SPEC takes precedence.

## Contributing

Research documentation follows academic standards:
- BibTeX citations via `BIBLIOGRAPHY.bib`
- RFC 2119 keywords where applicable
- Cross-references to normative SPEC sections
- Peer-reviewable formal proofs
