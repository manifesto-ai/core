# @manifesto-ai/compiler

> MEL compiler package (MEL text -> DomainSchema / patch IR / module code)

---

## Overview

`@manifesto-ai/compiler` provides MEL compilation and lowering adapters.

ADR-009 alignment points:
- Conditional patch ops use `IRPatchPath`
- Runtime evaluation resolves IR path segments to concrete `PatchPath`
- Invalid segment resolution is skipped with warnings (TOTAL behavior)

The current full compiler contract is [SPEC-v1.0.0](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.0.0.md).

Current compiler responsibilities also include:
- projected `SchemaGraph` extraction
- intent-level dispatchability via `dispatchable when`
- rich schema-position lowering through `state.fieldTypes`, `action.inputType`, and `action.params`
- pure collection builtins such as `filter`, `map`, `find`, `every`, and `some` in expression contexts

---

## Main Entry Points

### compileMelDomain()

```typescript
import { compileMelDomain } from "@manifesto-ai/compiler";

const result = compileMelDomain(melSource, { mode: "domain" });
```

### compileMelPatch()

```typescript
import { compileMelPatch } from "@manifesto-ai/compiler";

const result = compileMelPatch(patchText, {
  mode: "patch",
  actionName: "updateTodo",
});
```

`compileMelPatch()` returns unresolved conditional ops. Runtime MUST evaluate them before applying to Core.

---

## Patch IR Types

```typescript
type IRPathSegment =
  | { kind: "prop"; name: string }
  | { kind: "expr"; expr: CoreExprNode };

type IRPatchPath = readonly IRPathSegment[];

type ConditionalPatchOp = {
  condition?: CoreExprNode;
  op: "set" | "unset" | "merge";
  path: IRPatchPath;
  value?: CoreExprNode;
};
```

---

## Evaluation Contract

```typescript
function evaluateConditionalPatchOps(
  ops: ConditionalPatchOp[],
  ctx: EvaluationContext
): Patch[];
```

- `resolveIRPath()` MUST convert `IRPatchPath` -> concrete `PatchPath`.
- `expr` segment evaluates to:
  - string -> `{ kind: "prop", name }`
  - non-negative integer -> `{ kind: "index", index }`
- Any other value => skip op + emit warning (never throw due to runtime data).

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Executes compiled `DomainSchema` semantics |
| [@manifesto-ai/sdk](./sdk) | Uses compiler results at runtime creation |
| [MEL Docs](/mel/) | Language reference and examples |
