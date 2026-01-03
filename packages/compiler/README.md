# @manifesto-ai/compiler

> **Compiler** translates MEL (Manifesto Expression Language) into DomainSchema for Manifesto Core.

---

## What is the Compiler?

The compiler is the MEL frontend for Manifesto. It tokenizes, parses, validates, and lowers MEL source into a DomainSchema that Core can evaluate deterministically.

```
MEL source -> Compiler -> DomainSchema -> Core
```

---

## What the Compiler Does

| Responsibility | Description |
| --- | --- |
| Parse MEL | Tokenize and parse MEL into an AST |
| Validate | Scope and semantic checks aligned to MEL v0.3.3 |
| Generate IR | Produce DomainSchema for Core |
| Lower system values | Optional lowering of $system.* into explicit effects |

---

## What the Compiler Does NOT Do

| NOT Responsible For | Who Is |
| --- | --- |
| Execute effects | Host |
| Apply patches | Core |
| Govern authority | World |
| Bind UI | Bridge / React |

---

## Installation

```bash
npm install -D @manifesto-ai/compiler
# or
pnpm add -D @manifesto-ai/compiler
```

---

## CLI Usage

```bash
pnpm exec mel check path/to/domain.mel
pnpm exec mel compile path/to/domain.mel --pretty
pnpm exec mel compile path/to/domain.mel --stdout
pnpm exec mel parse path/to/domain.mel
pnpm exec mel tokens path/to/domain.mel
```

---

## Node API

```typescript
import { compile, check } from "@manifesto-ai/compiler";

const source = `
domain Counter {
  state { count: number = 0 }
  action increment() {
    when true { patch count = add(count, 1) }
  }
}
`;

const result = compile(source, { lowerSystemValues: true });

if (!result.success) {
  console.error(result.errors);
} else {
  console.log(result.schema);
}

const errors = check(source);
```

### Compile Options

```typescript
type CompileOptions = {
  skipSemanticAnalysis?: boolean;
  lowerSystemValues?: boolean;
};
```

---

## Documentation

| Document | Purpose |
| --- | --- |
| [MEL Overview](../../docs/mel/) | What MEL is and how to use it |
| [MEL Syntax](../../docs/mel/SYNTAX.md) | Grammar and syntax |
| [MEL Examples](../../docs/mel/EXAMPLES.md) | Example library |
| [MEL Error Guide](../../docs/mel/ERROR-GUIDE.md) | Error codes and fixes |
| [Compiler Spec](docs/SPEC.md) | Full compiler and MEL spec |
| [Compiler FDR](docs/FDR-0.3.3v.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
