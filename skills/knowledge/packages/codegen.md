# @manifesto-ai/codegen

> Plugin-based code generation from `DomainSchema`.

## Role

Generates typed artifacts such as TypeScript types and Zod schemas from Manifesto schemas with deterministic output ordering.

## Public API

### `generate(opts): Promise<GenerateResult>`

```typescript
interface GenerateOptions {
  schema: DomainSchema;
  outDir: string;
  plugins: readonly CodegenPlugin[];
  sourceId?: string;
  stamp?: boolean;
}
```

### Plugin model

```typescript
interface CodegenPlugin {
  name: string;
  generate(ctx: CodegenContext): CodegenOutput | Promise<CodegenOutput>;
}
```

## Notes

- Current docs live in `packages/codegen/docs/SPEC-v0.1.1.md`.
- Keep output deterministic and plugin interactions side-effect free.
