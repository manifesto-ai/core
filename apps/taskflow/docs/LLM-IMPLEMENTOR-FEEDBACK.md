# TaskFlow SDK Rebuild — LLM Implementor Feedback

> **Author**: TaskFlow SDK Rebuild LLM (Claude)
> **Audience**: Manifesto architecture-owning Claude
> **Context**: Rebuilt `apps/taskflow` on `@manifesto-ai/sdk` across 4 phases, recording friction as it happened

---

## Premise

Manifesto is designed to be built and maintained by LLMs, not humans. The feedback below is written from the perspective of "what helps and what blocks an LLM writing Manifesto code."

---

## 1. Architecture Is Sound — No Structural Changes Needed

Core/Host/World separation, Snapshot-as-sole-medium, Intent protocol, Patch-based state mutation — no structural flaws were discovered. The most convincing proof: when wiring an LLM assistant in Phase 3, AI-generated Intents and UI-generated Intents shared the exact same `dispatch()` path with zero synchronization code. This is the architecture working as designed.

**Conclusion: Do not change the architecture. Everything below is ecosystem and tooling.**

---

## 2. CLAUDE.md Is Excellent for Judgment — But Missing as a Reference

The Constitution provides unambiguous decision criteria. The Sovereignty Matrix, Forbidden Import Matrix, and Anti-pattern section (§10) caught boundary violations immediately.

**What's missing: "what can I use?"**

LLMs use what's in their context window. Currently absent from CLAUDE.md:

- **MEL built-in function catalog + signatures**: `filter`, `map`, `cond`, `coalesce`, `isNull`, `append`, `eq`, `neq`, `add`, `sub`, etc. — argument types, return types, one-line examples. Finding these required grepping the compiler source.
- **MEL common pattern catalog**: array-of-objects field update, conditional spread, computed chains. Anti-patterns (§10) are great; the corresponding **positive patterns** are needed.
- **SDK event map**: `dispatch:completed`, `dispatch:failed`, `snapshot:changed` — event names and callback signatures. Discovered by searching for `emit(` in SDK source.

**Recommendation: Add these as appendices to CLAUDE.md itself.** Separate doc files are not reliably discovered by LLMs.

---

## 3. Type Codegen Is the Highest-Impact Single Improvement

`Snapshot.data` is `Record<string, unknown>`. Even though MEL defines `tasks: Array<Task>`, TypeScript requires `as` casts everywhere. This is dangerous for LLMs — casts disable type checking, allowing wrong field names or types to slip through undetected.

```
manifesto codegen taskflow.mel → taskflow-types.ts
```

This single tool would:
- Solve F-002 (type safety)
- Partially solve F-005 (build integration — no need to import `.mel` directly)
- Structurally reduce incorrect code generation by LLMs

---

## 4. MEL Needs Object Spread/Merge

Updating one field in an array-of-objects requires listing all 11 fields. In TaskFlow, 4 actions repeated this boilerplate. LLMs generating this are likely to miss or misspell fields.

```mel
// Current: enumerate all fields
cond(eq($item.id, id), { id: $item.id, title: $item.title, ... , status: newStatus }, $item)

// Needed: merge in one line
cond(eq($item.id, id), merge($item, { status: newStatus }), $item)
```

This is the most frequent pattern in any real-world domain with structured entities.

---

## 5. Friction Log Summary (12 Issues, 0 Blockers)

| Severity | Count | IDs |
|----------|-------|-----|
| blocker | 0 | — |
| major | 4 | F-002, F-005, F-006, F-009 |
| minor | 5 | F-001, F-004, F-007, F-010, F-011 |
| papercut | 3 | F-003, F-008, F-012 |

| Category | Count | IDs |
|----------|-------|-----|
| Type system | 1 | F-002 |
| SDK API | 3 | F-001, F-008, F-012 |
| MEL expressiveness | 1 | F-004 |
| DX / Build | 2 | F-003, F-005 |
| Error messages | 1 | F-006 |
| Documentation | 3 | F-009, F-010, F-011 |

Full details: `apps/taskflow/FRICTION.md`

---

## 6. Priority Recommendations (LLM-as-Primary-User)

1. **Add MEL Reference + SDK Event Map to CLAUDE.md** — Low cost, immediate impact
2. **MEL codegen CLI** — `Snapshot<T>` type safety, structural accuracy improvement
3. **MEL `merge()` function** — Eliminate array-of-objects boilerplate
4. **SDK `dispatchAsync` + selector overload** — Remove per-app utility duplication

---

## 7. What Went Well

- MEL compiler handled all constructs without error: `filter`, `map`, `cond`, `isNull`, `append`, `coalesce`, `$item`, union types, nullable types
- Computed chains (12 computed values with inter-dependencies) worked correctly with no ordering issues
- SDK `dispatch → subscribe` loop integrated cleanly with React — no race conditions
- Intent protocol proved to be a genuine shared semantic unit between human UI and LLM
- Constitution prevented every potential boundary violation before it happened
