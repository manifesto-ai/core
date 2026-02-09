# @manifesto-ai/compiler v1.6.0

> MEL (Manifesto Expression Language) compiler. Lexer → Parser → Analyzer → Generator → Lowering.

## Role

Compiles MEL source to DomainSchema. Provides evaluation engine for expressions and patches at runtime.

## Dependencies

- Peer: `@manifesto-ai/core` ^2.0.0, `zod` ^4.3.6
- Optional peers: `vite`, `webpack` (for loader integrations)

## Public API

### Compile API

```typescript
compileMelDomain(melText: string, options?): CompileMelDomainResult
compileMelPatch(melText: string, options): CompileMelPatchResult
```

```typescript
interface CompileMelDomainResult {
  schema: DomainSchema | null;
  trace: CompileTrace[];
  warnings: Diagnostic[];
  errors: Diagnostic[];
}
```

### Pipeline Stages

```
MEL text → Lexer(tokens) → Parser(AST) → Analyzer(validated) → Generator(DomainSchema+IR) → Lowering(CoreIR)
```

### Lexer

```typescript
tokenize(source: string): LexResult
// LexResult = { tokens: Token[]; diagnostics: Diagnostic[] }
```

### Parser

```typescript
parse(tokens: Token[]): ParseResult
// ParseResult = { program: ProgramNode | null; diagnostics: Diagnostic[] }
```

### Generator

```typescript
generate(ast: ProgramNode): { schema: DomainSchema | null; diagnostics: Diagnostic[] }
```

### Lowering (MEL IR → Core IR)

```typescript
lowerExprNode(input: MelExprNode, ctx): CoreExprNode
lowerPatchFragments(patches: MelPatchFragment[], ctx): LoweredPatchOp[]
lowerRuntimePatches(patches: MelRuntimePatch[], ctx?): RuntimeConditionalPatchOp[]
```

### Evaluation (Runtime)

```typescript
evaluateExpr(expr: CoreExprNode, ctx: EvaluationContext): unknown
evaluateCondition(cond: CoreExprNode, ctx): boolean
evaluateRuntimePatches(patches, ctx): { applied: Patch[]; skipped: SkippedRuntimePatch[] }
```

### Renderer (IR → MEL text)

```typescript
renderExprNode(expr): string
renderPatchOp(op, options?): string
renderAsDomain(domainName, fragments, options?): string
```

### Loader Integrations

- `@manifesto-ai/compiler/vite` — Vite plugin for `.mel` imports
- `@manifesto-ai/compiler/loader` — Universal ESM + CJS loader

## Core IR Types

```typescript
type CoreExprNode = { kind: 'lit' | 'get' | 'eq' | 'add' | ... ; ... }
type CoreFlowNode = { kind: 'seq' | 'if' | 'patch' | 'effect' | 'call' | 'halt' | 'fail'; ... }
```

## Diagnostics

```typescript
type Diagnostic = {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location: SourceLocation;
  suggestion?: string;
};
```
