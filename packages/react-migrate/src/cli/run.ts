#!/usr/bin/env node
/**
 * One-shot Migration Runner
 *
 * 인터랙티브 UI 없이 마이그레이션을 자동으로 실행합니다.
 * npx react-migrate run ./src --output ./manifesto
 */

import path from 'path';
import fs from 'fs/promises';
import {
  scanFiles,
  analyzeFile,
  isReactFile,
  analyzer,
  summarizer,
  transformer,
  createProvider,
  loadProviderFromEnv,
  prompts,
  type LLMProvider,
} from '../index.js';
import type { LLMServiceConfig } from '../domains/summarizer/llm-service.js';
import {
  extractEntitiesWithLLM,
  extractActionsWithLLM,
} from '../domains/summarizer/llm-service.js';

export interface MigrateOptions {
  /** Source directory to analyze */
  sourceDir: string;
  /** Output directory for generated schemas */
  outputDir: string;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** LLM provider to use */
  provider?: 'openai' | 'anthropic' | 'ollama' | 'mock';
  /** Skip LLM enrichment */
  noLLM?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Dry run (don't write files) */
  dryRun?: boolean;
}

export interface MigrateResult {
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
  /** Generated schema files */
  schemas: Array<{
    name: string;
    path: string;
    content: unknown;
  }>;
  /** Overall confidence score */
  confidence: number;
}

/**
 * Run migration pipeline
 */
export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
  const {
    sourceDir,
    outputDir,
    include = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    exclude = ['node_modules', 'dist', 'build', '*.test.*', '*.spec.*', '__tests__'],
    provider = 'openai',
    noLLM = false,
    verbose = false,
    dryRun = false,
  } = options;

  const log = verbose ? console.log : () => {};

  // Resolve paths
  const resolvedSourceDir = path.resolve(sourceDir);
  const resolvedOutputDir = path.resolve(outputDir);

  log(`\nSource: ${resolvedSourceDir}`);
  log(`Output: ${resolvedOutputDir}`);

  // Initialize LLM Provider
  let llm: LLMProvider | null = null;
  let llmServiceConfig: LLMServiceConfig | null = null;

  if (!noLLM) {
    try {
      const config = loadProviderFromEnv(provider);
      if (config.apiKey || provider === 'ollama' || provider === 'mock') {
        llm = createProvider(config);
        llmServiceConfig = {
          provider: llm,
          enableFallback: true,
          maxRetries: 2,
          timeout: 30000,
        };
        log(`LLM: ${provider} (${config.defaultModel})`);
      }
    } catch (e) {
      log(`LLM not available: ${e}`);
    }
  }

  // Phase 1: Scan and Parse
  log('\n[1/4] Scanning files...');
  const scannedFiles = await scanFiles({
    rootDir: resolvedSourceDir,
    include,
    exclude,
  });
  log(`  Found ${scannedFiles.length} files`);

  const reactFiles = scannedFiles.filter(f => isReactFile(f.content));
  log(`  React files: ${reactFiles.length}`);

  const analyses = reactFiles.map(f => analyzeFile(f));
  const allPatterns = analyses.flatMap(a => a.patterns);
  log(`  Patterns: ${allPatterns.length}`);

  // Phase 2: Analyze
  log('\n[2/4] Analyzing dependencies...');
  let analyzerData = analyzer.createInitialData({ confidenceThreshold: 0.7, enableLLMFallback: true });
  let analyzerState = analyzer.createInitialState();

