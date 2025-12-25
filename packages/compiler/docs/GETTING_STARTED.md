# Getting Started with @manifesto-ai/compiler

This guide walks you through setting up and using the Manifesto Compiler to transform code and natural language into Manifesto Fragments.

## Prerequisites

- Node.js 18+
- TypeScript 5.0+ (recommended)
- Basic understanding of [Manifesto Core concepts](../../core/README.md)

## Installation

```bash
# npm
npm install @manifesto-ai/compiler @manifesto-ai/core zod

# pnpm
pnpm add @manifesto-ai/compiler @manifesto-ai/core zod

# yarn
yarn add @manifesto-ai/compiler @manifesto-ai/core zod
```

## Your First Compilation

### Step 1: Create a Compiler

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});
```

### Step 2: Define an Artifact

Artifacts are the input to the compiler. The most common type is a `CodeArtifact`:

```typescript
const artifact = {
  id: 'counter-code',
  kind: 'code' as const,
  language: 'ts' as const,
  content: `
    // A simple counter
    const count: number = 0;
    const doubled = count * 2;
    const isPositive = count > 0;
  `,
};
```

### Step 3: Compile

```typescript
const result = await compiler.compile({
  artifacts: [artifact],
});

console.log('Fragments:', result.fragments.length);
console.log('Issues:', result.issues.length);
console.log('Conflicts:', result.conflicts.length);
```

### Step 4: Inspect Results

```typescript
// Check for issues
if (result.issues.length > 0) {
  for (const issue of result.issues) {
    console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
  }
}

// Check for conflicts
if (result.conflicts.length > 0) {
  for (const conflict of result.conflicts) {
    console.log(`Conflict: ${conflict.type} at ${conflict.target}`);
  }
}

// Access the domain
if (result.domain) {
  console.log('Domain generated successfully!');
  console.log('Sources:', Object.keys(result.domain.sources || {}));
  console.log('Derived:', Object.keys(result.domain.derived || {}));
}
```

## Understanding Fragments

The compiler produces **Fragments** - atomic units representing pieces of domain logic.

### Fragment Types

| Type | What it represents | Example source |
|------|-------------------|----------------|
| `SchemaFragment` | Data/state structure | `const count: number` |
| `SourceFragment` | Source path definition | `const count = 0` |
| `DerivedFragment` | Computed value | `const doubled = count * 2` |
| `ExpressionFragment` | Condition/logic | `count > 0` |
| `PolicyFragment` | Field visibility/editability | `if (isAdmin) { ... }` |
| `EffectFragment` | Side effect description | `apiCall(...)` |
| `ActionFragment` | Executable action | Button click handler |

### Inspecting Fragments

```typescript
for (const fragment of result.fragments) {
  console.log(`[${fragment.kind}] ${fragment.id}`);
  console.log(`  Provides: ${fragment.provides.join(', ')}`);
  console.log(`  Requires: ${fragment.requires.join(', ')}`);
  console.log(`  Confidence: ${fragment.confidence}`);
}
```

## The Compilation Pipeline

The compiler runs through several stages:

```
Artifacts → Pass Execution → Fragments → Linking → Verification → Domain
```

### 1. Pass Execution

Passes extract information from artifacts:

```typescript
// Compile fragments only (no linking)
const fragments = await compiler.compileFragments({
  artifacts: [artifact],
});

console.log(`Extracted ${fragments.length} fragments`);
```

### 2. Linking

Link fragments into a coherent domain:

```typescript
const linkResult = compiler.link(fragments);

console.log(`Linked: ${linkResult.fragments.length} fragments`);
console.log(`Conflicts: ${linkResult.conflicts.length}`);
console.log(`Domain ready: ${!!linkResult.domain}`);
```

### 3. Verification

Verify the linked result:

```typescript
const verifyResult = compiler.verify(linkResult);

