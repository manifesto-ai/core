# MEL

> **Purpose:** Overview of MEL (Manifesto Expression Language)
> **Audience:** Anyone writing or reviewing Manifesto domains
> **Reading time:** 5 minutes

---

## What is MEL?

MEL (Manifesto Expression Language) is a declarative, typed language for defining Manifesto domains. It compiles to DomainSchema, which Core evaluates deterministically.

MEL is designed for:
- Human authored domain definitions
- LLM authored domain definitions
- Build-time validation and review

---

## Where MEL fits

```
MEL source -> @manifesto-ai/compiler -> DomainSchema -> Core -> Host
```

MEL is a source format. It does not execute. It produces data that Core can compute on.

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

  computed doubled = mul(count, 2)

  action increment() {
    onceIntent {
      patch count = add(count, 1)
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
| **Deterministic output** | Same source always produces same DomainSchema |

MEL compiles to DomainSchema, which Core evaluates deterministically.

---

## CLI: check and compile

```bash
pnpm add -D @manifesto-ai/compiler
pnpm exec mel check path/to/domain.mel
pnpm exec mel compile path/to/domain.mel --stdout
```

---

## Read Next

- [MEL Syntax](/mel/SYNTAX)
- [MEL Examples](/mel/EXAMPLES)
- [MEL Error Guide](/mel/ERROR-GUIDE)
- [MEL LLM Context](/mel/LLM-CONTEXT)
- [Specifications](/internals/spec/) - Package specifications including Compiler
- [Design Rationale](/internals/fdr/) - Package FDRs including Compiler
