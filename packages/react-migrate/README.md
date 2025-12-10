# @manifesto-ai/react-migrate

[![npm version](https://badge.fury.io/js/@manifesto-ai%2Freact-migrate.svg)](https://www.npmjs.com/package/@manifesto-ai/react-migrate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Automatically migrate React codebases to Manifesto domain schemas. This tool analyzes your React code using AST parsing, detects patterns, and generates structured domain schemas that capture your application's entities, state, and intents.

## Features

- **AST-Based Analysis** - Fast and accurate React pattern detection using SWC
- **LLM Enhancement** - Optional enrichment via OpenAI, Anthropic, or Ollama
- **Automatic Domain Discovery** - Infers domain boundaries from dependency graphs
- **Manifesto Schema Output** - Generates JSON schemas with entities, state, and intents

## Installation

```bash
npm install @manifesto-ai/react-migrate
# or
pnpm add @manifesto-ai/react-migrate
# or
yarn add @manifesto-ai/react-migrate
```

## Quick Start

### CLI Usage

```bash
# Basic usage (requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-xxx npx @manifesto-ai/react-migrate ./src

# Specify output directory
npx @manifesto-ai/react-migrate ./src -o ./manifesto

# Run without LLM (heuristics only)
npx @manifesto-ai/react-migrate ./src --no-llm

# Dry run (preview without writing files)
npx @manifesto-ai/react-migrate ./src --dry-run --verbose
```

### Programmatic API

```typescript
import { migrate } from '@manifesto-ai/react-migrate';

const result = await migrate({
  sourceDir: './src',
  outputDir: './manifesto',
  provider: 'openai',
  verbose: true,
});

console.log(`Generated ${result.schemasGenerated} schemas`);
console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
```

## CLI Reference

```
Usage:
  react-migrate <sourceDir> [options]

Arguments:
  sourceDir              Source directory containing React code

Options:
  -o, --output <dir>     Output directory (default: ./manifesto)
  --no-llm               Skip LLM enrichment (use heuristics only)
  --provider <name>      LLM provider: openai, anthropic, ollama (default: openai)
  --dry-run              Preview without writing files
  -v, --verbose          Enable verbose output
  -h, --help             Show help

Environment Variables:
  OPENAI_API_KEY         Required for OpenAI provider
  ANTHROPIC_API_KEY      Required for Anthropic provider
  OLLAMA_HOST            Ollama server URL (default: http://localhost:11434)
```

## API Reference

### `migrate(options): Promise<MigrateResult>`

The main migration function that orchestrates the entire pipeline.

```typescript
interface MigrateOptions {
  /** Source directory to analyze */
  sourceDir: string;
  /** Output directory for generated schemas */
  outputDir: string;
  /** File patterns to include (default: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']) */
  include?: string[];
  /** File patterns to exclude (default: ['node_modules', 'dist', ...]) */
  exclude?: string[];
  /** LLM provider to use */
  provider?: 'openai' | 'anthropic' | 'ollama' | 'mock';
  /** Skip LLM enrichment */
  noLLM?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Preview without writing files */
  dryRun?: boolean;
}

interface MigrateResult {
  /** Number of files scanned */
  filesScanned: number;
  /** Number of React files analyzed */
  filesAnalyzed: number;
  /** Number of patterns detected */
  patternsDetected: number;
  /** Number of domains discovered */
  domainsDiscovered: number;
  /** Number of schema files generated */
  schemasGenerated: number;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Generated schema files */
  schemas: Array<{
    name: string;     // e.g., 'auth.domain.json'
    path: string;     // Absolute file path
    content: unknown; // Schema object
  }>;
}
```

### Low-Level API

For pipeline customization, individual modules are available:

```typescript
import {
  // Parser
  scanFiles,
  analyzeFile,
  isReactFile,

  // Analyzer
  analyzer,

  // Summarizer
  summarizer,

  // Transformer
  transformer,

  // LLM
  createProvider,
  loadProviderFromEnv,
} from '@manifesto-ai/react-migrate';
```

#### File Scanning and Analysis

```typescript
// Scan files
const files = await scanFiles({
  rootDir: './src',
  include: ['**/*.tsx'],
  exclude: ['**/*.test.tsx'],
});

// Filter and analyze React files
const reactFiles = files.filter(f => isReactFile(f.content));
const analyses = reactFiles.map(f => analyzeFile(f));

// Inspect detected patterns
analyses.forEach(analysis => {
  analysis.patterns.forEach(pattern => {
    console.log(`[${pattern.type}] ${pattern.name} (${pattern.confidence})`);
  });
});
```

#### Analyzer - Dependency Analysis

```typescript
// Build dependency graph
const graph = analyzer.buildDependencyGraph(analyses);
console.log(`Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);

// Extract domain candidates
let analyzerState = analyzer.createInitialState();
for (const analysis of analyses) {
  analyzerState = analyzer.aggregatePatterns(analyzerState, analysis);
}

const candidates = analyzer.extractDomainCandidates(
  analyzerState.patterns,
  analyses,
  graph
);
```

#### Summarizer - Clustering and Schema Proposals

```typescript
// Perform clustering
const clusteringResult = summarizer.performClustering(candidates, graph, 1);

// Generate domain summaries
const domainSummaries = summarizer.clustersToDomainSummaries(
  clusteringResult.clusters,
  candidates
);

// Generate schema proposals
const proposal = summarizer.generateSchemaProposal(
  domain,
  patterns,
  [],
  { confidenceThreshold: 0.7 }
);
```

#### Transformer - Schema Generation

```typescript
// Generate Manifesto schema
const schema = transformer.generateManifestoSchema(proposal, domain, {
  schemaVersion: '1.0.0',
});

// Validate schema
const validation = transformer.validateGeneratedSchema(schema);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## Output Schema Format

Generated `*.domain.json` files follow this structure:

```json
{
  "$schema": "https://manifesto.ai/schema/domain/1.0.0",
  "domain": "auth",
  "version": "1.0.0",
  "entities": {
    "AuthState": {
      "type": "object",
      "description": "Entity: AuthState",
      "fields": {
        "user": { "type": "User | null" },
        "isAuthenticated": { "type": "boolean" },
        "isLoading": { "type": "boolean" },
        "error": { "type": "string | null" }
      }
    },
    "LoginFormProps": {
      "type": "object",
      "fields": {
        "onSuccess": { "type": "function" },
        "redirectTo": { "type": "string" }
      }
    }
  },
  "state": {
    "user": {
      "type": "User | null",
      "description": "State field from AuthState"
    },
    "isAuthenticated": {
      "type": "boolean",
      "description": "State field from AuthState"
    }
  },
  "intents": {
    "login": {
      "type": "command",
      "description": "command: login"
    },
    "logout": {
      "type": "command",
      "description": "command: logout"
    },
    "authSuccess": {
      "type": "event",
      "description": "event: authSuccess"
    },
    "authFailure": {
      "type": "event",
      "description": "event: authFailure"
    }
  },
  "metadata": {
    "generatedAt": 1702234567890,
    "generatedBy": "@manifesto-ai/react-migrate",
    "sourceFiles": [
      "src/features/auth/AuthContext.tsx",
      "src/features/auth/useAuth.ts"
    ],
    "confidence": 0.89
  }
}
```

## Pattern Detection

The following React patterns are automatically detected:

| Pattern | Detection Method | Extracted Information |
|---------|------------------|----------------------|
| **Component** | PascalCase function returning JSX | Props interface, children |
| **Hook** | `use*` prefix functions | Return type, dependencies |
| **Context** | `createContext`, `useContext` | Context value shape |
| **Reducer** | `useReducer`, reducer functions | State shape, action types |
| **Effect** | `useEffect`, `useLayoutEffect` | Dependencies array |

## LLM Integration

LLM providers enhance heuristic-based extraction with:

- **Entity Enrichment** - Better naming and field descriptions
- **Action Classification** - Accurate command/query/event typing
- **Relationship Analysis** - Cross-domain dependency insights

### Supported Providers

| Provider | Environment Variable | Default Model |
|----------|---------------------|---------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-5-haiku-latest |
| Ollama | `OLLAMA_HOST` | llama3.2 |

### Running Without LLM

Use the `--no-llm` flag for pure heuristic mode:

```bash
npx @manifesto-ai/react-migrate ./src --no-llm
```

AST-based pattern detection works fully without LLM. Confidence scores may be slightly lower.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Parser    │────▶│   Analyzer   │────▶│  Summarizer │────▶│ Transformer │
│  (SWC AST)  │     │ (Dependency) │     │ (Clustering)│     │  (Schema)   │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │                    │
      ▼                    ▼                    ▼                    ▼
  Patterns          DomainCandidates      SchemaProposals      domain.json
  extracted            extracted            generated             files
```

### Pipeline Stages

1. **Parser** - Parses source files using SWC, detects React patterns
2. **Analyzer** - Builds dependency graph, extracts domain candidates
3. **Summarizer** - Clusters files, generates schema proposals, applies LLM enrichment
4. **Transformer** - Produces validated Manifesto JSON schemas

## Examples

### Migrating a SaaS Application

```bash
# Migrate a 32-file SaaS app with 8 feature domains
OPENAI_API_KEY=sk-xxx npx @manifesto-ai/react-migrate ./src -o ./manifesto -v

# Output:
#   Files scanned:    32
#   Files analyzed:   31
#   Patterns found:   170
#   Domains found:    11
#   Schemas created:  11
#   Confidence:       89.2%
```

### Custom Pipeline with LLM

```typescript
import {
  scanFiles,
  analyzeFile,
  analyzer,
  summarizer,
  extractEntitiesWithLLM,
  createProvider,
  loadProviderFromEnv,
} from '@manifesto-ai/react-migrate';

async function customMigration() {
  // Setup LLM provider
  const llmConfig = loadProviderFromEnv('openai');
  const llm = createProvider(llmConfig);

  // Scan specific feature
  const files = await scanFiles({
    rootDir: './src/features/auth',
    include: ['**/*.tsx'],
  });

  // Analyze files
  const analyses = files.map(f => analyzeFile(f));
  const patterns = analyses.flatMap(a => a.patterns);

  // Extract entities with LLM enhancement
  const entities = await extractEntitiesWithLLM(patterns, 'auth', {
    provider: llm,
    enableFallback: true,
    maxRetries: 2,
    timeout: 30000,
  });

  console.log('Extracted entities:', entities);
}
```

## Troubleshooting

### "No React files found"

- Verify `include` patterns match your file extensions (default: `**/*.tsx`)
- Ensure files contain JSX or React imports

### "LLM request timed out"

- Test with `--no-llm` first to isolate the issue
- Check network connectivity
- Try a different provider (`--provider anthropic`)

### "0 patterns detected"

- Confirm files contain React components or hooks
- Use `-v` flag for detailed logging
- Check that files are not excluded by default patterns

## Requirements

- Node.js 18+
- TypeScript/JavaScript React codebase

## License

MIT

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) before submitting a Pull Request.

- [Report Issues](https://github.com/manifesto-ai/core/issues)
- [Submit Pull Requests](https://github.com/manifesto-ai/core/pulls)

## Related

- [@manifesto-ai/core](../core) - Core Manifesto runtime
- [Manifesto Documentation](https://manifesto.ai/docs)
