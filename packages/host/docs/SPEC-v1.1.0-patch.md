# Host Contract SPEC v1.1.0 (Patch)

> **Version:** 1.1.0
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-01-04
> **Base:** v1.0.0 (REQUIRED - base document NOT in archive)
> **Depends On:** MEL SPEC v0.4.0
> **Revision:** Rev.5 - All GO-Blocking issues resolved

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| Compiler dependency | New Obligation | Breaking |
| Expression evaluation requirement | New Obligation | Breaking |
| ConditionalPatchOp handling | New Obligation | Breaking |
| $system.* restriction | New Prohibition | Breaking |
| Section 17: Compiler Integration | New Section | Normative |
| §13.2: Informative example fixed | Amendment | Guidance |

---

## Revision History (Rev.5 Fixes)

| Issue | Source | Resolution |
|-------|--------|------------|
| intentId split | R1-1 | Single intentId throughout |
| evaluation norm | R1-2 | References Compiler SPEC §18 |
| $system handling | R1-3, R2-5 | Forbidden in Translator path |
| multi-patch semantics | R1-4 | Sequential (references Compiler §18.5) |
| condition loss | R2-6 | ConditionalPatchOp[] + evaluateConditionalPatchOps |
| **snapshot.state** | R3-1 | **Changed to snapshot.data** |
| **truthy/falsy** | R3-2 | **Boolean-only condition** |

---

## 1. Header Update

```diff
- # Manifesto Host Contract Specification v1.0
+ # Manifesto Host Contract Specification v1.1

+ > **Changelog:**
+ > - v1.0: Initial release
+ > - **v1.1: Compiler Integration, Expression Evaluation**
```

---

## 2. New Definitions

```markdown
### 2.6 Compiler (v1.1)

**Compiler** refers to `@manifesto-ai/compiler`, responsible for:

- Lowering MEL IR to Core IR
- Evaluating expressions to concrete values (total function)
- Preserving and evaluating conditions

### 2.7 ConditionalPatchOp (v1.1)

```typescript
type ConditionalPatchOp = {
  condition?: CoreExprNode;  // Preserved from PatchFragment
  op: "set" | "unset" | "merge";
  path: string;
  value?: CoreExprNode;
};
```

Intermediate type between lowering and evaluation. Contains Core IR expressions.

### 2.8 Patch (v1.1)

```typescript
type Patch = {
  op: "set" | "unset" | "merge";
  path: string;
  value?: unknown;  // CONCRETE value
};
```

**This is what Core.apply() receives.** No expressions, no conditions.

### 2.9 Evaluation (v1.1)

The process of resolving Core IR expressions to concrete values:
- Total function (returns null on invalid operations, never throws)
- Sequential semantics (later patches see earlier patches' effects via working snapshot.data)
- Boolean-only conditions (only includes patches where condition === true; null/non-boolean treated as false)
```

---

## 3. Section 3.1: Responsibility Matrix

```diff
| Concern | Core | Host |
|---------|------|------|
| Semantic computation | ✅ | ❌ |
| Expression evaluation | ✅ | ❌ |
| Flow interpretation | ✅ | ❌ |
| Effect execution | ❌ | ✅ |
| State mutation | ❌ | ✅ (via apply only) |
| Persistence | ❌ | ✅ |
+ | IR Lowering | ❌ | ✅ (via Compiler) |
+ | Translator expr evaluation | ❌ | ✅ (via Compiler) |

+ **Note (v1.1):** 
+ - Core.compute() evaluates expressions in FlowSpec internally.
+ - Core.apply() does NOT evaluate expressions.
+ - For Translator output, Host MUST use Compiler to lower AND evaluate.
```

---

## 4. Section 4.3: Compiler Integration

```markdown
### 4.3 Compiler Integration (v1.1)

When processing Translator output, the Host **MUST** use `@manifesto-ai/compiler` for lowering and evaluation.

#### 4.3.1 Complete Processing Flow

```typescript
import { 
  lowerPatchFragments, 
  evaluateConditionalPatchOps,
  PatchLoweringContext,
  EvaluationContext,
  ConditionalPatchOp,
  Patch
} from "@manifesto-ai/compiler";

