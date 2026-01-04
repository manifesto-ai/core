# Manifesto Compiler Specification v1.1

> **Status:** Normative
> **Role:** MEL Compiler
> **Implementation:** @manifesto-ai/compiler

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Scope and Non-Goals](#3-scope-and-non-goals)
4. [Inputs and Outputs](#4-inputs-and-outputs)
5. [Compilation Pipeline](#5-compilation-pipeline)
6. [Diagnostics](#6-diagnostics)
7. [Determinism and Purity](#7-determinism-and-purity)
8. [CLI Contract](#8-cli-contract)
9. [Compatibility](#9-compatibility)

---

## 1. Introduction

### 1.1 Purpose

`@manifesto-ai/compiler` compiles MEL (Manifesto Expression Language) source into
Manifesto DomainSchema for deterministic execution by Core.

```
MEL source -> Compiler -> DomainSchema -> Core
```

### 1.2 Relationship to Builder

Both MEL and `@manifesto-ai/builder` produce DomainSchema:

- **Builder**: TypeScript-first authoring.
- **Compiler**: MEL source authoring.

They are equivalent in output shape but use different inputs.

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in RFC 2119.

---

## 3. Scope and Non-Goals

### 3.1 In Scope

- Tokenizing MEL source into tokens.
- Parsing tokens into a program AST.
- Semantic analysis of MEL programs.
- Generating DomainSchema IR.
- Optional lowering of system values.

### 3.2 Out of Scope

- Free-form requirement parsing or LLM orchestration.
- Executing effects or applying patches.
- Governance, authority, or world state.
- Runtime evaluation of expressions or flows.

---

## 4. Inputs and Outputs

### 4.1 Inputs

- `source`: A UTF-8 MEL source string.
- `options` (optional):
  - `skipSemanticAnalysis?: boolean`
  - `lowerSystemValues?: boolean`

### 4.2 Outputs

```ts
export type CompileResult =
  | { success: true; schema: DomainSchema }
  | { success: false; errors: Diagnostic[] };
```

If compilation fails, the compiler MUST return diagnostics and MUST NOT throw.

### 4.3 Additional Entry Points

- `parseSource(source)` returns `{ program, diagnostics }`.
- `check(source)` returns error diagnostics only.
- `tokenize(source)` and `parse(tokens)` are exposed for tooling.

---

## 5. Compilation Pipeline

The compiler MUST run the following stages in order:

1. **Lexing**: `tokenize(source)` produces tokens and diagnostics.
2. **Parsing**: `parse(tokens)` produces a program AST and diagnostics.
3. **Semantic Analysis**: `analyzeScope` and `validateSemantics`.
4. **IR Generation**: `generate(program)` produces DomainSchema.
5. **Lowering (optional)**: `lowerSystemValues(schema)` when enabled.

If any stage produces diagnostics with severity `"error"`, compilation MUST fail
and return those diagnostics.

---

## 6. Diagnostics

Diagnostics are values, not exceptions.

```ts
type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  location: SourceLocation;
  source?: string;
  suggestion?: string;
};
```

Requirements:

- Errors MUST stop compilation.
- Warnings and info MAY be returned alongside success results.
- Diagnostics MUST include source locations when available.

---

## 7. Determinism and Purity

The compiler MUST be deterministic:

- Same input and options -> same output.
- No IO, network access, or wall-clock time.
- No hidden mutable state between runs.

Failures MUST be expressed as diagnostics, not thrown exceptions.

---

## 8. CLI Contract

The CLI MUST mirror the library behavior:

```
mel check <file>
mel compile <file> [--stdout|--pretty]
mel parse <file>
mel tokens <file>
```

`mel check` MUST exit non-zero on errors. Other commands MUST surface diagnostics
when parsing or validation fails.

---

## 9. Compatibility

The compiler MUST target the current MEL specification and the Manifesto
Schema Specification.

- MEL spec: `packages/compiler/docs/SPEC.md`
- Schema spec: `docs/specifications/schema-spec.md`

When MEL evolves, the compiler MUST be updated in lockstep with the MEL spec.
