# @manifesto-ai/intent-ir

Chomskyan LF-based Intent Intermediate Representation (SPEC 0.1.0v)

## Overview

Intent IR is a **Semantic Intermediate Representation** that bridges natural language to executable domain actions. Based on Chomsky's Minimalist Program, it captures intent meaning in a language-independent, canonicalizable form.

### Core Principle

**Same meaning, same form.** Regardless of surface language, semantically equivalent intents produce identical IR structures.

```
Natural Language (PF)  ───►  INTENT IR (LF)  ───►  IntentBody
"Cancel my order"            Semantic Structure     (Protocol)
"주문 취소해"                 (language-independent)
```

## Installation

```bash
pnpm add @manifesto-ai/intent-ir
```

### Peer Dependencies

```bash
pnpm add zod
```

## Quick Start

```typescript
import {
  IntentIRSchema,
  parseIntentIR,
  checkFeatures,
  createLexicon,
  createResolver,
  lower,
  deriveSimKey,
} from "@manifesto-ai/intent-ir";

// 1. Define a Lexicon (domain vocabulary)
const lexicon = createLexicon({
  events: {
    CANCEL: {
      eventClass: "CONTROL",
      thetaFrame: {
        required: ["TARGET"],
        optional: [],
        restrictions: {
          TARGET: { termKinds: ["entity"], entityTypes: ["Order"] },
        },
      },
      policyHints: { destructive: true },
    },
  },
  entities: {
    Order: { fields: { id: "string", status: "string" } },
  },
});

// 2. Parse an Intent IR (from translator output)
const ir = parseIntentIR({
  v: "0.1",
  force: "DO",
  event: { lemma: "CANCEL", class: "CONTROL" },
  args: {
    TARGET: {
      kind: "entity",
      entityType: "Order",
      ref: { kind: "last" },
    },
  },
});

// 3. Feature checking (validate against Lexicon)
const checkResult = checkFeatures(ir, lexicon);
if (!checkResult.valid) {
  console.error(checkResult.error);
}

// 4. Lower to IntentBody
const resolver = createResolver();
const context = {
  discourse: [{ entityType: "Order", id: "order-123", mentionedAt: 1 }],
};

const lowerResult = lower(ir, lexicon, resolver, context);
if (lowerResult.ok) {
  console.log(lowerResult.body);
  // → { type: "cancel", input: { ... } }
}

// 5. Derive similarity key for caching/search
const simKey = deriveSimKey(ir);
```

## Functional Head Hierarchy

Intent IR uses a fixed hierarchy of **functional heads** derived from linguistic theory:

```
ForceP ─── Illocutionary force (ASK/DO/VERIFY/CONFIRM/CLARIFY)
   │
ModP ──── Modality (MUST/SHOULD/MAY/FORBID)
   │
TP ────── Temporal specification (NOW/AT/BEFORE/AFTER/WITHIN)
   │
EventP ── Event/operation type (lemma + class)
   │
RoleP ─── θ-role arguments (TARGET/THEME/SOURCE/DEST/...)
   │
VerifyP ─ Verification contract (NONE/TEST/PROOF/CITATION/...)
   │
OutP ──── Output contract (number/expression/proof/plan/code/...)
```

## Term Types

The IR supports 5 term types as a discriminated union:

| Term Kind | Description | Example |
|-----------|-------------|---------|
| `entity` | Domain entity reference | `{ kind: "entity", entityType: "Order", ref: { kind: "last" } }` |
| `path` | Semantic path reference | `{ kind: "path", path: "state.user.email" }` |
| `artifact` | Document/code/data artifact | `{ kind: "artifact", artifactType: "code", ... }` |
| `value` | Typed literal value | `{ kind: "value", valueType: "number", shape: {...}, raw: 42 }` |
| `expr` | Mathematical/logical expression | `{ kind: "expr", exprType: "latex", expr: "x^2" }` |

## Key System

Three key types for different caching/search scenarios:

