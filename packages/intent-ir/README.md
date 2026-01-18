# @manifesto-ai/intent-ir

> **Status:** Deprecated (v2 focuses on Core/Host/World/App). This package is legacy and may be removed.


> **Intent IR** is a Chomskyan LF (Logical Form) based Intermediate Representation for natural language intent. It provides deterministic semantic structures that bridge human language to executable domain actions.

---

## What is Intent IR?

Intent IR captures the **semantic meaning** of natural language intent in a language-independent, canonicalizable form. It serves as the bridge between human-generated utterances and machine-processable protocol structures.

In the Manifesto architecture:

```
Natural Language (PF)  ───►  INTENT IR (LF)  ───►  IntentBody
"Cancel my order"            Semantic Structure     (Protocol)
"주문 취소해"                 (language-independent)
```

Key insight: **Same meaning, same form.** Regardless of surface language, semantically equivalent intents produce identical IR structures.

---

## What Intent IR Does

| Responsibility | Description |
|----------------|-------------|
| Represent semantic intent | Structure-based meaning (not strings or tokens) |
| Canonicalize intents | Ensure equivalent meanings produce identical forms |
| Derive semantic keys | `intentKey`, `strictKey`, `simKey` for caching and similarity |
| Check features | Validate IR against Lexicon (type/selectional restrictions) |
| Lower to protocol | Transform IntentIR to IntentBody |
| Resolve references | Deterministic discourse resolution (`this`/`that`/`last` → `id`) |

---

## What Intent IR Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Parse natural language | Translator (LLM-assisted) |
| Execute intents | Host |
| Generate responses | Application layer |
| Store conversation history | World / Application |

---

## Installation

```bash
npm install @manifesto-ai/intent-ir
# or
pnpm add @manifesto-ai/intent-ir
```

### Peer Dependencies

```bash
npm install zod  # Required peer
```

---

## Quick Example

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

// 4. Resolve references (this/that/last → id)
const resolver = createResolver();
const context = {
  discourse: [{ entityType: "Order", id: "order-123", mentionedAt: 1 }],
};
const lowerResult = lower(ir, lexicon, resolver, context);

if (lowerResult.ok) {
  console.log(lowerResult.body);
  // { type: "cancel", input: { args: { target: { type: "Order", ref: { kind: "id", id: "order-123" } } } } }
}

// 5. Derive similarity key for caching/search
const simKey = deriveSimKey(ir);
console.log(simKey); // 64-bit SimHash
```

---

## Core API

### Schemas

```typescript
// Main schema
const IntentIRSchema: z.ZodObject<IntentIR>;

// Parsing functions
function parseIntentIR(data: unknown): IntentIR;
function safeParseIntentIR(data: unknown): SafeParseResult;
function validateIntentIR(data: unknown): ValidationResult;

// Types
type IntentIR = {
  v: "0.1";
  force: Force;              // "ASK" | "DO" | "VERIFY" | "CONFIRM" | "CLARIFY"
  event: Event;              // { lemma: string, class: EventClass }
  args: Args;                // Partial<Record<Role, Term>>
  cond?: Pred[];             // AND-conjoined conditions
  mod?: Modality;            // "MUST" | "SHOULD" | "MAY" | "FORBID"
  time?: TimeSpec;
  verify?: VerifySpec;
  out?: OutputSpec;
  ext?: Record<string, unknown>;
};

type Term =
  | EntityRefTerm    // { kind: "entity", entityType, ref? }
  | PathRefTerm      // { kind: "path", path }
  | ArtifactRefTerm  // { kind: "artifact", artifactType, ref, content? }
  | ValueTerm        // { kind: "value", valueType, shape, raw? }
  | ExprTerm;        // { kind: "expr", exprType, expr }
```

### Canonicalization

```typescript
// Semantic mode (removes raw, for similarity)
function canonicalizeSemantic(ir: IntentIR): IntentIR;
function toSemanticCanonicalString(ir: IntentIR): string;