async function processTranslatorOutput(
  translatorOutput: TranslatorOutput,
  snapshot: Snapshot,
  intent: Intent
): Promise<Snapshot> {
  
  // Step 1: Lower MEL IR → Core IR (preserves conditions)
  const loweringCtx: PatchLoweringContext = {
    // NO system prefix — forbidden in Translator path
    allowSysPaths: { prefixes: ["meta", "input"] },
    fnTableVersion: "1.0",
    actionName: intent.type
  };
  
  const lowered: ConditionalPatchOp[] = lowerPatchFragments(
    translatorOutput.fragments, 
    loweringCtx
  );
  
  // Step 2: Evaluate Core IR → concrete values
  // (sequential semantics, conditions applied)
  const evalCtx: EvaluationContext = {
    snapshot: snapshot,
    meta: { intentId: intent.intentId },
    input: intent.input ?? {}
  };
  
  const patches: Patch[] = evaluateConditionalPatchOps(lowered, evalCtx);
  
  // Step 3: Apply concrete patches
  return core.apply(schema, snapshot, patches);
}
```

#### 4.3.2 Type Flow

```
PatchFragment[] (MEL IR + condition)
      │
      │ lowerPatchFragments()
      ▼
ConditionalPatchOp[] (Core IR + condition)
      │
      │ evaluateConditionalPatchOps()
      ▼
Patch[] (concrete values)
      │
      │ core.apply()
      ▼
Snapshot
```

#### 4.3.3 $system.* Restriction

**NORMATIVE: $system.* is NOT available in Translator-evaluation path.**

System values require:
1. core.compute() to execute Flow
2. system.get effect to be raised
3. Host to execute effect
4. Result to be patched into Snapshot

Translator-evaluation path bypasses this lifecycle, so system values cannot be produced.

```typescript
// ❌ VIOLATION: Including system in allowSysPaths
const ctx = { allowSysPaths: { prefixes: ["meta", "input", "system"] } };

// ✅ CORRECT: Only meta and input
const ctx = { allowSysPaths: { prefixes: ["meta", "input"] } };
```
```

---

## 5. Section 5.5: New Prohibitions

```markdown
### 5.5 Expression to Core.apply() Prohibition (v1.1)

Host **MUST NOT** pass expressions to Core.apply().

```typescript
// ❌ VIOLATION: ConditionalPatchOp[] (contains expressions)
const lowered = lowerPatchFragments(fragments, ctx);
core.apply(schema, snapshot, lowered);

// ✅ CORRECT: Patch[] (concrete values)
const lowered = lowerPatchFragments(fragments, ctx);
const patches = evaluateConditionalPatchOps(lowered, evalCtx);
core.apply(schema, snapshot, patches);
```

### 5.6 $system.* in Translator Path Prohibition (v1.1)

Host **MUST NOT** include `system` in `allowSysPaths.prefixes` for Translator processing.

```typescript
// ❌ VIOLATION
{ allowSysPaths: { prefixes: ["meta", "input", "system"] } }

// ✅ CORRECT
{ allowSysPaths: { prefixes: ["meta", "input"] } }
```

If Translator output contains $system.* references, lowering MUST fail with INVALID_SYS_PATH.
```

---

## 6. Section 13.2: Informative Example (R1-1 Fix)

```markdown
### 13.2 Informative: Host Loop with Translator (v1.1)

> **STATUS: INFORMATIVE** — Guidance, not normative.

```typescript
import { 
  lowerPatchFragments, 
  evaluateConditionalPatchOps 
} from "@manifesto-ai/compiler";

/**
 * INFORMATIVE PATTERN
 * 
 * For proposal-based flows, see Translator SPEC §5.
 * This pattern bypasses Authority.
 */
