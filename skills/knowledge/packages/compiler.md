# @manifesto-ai/compiler

> MEL (Manifesto Expression Language) compiler. Lexer -> Parser -> Analyzer -> Generator -> Lowering.

## Role

Compiles MEL source to `DomainSchema`. Also exposes evaluation, lowering, rendering, and bundler integration helpers.

## Dependencies

- Peer: `@manifesto-ai/core`, `zod`
- Optional peers and integrations: `vite`, `webpack`, `openai`, `@anthropic-ai/sdk`, `@manifesto-ai/codegen`

## Public API

### Compile API

```typescript
compileMelDomain(melText: string, options?): CompileMelDomainResult
compileMelPatch(melText: string, options): CompileMelPatchResult
compile(source: string, options?): CompileResult
parseSource(source: string): ParseResult
check(source: string): Diagnostic[]
```

### Pipeline

```text
MEL text -> Lexer -> Parser -> Analyzer -> Generator -> Lowering
```

### Bundler integrations

- `@manifesto-ai/compiler/vite`
- `@manifesto-ai/compiler/webpack`
- `@manifesto-ai/compiler/rollup`
- `@manifesto-ai/compiler/esbuild`
- `@manifesto-ai/compiler/rspack`
- `@manifesto-ai/compiler/node-loader`
- `@manifesto-ai/compiler/loader` (Node loader compatibility path)

## Notes

- Current spec baseline is `packages/compiler/docs/SPEC-v0.7.0.md`.
- FDR baseline remains `packages/compiler/docs/FDR-v0.5.0.md`.
