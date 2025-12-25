# @manifesto-ai/compiler API Reference

Complete API documentation for all exports.

## Table of Contents

- [Compiler](#compiler)
- [Fragment](#fragment)
- [Pass System](#pass-system)
- [Linker](#linker)
- [Verifier](#verifier)
- [Patch](#patch)
- [LLM Adapters](#llm-adapters)
- [Types](#types)

---

## Compiler

### createCompiler

Create a new compiler instance.

```typescript
function createCompiler(config: ExtendedCompilerConfig): Compiler
```

#### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `config` | `ExtendedCompilerConfig` | Yes | Compiler configuration |

#### Config Options

```typescript
interface ExtendedCompilerConfig {
  coreVersion: string;              // Required: @manifesto-ai/core version
  effectPolicy?: {
    maxRisk?: 'low' | 'medium' | 'high' | 'critical';
  };
  linker?: LinkOptions;             // Linker configuration
  verifier?: VerifyOptions;         // Verifier configuration
  codebook?: Codebook;              // Initial codebook for aliasing
  llmAdapter?: LLMAdapter;          // LLM adapter for NL processing
  passes?: {
    useDefaults?: boolean;          // Use default passes (default: true)
    disabled?: string[];            // Pass names to disable
    custom?: Pass[];                // Custom passes to add
  };
}
```

#### Returns

```typescript
interface Compiler {
  readonly config: ExtendedCompilerConfig;
  readonly codebook: Codebook | undefined;

  compile(input: CompileInput, options?: CompileOptions): Promise<CompileResult>;
  compileFragments(input: CompileInput, selection?: ArtifactSelection): Promise<Fragment[]>;
  link(fragments: Fragment[], patches?: Patch[]): LinkResult;
  verify(target: DomainDraft | LinkResult): VerifyResult;
  suggestPatches(issues?: Issue[], conflicts?: Conflict[]): PatchHint[];
  applyPatch(fragments: Fragment[], patch: Patch): ApplyPatchResult;
  createSession(): CompilerSession;
}
```

#### Example

```typescript
import { createCompiler, createAnthropicAdapter } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
  effectPolicy: { maxRisk: 'medium' },
  llmAdapter: createAnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  }),
});

const result = await compiler.compile({
  artifacts: [{
    id: 'my-code',
    kind: 'code',
    language: 'ts',
    content: 'const count: number = 0;',
  }],
});
```

---

### CompilerSession

Stateful compilation with observability.

```typescript
const session = compiler.createSession();
```

#### Methods

| Method | Description |
|--------|-------------|
| `getSnapshot()` | Get current session snapshot |
| `compile(input, options?)` | Compile with session tracking |
| `onPhaseChange(callback)` | Subscribe to phase changes |
| `onSnapshotChange(callback)` | Subscribe to snapshot changes |
| `subscribePath(path, callback)` | Subscribe to specific path changes |
| `subscribeEvents(channel, callback)` | Subscribe to event channel |
| `getRuntime()` | Get underlying compiler runtime |

#### Session Phases

```typescript
type CompilerPhase =
  | 'idle'
  | 'parsing'
  | 'extracting'
  | 'lowering'
  | 'linking'
  | 'verifying'
  | 'repairing'
  | 'done'
  | 'error';
```

#### Example

```typescript
const session = compiler.createSession();

session.onPhaseChange((phase) => {
  console.log(`Phase: ${phase}`);
});

session.onSnapshotChange((snapshot) => {
  console.log(`Fragments: ${snapshot.fragmentsCount}`);
  console.log(`Issues: ${snapshot.issues.length}`);
});

await session.compile({
  artifacts: [{ id: 'code', kind: 'code', language: 'ts', content: '...' }],
});
```

---

## Fragment

### Fragment Creation Functions

| Function | Creates | Description |
|----------|---------|-------------|
| `createSchemaFragment(options)` | `SchemaFragment` | Data/state schema fields |
| `createSourceFragment(options)` | `SourceFragment` | Source path definitions |
| `createExpressionFragment(options)` | `ExpressionFragment` | Computed expressions |
| `createDerivedFragment(options)` | `DerivedFragment` | Derived value definitions |
| `createPolicyFragment(options)` | `PolicyFragment` | Field policies |
| `createEffectFragment(options)` | `EffectFragment` | Side effect descriptions |
| `createActionFragment(options)` | `ActionFragment` | Executable actions |
| `createStatementFragment(options)` | `StatementFragment` | Generic statements |

### createSchemaFragment

```typescript
function createSchemaFragment(options: CreateSchemaFragmentOptions): SchemaFragment
```

#### Options

```typescript
interface CreateSchemaFragmentOptions {
  namespace: 'data' | 'state';
  fields: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  origin: Provenance;
  confidence?: number;
  evidence?: Evidence[];
}
```

#### Example

```typescript
import { createSchemaFragment, codeOrigin } from '@manifesto-ai/compiler';

const fragment = createSchemaFragment({
  namespace: 'data',
  fields: [
    { name: 'count', type: 'number', description: 'Counter value' },
    { name: 'name', type: 'string', description: 'User name' },
  ],
  origin: codeOrigin('counter.ts', { line: 1, column: 0 }),
  confidence: 1.0,
});
```

---

### createSourceFragment

```typescript
function createSourceFragment(options: CreateSourceFragmentOptions): SourceFragment
```

#### Options

```typescript
interface CreateSourceFragmentOptions {
  path: SemanticPath;
  schema: { type: string } | object;
  defaultValue?: unknown;
  semantic?: SemanticMeta;
  origin: Provenance;
  confidence?: number;
}
```

#### Example

```typescript
const fragment = createSourceFragment({
  path: 'data.count',
  schema: { type: 'number' },
  defaultValue: 0,
  semantic: { type: 'number', description: 'Counter value' },
  origin: codeOrigin('counter.ts', { line: 1, column: 0 }),
});
```

---

### createDerivedFragment

```typescript
function createDerivedFragment(options: CreateDerivedFragmentOptions): DerivedFragment
```

#### Options

```typescript
interface CreateDerivedFragmentOptions {
  path: SemanticPath;
  deps: SemanticPath[];
  expr: Expression;
  semantic?: SemanticMeta;
  origin: Provenance;
  confidence?: number;
}
```

#### Example

```typescript
const fragment = createDerivedFragment({
  path: 'derived.doubled',
  deps: ['data.count'],
  expr: ['*', ['get', 'data.count'], 2],
  origin: codeOrigin('counter.ts', { line: 2, column: 0 }),
});
```

---

### Stable ID Functions

| Function | Description |
|----------|-------------|
| `generateStableFragmentId(kind, origin)` | Generate deterministic fragment ID |
| `generateRandomFragmentId(kind)` | Generate random fragment ID |
| `fragmentIdMatchesKind(id, kind)` | Check if ID matches kind |
| `extractKindFromFragmentId(id)` | Extract kind from fragment ID |

---

### Fragment Utilities

| Function | Description |
|----------|-------------|
| `cloneFragment(fragment)` | Deep clone a fragment |
| `updateFragmentRequires(fragment, requires)` | Update requires array |
| `addEvidence(fragment, evidence)` | Add evidence to fragment |
| `setConfidence(fragment, confidence)` | Set confidence score |

---

## Pass System

### PassRegistry

Manages registered passes.

```typescript
import { createPassRegistry, PassRegistry } from '@manifesto-ai/compiler';

const registry: PassRegistry = createPassRegistry();
registry.register(myCustomPass);
```

#### Methods

| Method | Description |
|--------|-------------|
| `register(pass)` | Register a pass |
| `unregister(name)` | Unregister a pass by name |
| `get(name)` | Get a pass by name |
| `getAll()` | Get all registered passes |
| `getSorted()` | Get passes sorted by priority |

---

### PassExecutor

Executes passes on artifacts.

```typescript
import { createPassExecutor } from '@manifesto-ai/compiler';

const executor = createPassExecutor(registry);
const result = await executor.execute(artifact, options);
```

#### Methods

| Method | Description |
|--------|-------------|
| `execute(artifact, options?)` | Execute all passes on artifact |

#### Example

```typescript
const registry = createPassRegistry();
registry.register(codeAstExtractorPass);
registry.register(schemaPass);

const executor = createPassExecutor(registry);

const result = await executor.execute({
  id: 'code-1',
  kind: 'code',
  language: 'ts',
  content: 'const count: number = 10;',
});

console.log(result.fragments); // Extracted fragments
```

---

### Pass Interface

```typescript
interface Pass {
  name: string;
  priority: number;
  supports(artifact: Artifact): boolean;
  analyze(artifact: Artifact): Promise<Finding[]>;
  compile(findings: Finding[], context: PassContext): Promise<Fragment[]>;
}

interface NLPass extends Pass {
  kind: 'nl';
  compile(findings: Finding[], context: PassContext): Promise<{
    fragments: Fragment[];
    drafts: FragmentDraft[];
  }>;
}
```

---

### Built-in Passes

| Pass | Priority | Description |
|------|----------|-------------|
| `codeAstExtractorPass` | 0 | Extract AST from code artifacts |
| `schemaPass` | 100 | Generate SchemaFragment from variables |
| `expressionLoweringPass` | 200 | Lower conditions to ExpressionFragment |
| `effectLoweringPass` | 300 | Lower side effects to EffectFragment |
| `policyLoweringPass` | 400 | Lower policies to PolicyFragment |
| `actionPass` | 500 | Assemble ActionFragment |
| `createNLExtractorPass(opts)` | 900 | NL to FragmentDraft (requires LLM) |

---

## Linker

### link

Link fragments into a domain.

```typescript
function link(fragments: Fragment[], options?: LinkOptions): LinkResult
```

#### Options

```typescript
interface LinkOptions {
  mergeStrategy?: 'union' | 'first' | 'last';  // default: 'union'
  sortFragments?: boolean;                      // default: true
  sortResults?: boolean;                        // default: true
  buildDomain?: boolean;                        // default: true
  codebook?: Codebook;                          // For alias resolution
  generateAliasSuggestions?: boolean;           // default: false
}
```

#### Returns

```typescript
interface LinkResult {
  fragments: Fragment[];
  domain?: DomainDraft;
  conflicts: Conflict[];
  issues: Issue[];
  version: string;
}
```

#### Example

```typescript
import { link } from '@manifesto-ai/compiler';

const result = link(fragments, {
  mergeStrategy: 'union',
  buildDomain: true,
});

if (result.conflicts.length > 0) {
  console.log('Conflicts detected:', result.conflicts);
}

if (result.domain) {
  console.log('Domain ready:', result.domain);
}
```

---

### Linker Functions

| Function | Description |
|----------|-------------|
| `link(fragments, options?)` | Main linking entry point |
| `linkExtended(fragments, options?)` | Link with extended debug info |
| `incrementalLink(previous, changed, removed, options?)` | Incremental update |
| `normalizeAllFragments(fragments)` | Normalize paths in fragments |
| `buildFragmentDependencyGraph(fragments)` | Build dependency graph |
| `detectConflicts(fragments)` | Detect path conflicts |
| `mergeFragments(fragments, options?)` | Merge compatible fragments |
| `buildDomainDraft(fragments, options?)` | Build domain from fragments |

---

### Utility Functions

| Function | Description |
|----------|-------------|
| `isLinkResultValid(result)` | Check if result is valid |
| `getBlockingIssues(result)` | Get error-level issues |
| `getLinkResultSummary(result)` | Get human-readable summary |
| `getAllProvidedPaths(result)` | Get all provided semantic paths |
| `getAllProvidedActions(result)` | Get all provided action IDs |

---

## Verifier

### verify

Verify a link result.

```typescript
function verify(linkResult: LinkResult, options?: VerifyOptions): VerifyResult
```

#### Options

```typescript
interface VerifyOptions {
  checkCycles?: boolean;           // default: true
  checkDependencies?: boolean;     // default: true
  checkTypes?: boolean;            // default: true
  checkPolicies?: boolean;         // default: true
  checkEffects?: boolean;          // default: true
  checkActions?: boolean;          // default: true
  checkProvenance?: boolean;       // default: true
  checkPaths?: boolean;            // default: true
  maxEffectRisk?: 'low' | 'medium' | 'high' | 'critical';
  treatWarningsAsErrors?: boolean; // default: false
}
```

#### Returns

```typescript
interface VerifyResult {
  isValid: boolean;
  issues: Issue[];
  errorCount: number;
  warningCount: number;
  summary: string;
  dagResult?: DagValidationResult;
  staticResult?: StaticValidationResult;
}
```

#### Example

```typescript
import { verify, verifyFull } from '@manifesto-ai/compiler';

// Quick verify
const result = verify(linkResult);
console.log(`Valid: ${result.isValid}`);
console.log(`Summary: ${result.summary}`);

// Full verification
const fullResult = verifyFull(linkResult);
```

---

### Verifier Functions

| Function | Description |
|----------|-------------|
| `verify(linkResult, options?)` | Main verification |
| `verifyFull(linkResult)` | Full verification with all checks |
| `verifyFragments(fragments, options?)` | Verify fragments directly |
| `quickVerifyIsValid(linkResult)` | Quick validity check |
| `validateDag(linkResult)` | DAG-only validation |
| `validateStatic(linkResult, options?)` | Static-only validation |
| `hasCycles(linkResult)` | Check for cycles |
| `hasAllDependencies(linkResult)` | Check dependency completeness |

---

## Patch

### Patch Operations

#### createPatch

Create a patch from operations.

```typescript
function createPatch(ops: PatchOp[], origin: Provenance): Patch
```

#### Operation Factories

| Function | Description |
|----------|-------------|
| `replaceExprOp(fragmentId, expr)` | Replace expression |
| `addDepOp(fragmentId, dep)` | Add dependency |
| `removeFragmentOp(fragmentId)` | Remove fragment |
| `addFragmentOp(fragment)` | Add new fragment |
| `renamePathOp(from, to)` | Rename path globally |
| `chooseConflictOp(conflictId, chosenFragmentId)` | Resolve conflict |

#### Example

```typescript
import { createPatch, replaceExprOp, addDepOp, generatedOrigin } from '@manifesto-ai/compiler';

const patch = createPatch(
  [
    replaceExprOp('derived-1', ['*', ['get', 'data.count'], 10]),
    addDepOp('derived-1', 'data.multiplier'),
  ],
  generatedOrigin('user-edit')
);
```

---

### applyPatch

Apply a patch to fragments.

```typescript
function applyPatch(
  fragments: Fragment[],
  patch: Patch,
  codebook?: Codebook
): ApplyPatchResult
```

#### Returns

```typescript
interface ApplyPatchResult {
  ok: boolean;
  fragments: Fragment[];
  applied: PatchOp[];
  failed: Array<{ op: PatchOp; error: string }>;
  codebook?: Codebook;
}
```

#### Example

```typescript
import { applyPatch, createPatch, replaceExprOp } from '@manifesto-ai/compiler';

const patch = createPatch(
  [replaceExprOp('frag-1', ['literal', 42])],
  generatedOrigin('fix')
);

const result = applyPatch(fragments, patch);
if (result.ok) {
  console.log('Patch applied:', result.fragments);
} else {
  console.log('Failed ops:', result.failed);
}
```

---

### Codebook (Path Aliasing)

```typescript
import {
  createCodebook,
  addAliasSuggestion,
  applyAlias,
  resolveToCanonical,
} from '@manifesto-ai/compiler';

// Create empty codebook
const codebook = createCodebook();

// Add alias suggestion
const updated = addAliasSuggestion(codebook, {
  aliasPath: 'data.cnt',
  canonicalPath: 'data.count',
  confidence: 0.9,
  similarityType: 'abbreviation',
});

// Apply suggestion
const applied = applyAlias(updated, 'alias-id-here');

// Resolve path
const canonical = resolveToCanonical(applied, 'data.cnt'); // 'data.count'
```

---

### Similarity Analysis

```typescript
import {
  findSimilarPaths,
  clusterSimilarPaths,
  detectDuplicatePaths,
} from '@manifesto-ai/compiler';

// Find similar paths
const similar = findSimilarPaths(fragments, 'data.count', 0.7);

// Cluster by similarity
const clusters = clusterSimilarPaths(fragments, 0.8);

// Detect potential duplicates
const duplicates = detectDuplicatePaths(fragments);
```

---

## LLM Adapters

### createAnthropicAdapter

Create Anthropic Claude adapter.

```typescript
function createAnthropicAdapter(config: AnthropicAdapterConfig): LLMAdapter
```

#### Config

```typescript
interface AnthropicAdapterConfig {
  apiKey: string;                    // Required
  model?: string;                    // default: 'claude-sonnet-4-20250514'
  baseUrl?: string;                  // Custom API endpoint
  maxTokens?: number;                // default: 4096
  temperature?: number;              // default: 0.1
  maxRetries?: number;               // default: 3
  rateLimit?: number;                // Requests per minute
  timeout?: number;                  // Request timeout in ms
  maxConfidence?: number;            // default: 0.9
}
```

#### Example

```typescript
import { createAnthropicAdapter } from '@manifesto-ai/compiler';

const adapter = createAnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.1,
});
```

---

### createOpenAIAdapter

Create OpenAI GPT adapter.

```typescript
function createOpenAIAdapter(config: OpenAIAdapterConfig): LLMAdapter
```

#### Config

```typescript
interface OpenAIAdapterConfig {
  apiKey: string;                    // Required
  model?: string;                    // default: 'gpt-4o'
  baseUrl?: string;                  // Custom API endpoint
  organization?: string;             // OpenAI organization ID
  maxTokens?: number;                // default: 4096
  temperature?: number;              // default: 0.1
  maxRetries?: number;               // default: 3
  rateLimit?: number;                // Requests per minute
  timeout?: number;                  // Request timeout in ms
  maxConfidence?: number;            // default: 0.85
}
```

#### Example

```typescript
import { createOpenAIAdapter } from '@manifesto-ai/compiler';

const adapter = createOpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
  organization: 'org-xxx',
});
```

---

### LLM Utilities

| Function | Description |
|----------|-------------|
| `hashPrompt(prompt)` | Generate hash for provenance |
| `RateLimiter` | Rate limiter class |
| `withRetry(fn, config)` | Retry wrapper with backoff |
| `parseJSON(text)` | Parse JSON safely |
| `parseJSONArray(text)` | Parse JSON array safely |
| `estimateTokens(text)` | Estimate token count |

---

### Prompt Building

```typescript
import { buildSystemPrompt, buildUserPrompt, buildMessages } from '@manifesto-ai/compiler';

// Build system prompt for schema extraction
const systemPrompt = buildSystemPrompt('schema');

// Build user prompt from artifact
const userPrompt = buildUserPrompt(artifact, context);

// Build complete message array
const messages = buildMessages(artifact, {
  mode: 'schema',
  context: { existingPaths: [...] },
});
```

---

## Types

### Fragment Types

```typescript
type FragmentKind =
  | 'SchemaFragment'
  | 'SourceFragment'
  | 'ExpressionFragment'
  | 'DerivedFragment'
  | 'PolicyFragment'
  | 'EffectFragment'
  | 'ActionFragment'
  | 'StatementFragment';

interface Fragment {
  id: FragmentId;
  kind: FragmentKind;
  requires: string[];
  provides: string[];
  origin: Provenance;
  confidence: number;
  evidence: Evidence[];
  compilerVersion: string;
  tags: string[];
}
```

---

### Artifact Types

```typescript
type ArtifactKind = 'code' | 'text' | 'manifesto';

interface CodeArtifact {
  id: string;
  kind: 'code';
  language: 'ts' | 'js' | 'tsx' | 'jsx';
  content: string;
  metadata?: Record<string, unknown>;
}

interface TextArtifact {
  id: string;
  kind: 'text';
  format: 'markdown' | 'plain';
  content: string;
  metadata?: Record<string, unknown>;
}

interface ManifestoArtifact {
  id: string;
  kind: 'manifesto';
  fragments: Fragment[];
  metadata?: Record<string, unknown>;
}

type Artifact = CodeArtifact | TextArtifact | ManifestoArtifact;
```

---

### Provenance Types

```typescript
type ProvenanceKind = 'code' | 'nl' | 'user' | 'generated' | 'llm';

interface Provenance {
  kind: ProvenanceKind;
  source?: string;
  location?: OriginLocation;
  model?: string;         // For LLM
  promptHash?: string;    // For LLM
  user?: string;          // For user edits
}

// Factory functions
function codeOrigin(source: string, location?: OriginLocation): Provenance;
function nlOrigin(source: string, location?: OriginLocation): Provenance;
function userOrigin(user: string): Provenance;
function generatedOrigin(generator: string): Provenance;
function llmOrigin(model: string, promptHash: string): Provenance;
```

---

### Issue Types

```typescript
type IssueSeverity = 'error' | 'warning' | 'info' | 'suggestion';

type IssueCode =
  | 'MISSING_DEPENDENCY'
  | 'CYCLE_DETECTED'
  | 'INVALID_PATH'
  | 'DUPLICATE_PROVIDES'
  | 'SCHEMA_MISMATCH'
  | 'INVALID_EXPRESSION'
  | 'INVALID_EFFECT'
  | 'MISSING_PROVENANCE'
  | 'EFFECT_RISK_TOO_HIGH'
  // ... and more

interface Issue {
  id: string;
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  path?: SemanticPath;
  fragmentId?: FragmentId;
  suggestedFix?: PatchHint;
}
```

---

### Conflict Types

```typescript
type ConflictType =
  | 'duplicate_provides'
  | 'schema_mismatch'
  | 'semantic_mismatch'
  | 'dependency_conflict'
  | 'effect_incompatible';

interface Conflict {
  id: string;
  type: ConflictType;
  target: SemanticPath | string;
  candidates: FragmentId[];
  description: string;
  suggestedResolutions?: PatchHint[];
}
```

---

### Patch Types

```typescript
type PatchOpType =
  | 'replaceExpr'
  | 'addDep'
  | 'removeDep'
  | 'renamePath'
  | 'removeFragment'
  | 'addFragment'
  | 'chooseConflict'
  | 'updateSchemaField'
  | 'applyAlias'
  | 'rejectAlias';

interface PatchOp {
  op: PatchOpType;
  // ... operation-specific fields
}

interface Patch {
  id: PatchId;
  ops: PatchOp[];
  origin: Provenance;
  reason?: string;
  createdAt: number;
}

interface PatchHint {
  description: string;
  patch: Partial<PatchOp>;
  confidence?: number;
}
```

---

### CompileResult

```typescript
interface CompileResult {
  fragments: Fragment[];
  domain?: DomainDraft;
  issues: Issue[];
  conflicts: Conflict[];
  provenance: Map<FragmentId, Provenance>;
}

interface CompileOptions {
  skipVerification?: boolean;
  patches?: Patch[];
}

interface CompileInput {
  artifacts: Artifact[];
  selection?: ArtifactSelection;
}
```
