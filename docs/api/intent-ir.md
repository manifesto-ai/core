# @manifesto-ai/intent-ir

> Intent Intermediate Representation (IR), canonicalization, and key derivation

---

## Overview

`@manifesto-ai/intent-ir` is the deterministic meaning layer between natural language interpretation and executable protocol intents.

Core responsibilities:

- Typed IR schemas for intent meaning
- Deterministic canonicalization (semantic / strict)
- Protocol key derivation (`intentKey`, `strictKey`, `simKey`)
- Lexicon-based lowering (`IntentIR -> IntentBody`)
- Deterministic discourse reference resolution

---

## Main Exports

### Schemas and Validation

```typescript
import {
  IntentIRSchema,
  parseIntentIR,
  safeParseIntentIR,
  validateIntentIR,
} from "@manifesto-ai/intent-ir";
```

### Canonicalization

```typescript
import {
  canonicalizeSemantic,
  canonicalizeStrict,
  toSemanticCanonicalString,
  toStrictCanonicalString,
} from "@manifesto-ai/intent-ir";
```

### Key Derivation

```typescript
import {
  deriveIntentKey,
  deriveIntentKeySync,
  deriveStrictKey,
  deriveStrictKeySync,
  deriveSimKey,
  simhashDistance,
} from "@manifesto-ai/intent-ir";
```

### Lexicon / Resolver / Lowering

```typescript
import {
  createLexicon,
  createResolver,
  lower,
  lowerOrThrow,
} from "@manifesto-ai/intent-ir";
```

---

## Lowering Example

```typescript
import { createLexicon, createResolver, lower } from "@manifesto-ai/intent-ir";

const lexicon = createLexicon({
  events: {
    CANCEL: {
      eventClass: "CONTROL",
      thetaFrame: {
        required: ["TARGET"],
        optional: [],
        restrictions: { TARGET: { termKinds: ["entity"], entityTypes: ["Order"] } },
      },
    },
  },
  entities: {
    Order: { fields: { id: "string", status: "string" } },
  },
});

const resolver = createResolver();
const result = lower(ir, lexicon, resolver, {
  discourse: [],
});

if (result.ok) {
  const body = result.body; // IntentBody for protocol layer
}
```

---

## Key Derivation Example

```typescript
import { deriveIntentKeySync } from "@manifesto-ai/intent-ir";

const key = deriveIntentKeySync(
  { type: "order.cancel", input: { orderId: "order_123" } },
  schemaHash
);
```

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/world](./world) | Consumes derived intent identity and scope proposal |
| [@manifesto-ai/core](./core) | Executes the intent semantics after protocol lowering |
| [Intent IR Research](/internals/research/intent-ir/) | Theory and formal model |