// Strict mode (normalizes raw, for exact caching)
function canonicalizeStrict(ir: IntentIR): IntentIR;
function toStrictCanonicalString(ir: IntentIR): string;
```

### Key Derivation

```typescript
// Protocol identity key
function deriveIntentKey(body: IntentBody, schemaHash: string): Promise<string>;
function deriveIntentKeySync(body: IntentBody, schemaHash: string): string;

// Exact reproduction key
function deriveStrictKey(
  resolvedIR: ResolvedIntentIR,
  footprint: Footprint,
  snapshot: Snapshot,
  context: ExecutionContext
): Promise<string>;

// Similarity search key (64-bit SimHash)
function deriveSimKey(ir: IntentIR): bigint;
function simhashDistance(a: bigint, b: bigint): number;
```

### Lexicon & Feature Checking

```typescript
// Create a Lexicon
function createLexicon(config: LexiconConfig): Lexicon;

// Check IR validity
function checkFeatures(ir: IntentIR, lexicon: Lexicon): CheckResult;

type CheckResult =
  | { valid: true; requiresConfirm?: boolean }
  | { valid: false; error: CheckError; suggest: "ERROR" | "CLARIFY" };
```

### Lowering & Resolution

```typescript
// Create resolver
function createResolver(): Resolver;

// Lower IntentIR to IntentBody
function lower(
  ir: IntentIR,
  lexicon: Lexicon,
  resolver: Resolver,
  context?: ResolutionContext
): LowerResult;

function lowerOrThrow(
  ir: IntentIR,
  lexicon: Lexicon,
  resolver: Resolver,
  context?: ResolutionContext
): { body: IntentBody; resolvedIR: ResolvedIntentIR };
```

---

## Core Concepts

### Functional Projection Hierarchy

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

### Three Key Types

| Key | Purpose | Derivation |
|-----|---------|------------|
| **intentKey** | Protocol semantic identity | `IntentBody + schemaHash` |
| **strictKey** | Exact reproduction cache | `ResolvedIntentIR + footprint + context` |
| **simKey** | Similarity search | `SemanticCanonicalIR → SimHash` |

### Discourse Reference Resolution

Symbolic references are resolved deterministically (no LLM):

| Reference | Resolves To |
|-----------|-------------|
| `{ kind: "this" }` | Currently focused entity |
| `{ kind: "that" }` | Previously mentioned (non-focus) entity |
| `{ kind: "last" }` | Most recent of same entity type |
| `{ kind: "id", id: "..." }` | Explicit identifier (pass-through) |
| (absent `ref`) | Collection scope (preserved) |

---

## Relationship with Other Packages

```
┌──────────────┐
│  Translator  │ ← Produces IntentIR from natural language
└──────┬───────┘
       │
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

| Relationship | Package | How |
|--------------|---------|-----|
| Input from | `@manifesto-ai/translator` | Translator produces IntentIR |
| Output to | `@manifesto-ai/world` | IntentBody enters World Protocol |
| Validates against | Application Lexicon | Domain-specific vocabulary |

---

## When to Use Intent IR

**Use Intent IR when building:**

- Natural language interfaces (chatbots, voice assistants)
- LLM-powered domain interactions
- Intent caching and similarity search systems
- Multi-language intent normalization

**Not needed for:**

- Direct programmatic API calls (use IntentBody directly)
- Simple CRUD applications without NL interface

---

## Documentation

| Document | Purpose |
|----------|---------|
| [SPEC-0.1.0v.md](docs/SPEC-0.1.0v.md) | Complete specification |
| [FDR-0.1.0v.md](docs/FDR-0.1.0v.md) | Foundational Design Rationale |

---

## Theoretical Foundation

Intent IR is grounded in **Chomsky's Minimalist Program**:

- **PF (Phonetic Form)**: Surface utterance ("Cancel my order")
- **LF (Logical Form)**: Semantic structure (Intent IR)
- **Lexicon**: Feature checking for grammaticality

Key axioms:
1. Structure is meaning (not strings, not tokens)
2. Lexicon is the arbiter of validity
3. Same meaning, same form (canonicalization)
4. IR is intent, not plan (execution is downstream)
5. Functional heads are finite and enumerated

---

## License

[MIT](../../LICENSE)
