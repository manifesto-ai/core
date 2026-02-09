# @manifesto-ai/intent-ir v0.3.1

> Chomskyan LF-based Intermediate Representation for natural language intent.

## Role

Semantic structure for natural language → protocol intent pipeline: PF (Natural Language) → IntentIR (LF) → IntentBody (Protocol).

## Dependencies

- `@manifesto-ai/core` (workspace)
- Peer: `zod` ^4.3.6

## Design Principles

1. Structure is meaning (not strings/tokens)
2. Lexicon is the arbiter of validity
3. Same meaning = same canonical form
4. IR is intent, not plan (execution is downstream)

## Public API

### Version

```typescript
INTENT_IR_VERSION  // Current version string
```

### Schemas (Zod-validated)

```typescript
IntentIRSchema         // Full IR validation
parseIntentIR(data)    // Parse + validate
safeParseIntentIR(data)  // Safe parse
validateIntentIR(data)   // Validation only
```

### Functional Heads

`Force` (declarative|interrogative|imperative), `EventClass` (create|read|update|delete|...), `Role` (agent|theme|goal|source|...), `Modality`, `TimeKind`, `VerifyMode`, `OutputType`, `OutputFormat`

### Constants

```typescript
ROLE_ORDER           // Canonical role ordering
FORCE_VALUES         // Valid Force values
EVENT_CLASS_VALUES   // Valid EventClass values
ROLE_VALUES          // Valid Role values
```

### Canonicalization

```typescript
canonicalizeSemantic(ir)   // For similarity search (raw removed)
canonicalizeStrict(ir)     // For exact reproduction (raw normalized)
toSemanticCanonicalString(ir)  // String form of semantic canonical
toStrictCanonicalString(ir)    // String form of strict canonical
normalizeTermSemantic(term)    // Normalize single term (semantic)
normalizeTermStrict(term)      // Normalize single term (strict)
sortPredicates(predicates)     // Canonical ordering
```

### Key Derivation

```typescript
deriveIntentKey(body, schemaHash): Promise<string>       // Protocol semantic identity
deriveIntentKeySync(body, schemaHash): string            // Sync version
deriveStrictKey(ir, context): Promise<string>             // Exact reproduction cache
deriveStrictKeySync(ir, context): string                  // Sync version
deriveSimKey(ir): Promise<string>                         // Similarity key
simhashDistance(key1, key2): number                       // Hamming distance
```

### Lexicon

```typescript
createLexicon(config: LexiconConfig): Lexicon
checkFeatures(ir, config): CheckResult   // Standalone feature check

interface Lexicon {
  resolveActionType(lemma): string | undefined;
  mapArgsToInput(args, cond?): unknown;
  deriveScopeProposal?(ir): IntentScope | undefined;
  checkFeatures(ir): CheckResult;
}
```

### Resolver (Reference Resolution)

```typescript
createResolver(): Resolver

interface Resolver {
  resolveReferences(ir, context?): ResolvedIntentIR;
}
// Rules: this→focus, that→most recent different type, last→most recent same type
```

### Lowering (IR → IntentBody)

```typescript
lower(ir, lexicon, resolver, context?): LowerResult
lowerOrThrow(ir, lexicon, resolver, context?): IntentBody  // Throws on failure

type LowerResult =
  | { ok: true; body: IntentBody; resolvedIR: ResolvedIntentIR }
  | { ok: false; error: LoweringError };

type IntentBody = { type: string; input?: unknown; scopeProposal?: IntentScope };
```

## Pipeline

```
Natural Language → IntentIR (semantic structure)
  → lower() → IntentBody (protocol intent)
  → Issuer.issue() → IntentInstance (executable attempt)
  → World.submitProposal() → Governance
```
