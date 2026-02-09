# @manifesto-ai/codegen v0.1.0

> Plugin-based code generation from DomainSchema.

## Role

Generates typed artifacts (TypeScript types, Zod schemas) from DomainSchema with deterministic output.

## Dependencies

- Peer: `@manifesto-ai/core` ~2.0.0

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

interface GenerateResult {
  files: ReadonlyArray<{ path: string; content: string }>;
  artifacts: Record<string, unknown>;
  diagnostics: readonly Diagnostic[];
}
```

### Plugin Interface

```typescript
interface CodegenPlugin {
  name: string;
  generate(ctx: CodegenContext): CodegenOutput | Promise<CodegenOutput>;
}

interface CodegenOutput {
  patches: readonly FilePatch[];
  artifacts?: Record<string, unknown>;
  diagnostics?: readonly Diagnostic[];
}

type FilePatch =
  | { op: 'set'; path: string; content: string }
  | { op: 'delete'; path: string };
```

### Built-in Plugins

```typescript
// TypeScript types from schema
createTsPlugin(options?: { typesFile?: string; actionsFile?: string }): CodegenPlugin

// Zod schemas from schema
createZodPlugin(options?: { schemasFile?: string }): CodegenPlugin
```

### Utilities

```typescript
validatePath(path): PathValidationResult
stableHash(input): string
generateHeader(options?): string
```

## Execution Rules

- Plugins run sequentially in array order
- Each plugin receives frozen artifact snapshot (no cross-plugin mutation)
- Lexicographic output ordering for determinism
- Error gating: errors halt pipeline