async function processNaturalLanguageIntent(
  core: ManifestoCore,
  translator: Translator,
  schema: DomainSchema,
  snapshot: Snapshot,
  userInput: string
): Promise<Snapshot> {
  
  // ═══════════════════════════════════════════════════════════════
  // CRITICAL (R1-1 Fix): Single intentId throughout entire flow
  // ═══════════════════════════════════════════════════════════════
  const intentId = crypto.randomUUID();
  
  // 1. Translate
  const result = await translator.translate(
    { raw: userInput, format: "natural_language" },
    { schema, snapshot, actor: hostActor }
  );
  
  // 2. Handle ambiguity (Host policy)
  if (result.ambiguity) {
    throw new AmbiguityError(result.ambiguity);
  }
  
  // 3. Lower (preserves conditions)
  const lowered = lowerPatchFragments(result.fragments, {
    // NO system — forbidden in Translator path
    allowSysPaths: { prefixes: ["meta", "input"] },
    fnTableVersion: "1.0",
    actionName: result.actionName ?? "user_action"
  });
  
  // 4. Evaluate (SAME intentId as will be used in compute loop)
  const patches = evaluateConditionalPatchOps(lowered, {
    snapshot: snapshot,
    meta: { intentId },  // ← SAME intentId
    input: result.params ?? {}
  });
  
  // 5. Apply
  let current = core.apply(schema, snapshot, patches);
  
  // 6. Standard Host loop (SAME intentId)
  const intent: Intent = {
    type: result.actionName ?? "translated",
    input: result.params,
    intentId  // ← SAME intentId
  };
  
  while (true) {
    const computeResult = core.compute(schema, current, intent);
    current = computeResult.snapshot;
    
    switch (computeResult.status) {
      case 'complete':
      case 'halted':
        return current;
      case 'error':
        return current;
      case 'pending':
        for (const req of current.system.pendingRequirements) {
          const effectPatches = await executeEffect(req.type, req.params);
          current = core.apply(schema, current, effectPatches);
        }
        current = core.apply(schema, current, [
          { op: 'set', path: 'system.pendingRequirements', value: [] }
        ]);
        break;
    }
  }
}
```

**CRITICAL: Single intentId**
> The same `intentId` MUST be used for:
> - EvaluationContext.meta.intentId
> - Intent.intentId in compute loop
>
> This ensures `$meta.intentId` evaluates to the same value in both lowering and Flow execution,
> which is essential for once-markers and idempotency guards.
```

---

## 7. New Section 17: Compiler Integration

```markdown
---

## 17. Compiler Integration (v1.1)

### 17.1 Dependency

```json
{
  "dependencies": {
    "@manifesto-ai/compiler": "^0.4.0"
  }
}
```

### 17.2 Required Imports

```typescript
import {
  // Lowering
  lowerPatchFragments,
  
  // Evaluation
  evaluateConditionalPatchOps,
  
  // MEL Text
  compileMelDomain,
  compileMelPatch,
  
  // Types
  PatchLoweringContext,
  EvaluationContext,
  ConditionalPatchOp,
  Patch,
  LoweringError
} from "@manifesto-ai/compiler";
```

### 17.3 Integration Points

| Scenario | Calls Required | Output |
|----------|---------------|--------|
| Translator → Core | `lowerPatchFragments` + `evaluateConditionalPatchOps` | `Patch[]` |
| MEL text → Core | `compileMelPatch` + `evaluateConditionalPatchOps` | `Patch[]` |
| Schema compilation | `compileMelDomain` | `DomainSchema` |

### 17.4 Error Handling

```typescript
try {
  const lowered = lowerPatchFragments(fragments, loweringCtx);
  const patches = evaluateConditionalPatchOps(lowered, evalCtx);
  return core.apply(schema, snapshot, patches);
} catch (error) {
  if (error instanceof LoweringError) {
    // INVALID_SYS_PATH: $system.* in Translator path
    // UNSUPPORTED_BASE: get.base is not var(item)
    // INVALID_KIND_FOR_CONTEXT: var in non-effect context
    // UNKNOWN_CALL_FN: unknown function
  }
  // Note: evaluateConditionalPatchOps is TOTAL
  // It returns null for invalid operations, does not throw
  throw error;
}
```

### 17.5 Evaluation Semantics Reference

See MEL SPEC v0.4.0 §18 for:
- Total function principle (returns null, never throws)
- Sequential evaluation with working snapshot
- Condition evaluation
- Path resolution rules

### 17.6 Compliance Checklist

| Requirement | Level |
|-------------|-------|
| Import `@manifesto-ai/compiler` | MUST |
| Call `lowerPatchFragments()` | MUST |
| Call `evaluateConditionalPatchOps()` | MUST |
| Pass `Patch[]` (concrete) to `core.apply()` | MUST |
| Use single intentId throughout | MUST |
| Exclude `system` from allowSysPaths | MUST |
| Handle `LoweringError` | MUST |
| Never pass expressions to `core.apply()` | MUST NOT |
| Never include `system` in Translator path | MUST NOT |
```