  const graph = analyzer.buildDependencyGraph(analyses);
  log(`  Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  for (const analysis of analyses) {
    analyzerData = analyzer.addResult(analyzerData, analysis);
    analyzerState = analyzer.aggregatePatterns(analyzerState, analysis);
  }

  const candidates = analyzer.extractDomainCandidates(analyzerState.patterns, analyses, graph);
  for (const candidate of candidates) {
    analyzerData = analyzer.addDomainCandidate(analyzerData, candidate);
  }
  log(`  Domains: ${candidates.length}`);

  // Phase 3: Summarize
  log('\n[3/4] Generating schemas...');
  let summarizerData = summarizer.createInitialData('analyzer');
  let summarizerState = summarizer.createInitialState();

  const clusteringResult = summarizer.performClustering(
    Object.values(analyzerData.domainCandidates),
    graph,
    1
  );

  const domainSummaries = summarizer.clustersToDomainSummaries(
    clusteringResult.clusters,
    Object.values(analyzerData.domainCandidates)
  );

  for (const domain of domainSummaries) {
    summarizerData = summarizer.addDomain(summarizerData, domain);
  }

  // Generate proposals with optional LLM enrichment
  for (const domain of domainSummaries) {
    const domainPatterns = allPatterns.filter(p => {
      const sourceFile = p.metadata.sourceFile as string | undefined;
      return sourceFile && domain.sourceFiles.includes(sourceFile);
    });

    const matchingPatterns = domainPatterns.length > 0
      ? domainPatterns
      : allPatterns.filter(p =>
          domain.sourceFiles.some(f => f.includes(p.name.replace('use', '')))
        );

    // LLM enrichment
    let llmEntities: Awaited<ReturnType<typeof extractEntitiesWithLLM>> = [];
    let llmActions: Awaited<ReturnType<typeof extractActionsWithLLM>> = [];

    if (llmServiceConfig && matchingPatterns.length > 0) {
      try {
        llmEntities = await extractEntitiesWithLLM(matchingPatterns, domain.name, llmServiceConfig);
        llmActions = await extractActionsWithLLM(matchingPatterns, domain.name, llmServiceConfig);
        log(`  ${domain.name}: +${llmEntities.length} entities, +${llmActions.length} actions (LLM)`);
      } catch (e) {
        log(`  ${domain.name}: LLM enrichment failed`);
      }
    }

    const proposal = summarizer.generateSchemaProposal(
      domain,
      matchingPatterns,
      [],
      { confidenceThreshold: 0.7 }
    );

    // Merge LLM results
    if (llmEntities.length > 0) {
      const existingNames = new Set(proposal.entities.map(e => e.path.split('.').pop()?.toLowerCase()));
      for (const entity of llmEntities) {
        if (!existingNames.has(entity.name.toLowerCase())) {
          proposal.entities.push({
            path: `${domain.name}.entities.${entity.name}`,
            type: 'object',
            description: `LLM: ${entity.name}`,
            source: 'LLM',
            confidence: entity.confidence,
          });
          for (const field of entity.fields) {
            proposal.entities.push({
              path: `${domain.name}.entities.${entity.name}.${field.name}`,
              type: field.type,
              description: field.description,
              source: 'LLM',
              confidence: entity.confidence * 0.9,
            });
          }
        }
      }
    }

    if (llmActions.length > 0) {
      const existingNames = new Set(proposal.intents.map(i => i.path.split('.').pop()?.toLowerCase()));
      for (const action of llmActions) {
        if (!existingNames.has(action.name.toLowerCase())) {
          proposal.intents.push({
            path: `${domain.name}.intents.${action.name}`,
            type: action.type,
            description: `LLM: ${action.type}`,
            source: 'LLM',
            confidence: action.confidence,
          });
        }
      }
    }

    if (llmEntities.length > 0 || llmActions.length > 0) {
      proposal.confidence = Math.min(proposal.confidence * 1.1, 0.95);
    }

    summarizerState = summarizer.addSchemaProposal(summarizerState, proposal);
  }

  // Phase 4: Transform and Output
  log('\n[4/4] Writing schemas...');
  let transformerData = transformer.createInitialData('summarizer', {
    outputDir: resolvedOutputDir,
    schemaVersion: '1.0.0',
  });

  const schemas: MigrateResult['schemas'] = [];
  const proposals = Object.values(summarizerState.schemaProposals);

  for (const proposal of proposals) {
    const task = transformer.createTask(proposal.domainId, proposal.domainName, proposal);
    transformerData = transformer.addTask(transformerData, task);

    const domain = domainSummaries.find(d => d.id === proposal.domainId);
    if (!domain) continue;

    const schema = transformer.generateManifestoSchema(proposal, domain, { schemaVersion: '1.0.0' });
    const validation = transformer.validateGeneratedSchema(schema);

    if (!validation.valid) {
      log(`  Warning: ${proposal.domainName} has validation errors`);
    }

    const fileName = `${proposal.domainName}.domain.json`;
    const filePath = path.join(resolvedOutputDir, fileName);

    schemas.push({
      name: fileName,
      path: filePath,
      content: schema,
    });

    // Write file
    if (!dryRun) {
      await fs.mkdir(resolvedOutputDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(schema, null, 2), 'utf-8');
      log(`  Written: ${fileName}`);
    } else {
      log(`  [dry-run] Would write: ${fileName}`);
    }
  }

  const summarizerDerived = summarizer.calculateDerived(summarizerData, summarizerState);

  return {
    filesScanned: scannedFiles.length,
    filesAnalyzed: reactFiles.length,
    patternsDetected: allPatterns.length,
    domainsDiscovered: domainSummaries.length,
    schemasGenerated: schemas.length,
    schemas,
    confidence: summarizerDerived.overallConfidence,
  };
}

// CLI entry point - check if this file is being run directly or via bin
const isDirectRun = process.argv[1]?.includes('run.js') ||
                    process.argv[1]?.includes('run.ts') ||
                    process.argv.includes('run') ||
                    (process.argv[2] && !process.argv[2].startsWith('-'));

if (isDirectRun) {
  // Skip 'run' if it's the first argument (from bin entry point)
  let args = process.argv.slice(2);
  if (args[0] === 'run') {
    args = args.slice(1);
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: react-migrate run <sourceDir> [options]

Arguments:
  sourceDir              Source directory containing React code

Options:
  -o, --output <dir>     Output directory (default: ./manifesto)
  --no-llm               Skip LLM enrichment
  --provider <name>      LLM provider: openai, anthropic, ollama (default: openai)
  --dry-run              Don't write files, just show what would happen
  -v, --verbose          Enable verbose output
  -h, --help             Show this help message

Examples:
  react-migrate run ./src
  react-migrate run ./src -o ./output --verbose
  react-migrate run ./src --no-llm --dry-run

Environment Variables:
  OPENAI_API_KEY         Required for OpenAI provider
  ANTHROPIC_API_KEY      Required for Anthropic provider
`);
    process.exit(0);
  }

  // Find sourceDir (first non-flag argument)
  const sourceDir = args.find(a => !a.startsWith('-')) || '.';

  // Parse options
  const getOption = (short: string, long: string): string | undefined => {
    const shortIdx = args.indexOf(short);
    const longIdx = args.indexOf(long);
    const idx = shortIdx >= 0 ? shortIdx : longIdx;
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const outputDir = getOption('-o', '--output') || './manifesto';
  const provider = (getOption('--provider', '--provider') || 'openai') as 'openai' | 'anthropic' | 'ollama';
  const noLLM = args.includes('--no-llm');
  const verbose = args.includes('-v') || args.includes('--verbose');
  const dryRun = args.includes('--dry-run');

  console.log('\n@manifesto-ai/react-migrate');
  console.log('='.repeat(40));

  migrate({
    sourceDir,
    outputDir: outputDir || './manifesto',
    provider,
    noLLM,
    verbose,
    dryRun,
  })
    .then((result) => {
      console.log('\n' + '='.repeat(40));
      console.log('Migration Complete!');
      console.log('='.repeat(40));
      console.log(`
  Files scanned:    ${result.filesScanned}
  Files analyzed:   ${result.filesAnalyzed}
  Patterns found:   ${result.patternsDetected}
  Domains found:    ${result.domainsDiscovered}
  Schemas created:  ${result.schemasGenerated}
  Confidence:       ${(result.confidence * 100).toFixed(1)}%

  Output: ${outputDir}
`);
      result.schemas.forEach(s => {
        console.log(`    - ${s.name}`);
      });
      console.log('');
    })
    .catch((error) => {
      console.error('\nMigration failed:', error.message);
      process.exit(1);
    });
}