console.log(`Valid: ${verifyResult.isValid}`);
console.log(`Errors: ${verifyResult.errorCount}`);
console.log(`Warnings: ${verifyResult.warningCount}`);
console.log(`Summary: ${verifyResult.summary}`);
```

## Handling Issues

### Issue Severity Levels

| Severity | Meaning | Blocks compilation? |
|----------|---------|---------------------|
| `error` | Must be fixed | Yes |
| `warning` | Should be reviewed | No |
| `info` | Informational | No |
| `suggestion` | Improvement hint | No |

### Common Issue Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `MISSING_DEPENDENCY` | Path referenced but not defined | Add source for path |
| `CYCLE_DETECTED` | Circular dependency found | Remove cycle |
| `DUPLICATE_PROVIDES` | Multiple fragments provide same path | Use conflict resolution |
| `INVALID_PATH` | Path format is invalid | Fix path format |

### Getting Suggested Fixes

```typescript
if (result.issues.length > 0) {
  const hints = compiler.suggestPatches(result.issues, result.conflicts);

  for (const hint of hints) {
    console.log(`Suggestion: ${hint.description}`);
  }
}
```

## Using Patches

Patches let you modify fragments incrementally.

### Creating a Patch

```typescript
import { createPatch, replaceExprOp, generatedOrigin } from '@manifesto-ai/compiler';

const patch = createPatch(
  [
    replaceExprOp('derived-doubled', ['*', ['get', 'data.count'], 10]),
  ],
  generatedOrigin('user-edit')
);
```

### Applying a Patch

```typescript
const patchResult = compiler.applyPatch(result.fragments, patch);

if (patchResult.ok) {
  console.log('Patch applied successfully');
  console.log(`Modified fragments: ${patchResult.fragments.length}`);
} else {
  console.log('Patch failed:', patchResult.failed);
}
```

### Recompile After Patch

```typescript
// Relink with patched fragments
const newLinkResult = compiler.link(patchResult.fragments);
const newVerifyResult = compiler.verify(newLinkResult);

console.log(`Still valid: ${newVerifyResult.isValid}`);
```

## Using Sessions for Observability

Sessions provide real-time feedback during compilation.

```typescript
const session = compiler.createSession();

// Watch phase changes
session.onPhaseChange((phase) => {
  console.log(`→ Phase: ${phase}`);
});

// Watch for changes
session.onSnapshotChange((snapshot) => {
  console.log(`  Fragments: ${snapshot.fragmentsCount}`);
  console.log(`  Issues: ${snapshot.issues.length}`);
});

// Compile through session
await session.compile({
  artifacts: [artifact],
});

// Get final snapshot
const snapshot = session.getSnapshot();
console.log(`Final phase: ${snapshot.phase}`);
```

## Adding LLM Support

To process natural language, add an LLM adapter:

```typescript
import { createCompiler, createAnthropicAdapter } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
  llmAdapter: createAnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  }),
});

// Now you can compile text artifacts
const result = await compiler.compile({
  artifacts: [{
    id: 'requirements',
    kind: 'text',
    format: 'markdown',
    content: `
      ## Shopping Cart
      - User can add items to cart
      - Total is sum of item prices
      - Checkout requires at least one item
    `,
  }],
});
```

## Next Steps

- [API Reference](./API.md) - Complete API documentation
- [Examples](./EXAMPLES.md) - Real-world usage examples
- [Architecture](./ARCHITECTURE.md) - System design and internals

## Troubleshooting

### "Module not found" errors

Make sure you have both packages installed:

```bash
pnpm add @manifesto-ai/compiler @manifesto-ai/core
```

### Empty fragment output

Check that your code artifact has:
- Valid TypeScript/JavaScript syntax
- Type annotations (for better extraction)
- Variable declarations with values

### LLM adapter not working

1. Verify API key is set correctly
2. Check network connectivity
3. Review LLM response in debug output

### Circular dependency detected

Use `compiler.verify()` to get detailed cycle information:

```typescript
const result = compiler.verify(linkResult);
const cycleIssues = result.issues.filter(i => i.code === 'CYCLE_DETECTED');
for (const issue of cycleIssues) {
  console.log(issue.message); // Shows cycle path
}
```
