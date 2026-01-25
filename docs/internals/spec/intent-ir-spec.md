# Intent IR Specification

> **Version:** 0.1.0
> **Status:** Stable

## Overview

Intent IR is a Chomskyan LF (Logical Form) based Intermediate Representation for natural language intent. It provides deterministic semantic structures that bridge human language to executable domain actions.

## Core Axioms

1. **Structure is meaning** — Not strings, not tokens, but formal structure
2. **Lexicon is the arbiter** — Validity determined by feature checking
3. **Same meaning, same form** — Canonicalization ensures semantic equivalence
4. **IR is intent, not plan** — Execution is downstream concern
5. **Functional heads are finite** — Enumerated, never open-ended

## Functional Head Hierarchy

```
ForceP ─── Illocutionary force
   │       ASK | DO | VERIFY | CONFIRM | CLARIFY
   │
ModP ──── Modality
   │       MUST | SHOULD | MAY | FORBID
   │
TP ────── Temporal specification
   │       NOW | AT | BEFORE | AFTER | WITHIN
   │
EventP ── Event/operation type
   │       { lemma: string, class: EventClass }
   │
RoleP ─── θ-role arguments
   │       TARGET | THEME | SOURCE | DEST | INSTRUMENT | BENEFICIARY
   │
VerifyP ─ Verification contract
   │       NONE | TEST | PROOF | CITATION | RUBRIC | POLICY
   │
OutP ──── Output contract
           number | expression | proof | explanation | summary | plan | code | text
```

## IntentIR Schema

```typescript
type IntentIR = {
  v: "0.1";                    // Wire version
  force: Force;                // Illocutionary force
  event: Event;                // { lemma, class }
  args: Args;                  // Partial<Record<Role, Term>>
  cond?: Pred[];               // AND-conjoined conditions
  mod?: Modality;              // Optional modality
  time?: TimeSpec;             // Optional temporal constraint
  verify?: VerifySpec;         // Optional verification contract
  out?: OutputSpec;            // Optional output contract
  ext?: Record<string, unknown>; // Extension fields
};
```

## Term Types

| Kind | Description | Fields |
|------|-------------|--------|
| `entity` | Domain entity reference | `entityType`, `ref?` |
| `path` | Semantic path reference | `path` |
| `artifact` | Document/code/data | `artifactType`, `ref`, `content?` |
| `value` | Typed literal | `valueType`, `shape`, `raw?` |
| `expr` | Expression | `exprType`, `expr` |

## Key System

| Key | Purpose | Input |
|-----|---------|-------|
| **intentKey** | Protocol identity | `IntentBody + schemaHash` |
| **strictKey** | Exact reproduction | `ResolvedIntentIR + footprint + context` |
| **simKey** | Similarity search | `SemanticCanonicalIR` |

## Canonicalization Modes

| Mode | Purpose | ValueTerm.raw |
|------|---------|---------------|
| **Semantic** | Similarity, clustering | Removed |
| **Strict** | Exact caching | Normalized |

## Reference Resolution

| Kind | Resolution |
|------|------------|
| `this` | Current focus entity |
| `that` | Most recent non-focus |
| `last` | Most recent of same type |
| `id` | Pass-through |
| (absent) | Collection scope |

## Feature Checking

```
1. Lemma existence → UNKNOWN_LEMMA
2. Class consistency → CLASS_MISMATCH
3. Required roles → MISSING_ROLE
4. Term kind restrictions → INVALID_TERM_KIND
5. Entity type restrictions → INVALID_ENTITY_TYPE
6. Policy hints → requiresConfirm
```

## Lowering Pipeline

```
IntentIR
    │
    ├── Reference Resolution (this/that/last → id)
    │
    ├── Feature Checking (Lexicon validation)
    │
    ├── Action Type Mapping (lemma → actionType)
    │
    └── IntentBody (protocol format)
```

## Related Documents

- [Design Rationale (FDR)](/internals/fdr/intent-ir-fdr)
