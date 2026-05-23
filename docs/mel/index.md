# MEL

> **Purpose:** Overview of MEL (Manifesto Expression Language)
> **Audience:** Anyone writing or reviewing Manifesto domains
> **Reading time:** 5 minutes

---

## What is MEL?

MEL (Manifesto Expression Language) is the declarative, typed file format for a
Manifesto domain. You write domain state, computed values, actions, and effect
declarations in `.mel`; your app imports that domain through the compiler and
activates it with the SDK runtime.

MEL is designed for:
- human-authored app domains
- AI-assisted domain drafts that humans can review
- build-time validation before runtime code runs

---

## Where MEL Fits

```
MEL source -> compiler integration -> createManifesto() -> app.action.* -> snapshot()
```

MEL is a source format. It does not execute like JavaScript. App code activates
the compiled domain, submits actions, and reads Snapshots.

If you are writing your first app, read [MEL For App Developers](/guide/essentials/mel-for-app-developers)
before using the complete reference pages.

This docs section prefers the current sugar-first MEL surface in examples: `count + 1`, `items[id]`, `a ? b : c`, and `{ ...base, status: "done" }`. Equivalent function-form source is still documented, but it is folded into the reference instead of leading every example.

---

## What MEL is NOT

- Not a general-purpose language
- Not a workflow engine
- Not an effect executor
- Not a runtime

---

## Quick Example

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = count * 2

  action increment() {
    onceIntent {
      patch count = count + 1
    }
  }
}
```

**Tip:** Use `onceIntent` for per-intent idempotency without schema guard fields. Use `once()` only when you need an explicit guard field in domain state.

---

## Why MEL?

| Benefit | Description |
| --- | --- |
| **Human-readable** | Clean syntax that's easy to read and review |
| **LLM-friendly** | Structured enough for AI to generate and validate |
| **Build-time validation** | Catch errors before runtime with compiler checks |
| **Deterministic output** | Same source always produces the same compiled domain |

Under the hood, MEL compiles to a `DomainSchema`, which the runtime computes
deterministically. App code normally stays on `.mel` imports, `createManifesto()`,
`app.action.*`, and `snapshot()`.

---

## CLI: check and compile

```bash
pnpm add -D @manifesto-ai/compiler
pnpm exec mel check path/to/domain.mel
pnpm exec mel compile path/to/domain.mel --stdout
```

---

## Read Next

### App Path

- [MEL For App Developers](/guide/essentials/mel-for-app-developers) - the shortest app-building syntax path
- [MEL Domain Basics](/guide/essentials/mel-domain-basics) - first domain concepts
- [Code Generation](/guides/code-generation) - generated TypeScript facades after the app works

### Reference

- [MEL Reference](/mel/REFERENCE) - complete construct and function lookup
- [MEL Syntax](/mel/SYNTAX) - grammar, sugar, access forms, and quick lookup tables
- [MEL Examples](/mel/EXAMPLES)
- [MEL Error Guide](/mel/ERROR-GUIDE)

### Maintainers And Tool Authors

- [MEL LLM Context](/mel/LLM-CONTEXT)
- [Specifications](/internals/spec/) - package specifications including Compiler
- [Design Rationale](/internals/fdr/) - package FDRs including Compiler