---

## 8. Appendix A: Quick Reference

```diff
### A.1 Host MUST

- Invoke `compute()` for all semantic computation
- Mutate state only via `apply()`
- Re-invoke `compute()` after effect fulfillment with same `intentId`
- Clear fulfilled Requirements before re-invocation
- Serialize Intent processing per Snapshot lineage
- Apply patches in deterministic order
+ - Use Compiler for Translator output lowering (v1.1)
+ - Use Compiler for expression evaluation (v1.1)
+ - Pass only concrete `Patch[]` to `core.apply()` (v1.1)
+ - Use single intentId throughout processing (v1.1)
+ - Exclude $system.* from Translator path (v1.1)

### A.2 Host MUST NOT

- Mutate Snapshot directly
- Pass values outside Snapshot
- Modify version/timestamp
- Skip `compute()` calls
- Allow concurrent `compute()` on same Snapshot version
+ - Pass expressions (MEL IR or Core IR) to `core.apply()` (v1.1)
+ - Skip evaluation step (v1.1)
+ - Include `system` in Translator allowSysPaths (v1.1)
+ - Use different intentIds for evaluation vs compute (v1.1)
```

---

## 9. Appendix B: Glossary

```diff
| Term | Definition |
|------|------------|
| **Core** | Pure semantic calculator |
| **Host** | External system operating Core |
| **Snapshot** | Immutable point-in-time state |
+ | **Compiler** | Lowers MEL IR, evaluates expressions (v1.1) |
+ | **Lowering** | MEL IR → Core IR transformation (v1.1) |
+ | **Evaluation** | Core IR → concrete values (v1.1) |
+ | **ConditionalPatchOp** | Core IR patch with optional condition (v1.1) |
+ | **Patch** | Concrete state change for core.apply() (v1.1) |
```

---

## 10. Migration Guide

### 10.1 Breaking Changes

| Before (v1.0) | After (v1.1) |
|---------------|--------------|
| Implicit lowering | Explicit: lower + evaluate |
| Any allowSysPaths | system forbidden |
| Type ambiguous | ConditionalPatchOp[] → Patch[] |

### 10.2 Migration Code

```typescript
// Before (undefined behavior)
core.apply(schema, snapshot, translatorOutput.fragments);

// After (correct)
const intentId = crypto.randomUUID();

const lowered = lowerPatchFragments(translatorOutput.fragments, {
  allowSysPaths: { prefixes: ["meta", "input"] },  // NO system
  fnTableVersion: "1.0",
  actionName: intent.type
});

const patches = evaluateConditionalPatchOps(lowered, {
  snapshot,
  meta: { intentId },
  input: intent.input ?? {}
});

core.apply(schema, snapshot, patches);

// Use same intentId for compute loop
const computeIntent = { type: intent.type, input: intent.input, intentId };
```

---

## 11. Cross-Reference

| This Document | MEL SPEC v0.4.0 |
|---------------|-----------------|
| §2.7 ConditionalPatchOp | §17.5 |
| §4.3 Processing Flow | §20 |
| §5.6 $system restriction | §20.3, AD-COMP-LOW-002 |
| §17.5 Evaluation semantics | §18 (Normative) |

---

## 12. Acceptance Criteria

- [ ] Host imports `@manifesto-ai/compiler`
- [ ] Host calls `lowerPatchFragments()`
- [ ] Host calls `evaluateConditionalPatchOps()`
- [ ] `core.apply()` receives `Patch[]` (concrete)
- [ ] Single intentId used throughout
- [ ] `system` excluded from allowSysPaths
- [ ] LoweringError handled
- [ ] §13.2 understood as Informative

---

*End of Host Contract SPEC v1.1 Patch Document (Rev.4)*