| Key | Purpose | Derivation |
|-----|---------|------------|
| **intentKey** | Protocol semantic identity | `SHA-256(IntentBody + schemaHash)` |
| **strictKey** | Exact reproduction cache | `SHA-256(ResolvedIntentIR + footprint + context)` |
| **simKey** | Similarity search | `SimHash(SemanticCanonicalIR)` |

## Discourse Reference Resolution

Symbolic references are resolved deterministically (no LLM):

| Reference | Resolves To |
|-----------|-------------|
| `{ kind: "this" }` | Currently focused entity |
| `{ kind: "that" }` | Previously mentioned (non-focus) entity |
| `{ kind: "last" }` | Most recent of same entity type |
| `{ kind: "id", id: "..." }` | Explicit identifier (pass-through) |
| (absent `ref`) | Collection scope (preserved) |

## API Reference

### Schemas

```typescript
// Main schema
const IntentIRSchema: z.ZodObject<IntentIR>;

// Parsing
function parseIntentIR(data: unknown): IntentIR;
function safeParseIntentIR(data: unknown): SafeParseResult;
function validateIntentIR(data: unknown): ValidationResult;
```

### Canonicalization

```typescript
// Semantic mode (removes raw, for similarity)
function canonicalizeSemantic(ir: IntentIR): IntentIR;

// Strict mode (normalizes raw, for exact caching)
function canonicalizeStrict(ir: IntentIR): IntentIR;
```

### Key Derivation

```typescript
// Protocol identity
function deriveIntentKey(body: IntentBody, schemaHash: string): Promise<string>;

// Exact reproduction
function deriveStrictKey(
  resolvedIR: ResolvedIntentIR,
  footprint: Footprint,
  snapshot: Snapshot,
  context: ExecutionContext
): Promise<string>;

// Similarity search (64-bit SimHash)
function deriveSimKey(ir: IntentIR): bigint;
function simhashDistance(a: bigint, b: bigint): number;
```

### Lexicon & Feature Checking

```typescript
function createLexicon(config: LexiconConfig): Lexicon;
function checkFeatures(ir: IntentIR, lexicon: Lexicon): CheckResult;
```

### Lowering & Resolution

```typescript
function createResolver(): Resolver;
function lower(ir, lexicon, resolver, context?): LowerResult;
function lowerOrThrow(ir, lexicon, resolver, context?): { body, resolvedIR };
```

## Configuration Types

### IntentIR Structure

```typescript
type IntentIR = {
  v: "0.1";                    // Wire version
  force: Force;                // ASK | DO | VERIFY | CONFIRM | CLARIFY
  event: Event;                // { lemma, class }
  args: Args;                  // Partial<Record<Role, Term>>
  cond?: Pred[];               // AND-conjoined conditions
  mod?: Modality;              // MUST | SHOULD | MAY | FORBID
  time?: TimeSpec;
  verify?: VerifySpec;
  out?: OutputSpec;
  ext?: Record<string, unknown>;
};
```

### CheckResult

```typescript
type CheckResult =
  | { valid: true; requiresConfirm?: boolean }
  | { valid: false; error: CheckError; suggest: "ERROR" | "CLARIFY" };
```

## Integration with Translator

Intent IR is produced by `@manifesto-ai/translator`:

```
┌──────────────┐
│  Translator  │ ← Natural language input
└──────┬───────┘
       │ produces
       ▼
┌──────────────┐
│  INTENT-IR   │ ← Validates, canonicalizes, lowers
└──────┬───────┘
       │ produces
       ▼
┌──────────────┐
│    World     │ ← Consumes IntentBody via protocol
└──────────────┘
```

## Related Packages

- [`@manifesto-ai/translator`](/packages/translator/README) - Natural language to Intent IR
- [`@manifesto-ai/world`](/specifications/world-spec) - World protocol
- [`@manifesto-ai/core`](/specifications/core-spec) - Core compute engine

## License

MIT
