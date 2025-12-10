/**
 * Migration Test Script
 *
 * 토이 React 프로젝트에서 실제 마이그레이션 파이프라인을 테스트합니다.
 */

import path from 'path';
import { fileURLToPath } from 'url';
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
  prompts,
  type LLMProvider,
} from '../src/index.js';
import type { LLMServiceConfig } from '../src/domains/summarizer/llm-service.js';
import {
  extractEntitiesWithLLM,
  extractActionsWithLLM,
  generateSchemaWithLLM,
} from '../src/domains/summarizer/llm-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Choose target: 'toy' for simple app, 'saas' for complex SaaS app
const TARGET = process.env.TARGET || 'saas';
const TARGET_PATH = TARGET === 'saas'
  ? path.join(__dirname, 'saas-app/src')
  : path.join(__dirname, 'toy-react-app/src');

async function runMigration() {
  console.log('='.repeat(60));
  console.log('React to Manifesto Migration Test');
  console.log('='.repeat(60));
  console.log(`\nTarget: ${TARGET_PATH} (${TARGET})\n`);

  // Initialize LLM Provider
  let llm: LLMProvider | null = null;
  try {
    const config = loadProviderFromEnv('openai');
    if (config.apiKey) {
      llm = createProvider(config);
      console.log(`LLM Provider: OpenAI (${config.defaultModel})\n`);
    }
  } catch {
    console.log('LLM Provider: None (using heuristics only)\n');
  }

  // ============================================================
  // Phase 1: File Scanning & Parsing
  // ============================================================
  console.log('\n[Phase 1] Scanning and Parsing Files...');

  const scannedFiles = await scanFiles({
    rootDir: TARGET_PATH,
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['node_modules', 'dist', '*.test.*', '*.spec.*'],
  });

  console.log(`  Found ${scannedFiles.length} files`);
  scannedFiles.forEach(f => console.log(`    - ${f.relativePath}`));

  // Parse and analyze files (filter React files and analyze individually)
  const reactFiles = scannedFiles.filter(f => isReactFile(f.content));
  console.log(`\n  React files: ${reactFiles.length}`);

  const analyses = reactFiles.map(f => analyzeFile(f));
  console.log(`  Analyzed ${analyses.length} files`);

  let totalPatterns = 0;
  for (const analysis of analyses) {
    totalPatterns += analysis.patterns.length;
    if (analysis.patterns.length > 0) {
      console.log(`    ${analysis.relativePath}: ${analysis.patterns.length} patterns`);
      analysis.patterns.forEach(p => {
        console.log(`      - [${p.type}] ${p.name} (confidence: ${p.confidence.toFixed(2)})`);
      });
    }
  }
  console.log(`\n  Total patterns detected: ${totalPatterns}`);

  // ============================================================
  // Phase 2: Analyzer - Domain Candidate Extraction
  // ============================================================
  console.log('\n[Phase 2] Running Analyzer...');

  let analyzerData = analyzer.createInitialData({
    confidenceThreshold: 0.7,
    enableLLMFallback: true
  });
  let analyzerState = analyzer.createInitialState();

  // Build dependency graph
  const graph = analyzer.buildDependencyGraph(analyses);
  console.log(`  Dependency graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  // Create file tasks
  const fileTasks = scannedFiles.map(file => ({
    path: file.path,
    relativePath: file.relativePath,
    priority: analyzer.calculatePriority(file),
    dependencies: [] as string[],
    status: 'pending' as const,
  }));

  analyzerData = analyzer.addToQueue(analyzerData, fileTasks);
  console.log(`  Queue: ${analyzerData.queue.length} tasks`);

  // Process files
  for (const analysis of analyses) {
    analyzerData = analyzer.addResult(analyzerData, analysis);
    analyzerData = analyzer.updateTaskStatus(analyzerData, analysis.path, 'done');
    analyzerState = analyzer.aggregatePatterns(analyzerState, analysis);
  }

  // Collect all patterns for later use
  const allPatterns = analyses.flatMap(a => a.patterns);

  // Extract domain candidates
  const candidates = analyzer.extractDomainCandidates(
    analyzerState.patterns,
    analyses,
    graph
  );

  for (const candidate of candidates) {
    analyzerData = analyzer.addDomainCandidate(analyzerData, candidate);
  }

  const analyzerDerived = analyzer.calculateDerived(analyzerData, analyzerState);
  console.log(`\n  Analyzer Results:`);
  console.log(`    Files processed: ${analyzerDerived.filesProcessed}/${analyzerDerived.filesTotal}`);
  console.log(`    Domains discovered: ${analyzerDerived.domainsDiscovered}`);
  console.log(`    Overall confidence: ${(analyzerDerived.overallConfidence * 100).toFixed(1)}%`);

  console.log(`\n  Domain Candidates:`);
  Object.values(analyzerData.domainCandidates).forEach(c => {
    console.log(`    - ${c.name} (confidence: ${c.confidence.toFixed(2)}, files: ${c.sourceFiles.length})`);
    if (c.sourcePatterns && c.sourcePatterns.length > 0) {
      console.log(`      Patterns: ${c.sourcePatterns.join(', ')}`);
    }
    console.log(`      Suggested by: ${c.suggestedBy}`);
  });

  // ============================================================
  // Phase 3: Summarizer - Clustering & Schema Proposal
  // ============================================================
  console.log('\n[Phase 3] Running Summarizer...');

  let summarizerData = summarizer.createInitialData('analyzer-snapshot-1');
  let summarizerState = summarizer.createInitialState();

  // Use LLM to identify domains if available
  if (llm) {
    console.log('  Using LLM for domain identification...');

    const patternInfo = allPatterns.map(p => ({
      name: p.name,
      type: p.type,
      file: (p.metadata.sourceFile as string) || 'unknown',
    }));

    const fileGroups = [...new Set(analyses.map(a => a.relativePath))];

    const prompt = prompts.identifyDomainPrompt(patternInfo, fileGroups);

    try {
      const result = await llm.complete([{ role: 'user', content: prompt }]);
      console.log('\n  LLM Domain Analysis:');
      console.log('  ' + '-'.repeat(40));

      // Parse JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const domainAnalysis = JSON.parse(jsonMatch[0]);
        console.log(`    Domain: ${domainAnalysis.domainName}`);
        console.log(`    Description: ${domainAnalysis.description}`);
        console.log(`    Confidence: ${(domainAnalysis.confidence * 100).toFixed(0)}%`);
        console.log(`    Is Cohesive: ${domainAnalysis.isCohesive}`);
        if (domainAnalysis.splitSuggestion) {
          console.log(`    Split Suggestion: ${domainAnalysis.splitSuggestion}`);
        }
        if (domainAnalysis.relatedDomains?.length > 0) {
          console.log(`    Related Domains: ${domainAnalysis.relatedDomains.join(', ')}`);
        }
      }
      console.log('  ' + '-'.repeat(40));
    } catch (e) {
      console.log(`    LLM Error: ${e}`);
    }
  }

  // Perform clustering
  const clusteringResult = summarizer.performClustering(
    Object.values(analyzerData.domainCandidates),
    graph,
    1 // min cluster size
  );
  console.log(`\n  Clusters: ${clusteringResult.clusters.length}`);

  // Convert to domain summaries
  const domainSummaries = summarizer.clustersToDomainSummaries(
    clusteringResult.clusters,
    Object.values(analyzerData.domainCandidates)
  );

  for (const domain of domainSummaries) {
    summarizerData = summarizer.addDomain(summarizerData, domain);
    console.log(`\n  Domain: ${domain.name}`);
    console.log(`    Description: ${domain.description}`);
    console.log(`    Files: ${domain.sourceFiles.length}`);
  }

  // Generate schema proposals
  console.log('\n  Generating schema proposals...');

  // Create LLM service config if provider available
  const llmServiceConfig: LLMServiceConfig | null = llm ? {
    provider: llm,
    enableFallback: true,
    maxRetries: 2,
    timeout: 30000,
  } : null;

  for (const domain of domainSummaries) {
    const domainPatterns = allPatterns.filter(p => {
      const sourceFile = p.metadata.sourceFile as string | undefined;
      return sourceFile && domain.sourceFiles.includes(sourceFile);
    });

    // If no sourceFile metadata, fallback to name matching
    const matchingPatterns = domainPatterns.length > 0
      ? domainPatterns
      : allPatterns.filter(p =>
          domain.sourceFiles.some(f => f.includes(p.name.replace('use', '')))
        );

    console.log(`\n  Processing Domain: ${domain.name}`);
    console.log(`    Patterns: ${matchingPatterns.length}`);

    // ========== LLM Entity Extraction ==========
    let llmEntities: Awaited<ReturnType<typeof extractEntitiesWithLLM>> = [];
    let llmActions: Awaited<ReturnType<typeof extractActionsWithLLM>> = [];

    if (llmServiceConfig && matchingPatterns.length > 0) {
      console.log(`    [LLM] Extracting entities...`);
      try {
        llmEntities = await extractEntitiesWithLLM(matchingPatterns, domain.name, llmServiceConfig);
        console.log(`    [LLM] Found ${llmEntities.length} entities`);
        for (const entity of llmEntities) {
          console.log(`      - ${entity.name} (${entity.fields.length} fields)`);
        }
      } catch (e) {
        console.log(`    [LLM] Entity extraction failed: ${e}`);
      }

      console.log(`    [LLM] Extracting actions...`);
      try {
        llmActions = await extractActionsWithLLM(matchingPatterns, domain.name, llmServiceConfig);
        console.log(`    [LLM] Found ${llmActions.length} actions`);
        for (const action of llmActions) {
          console.log(`      - ${action.name} (${action.type})`);
        }
      } catch (e) {
        console.log(`    [LLM] Action extraction failed: ${e}`);
      }
    }

    // Generate proposal (hybrid: heuristic + LLM)
    const proposal = summarizer.generateSchemaProposal(
      domain,
      matchingPatterns,
      [],
      { confidenceThreshold: 0.7 }
    );

    // Merge LLM extracted entities/actions into proposal
    if (llmEntities.length > 0) {
      const existingEntityNames = new Set(proposal.entities.map(e => e.path.split('.').pop()?.toLowerCase()));
      for (const entity of llmEntities) {
        if (!existingEntityNames.has(entity.name.toLowerCase())) {
          proposal.entities.push({
            path: `${domain.name}.entities.${entity.name}`,
            type: 'object',
            description: `LLM extracted: ${entity.name}`,
            source: entity.sourcePatterns.join(', ') || 'LLM',
            confidence: entity.confidence,
          });
          // Add fields
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
      const existingActionNames = new Set(proposal.intents.map(i => i.path.split('.').pop()?.toLowerCase()));
      for (const action of llmActions) {
        if (!existingActionNames.has(action.name.toLowerCase())) {
          proposal.intents.push({
            path: `${domain.name}.intents.${action.name}`,
            type: action.type,
            description: `LLM extracted: ${action.type} ${action.name}`,
            source: action.sourcePatterns.join(', ') || 'LLM',
            confidence: action.confidence,
          });
        }
      }
    }

    // Update confidence if LLM was used
    if (llmEntities.length > 0 || llmActions.length > 0) {
      proposal.confidence = Math.min(proposal.confidence * 1.1, 0.95); // Boost confidence slightly
      proposal.reviewNotes.push('Enhanced with LLM extraction');
    }

    summarizerState = summarizer.addSchemaProposal(summarizerState, proposal);

    console.log(`\n  Schema Proposal: ${proposal.domainName}`);
    console.log(`    Entities: ${proposal.entities.length}`);
    console.log(`    State fields: ${proposal.state.length}`);
    console.log(`    Intents: ${proposal.intents.length}`);
    console.log(`    Confidence: ${(proposal.confidence * 100).toFixed(1)}%`);
    console.log(`    Needs review: ${proposal.needsReview}`);
    if (proposal.reviewNotes.length > 0) {
      console.log(`    Notes: ${proposal.reviewNotes.join(', ')}`);
    }
  }

  const summarizerDerived = summarizer.calculateDerived(summarizerData, summarizerState);
  console.log(`\n  Summarizer Results:`);
  console.log(`    Domains: ${summarizerDerived.domainsTotal}`);
  console.log(`    Proposals ready: ${summarizerDerived.proposalsReady}`);

  // ============================================================
  // Phase 4: Transformer - Schema Generation
  // ============================================================
  console.log('\n[Phase 4] Running Transformer...');

  let transformerData = transformer.createInitialData('summarizer-snapshot-1', {
    outputDir: path.join(TARGET_PATH, '../manifesto-output'),
    schemaVersion: '1.0.0',
  });
  let transformerState = transformer.createInitialState();

  const proposals = Object.values(summarizerState.schemaProposals);

  for (const proposal of proposals) {
    const task = transformer.createTask(proposal.domainId, proposal.domainName, proposal);
    transformerData = transformer.addTask(transformerData, task);

    const domain = domainSummaries.find(d => d.id === proposal.domainId);
    if (!domain) continue;

    // Generate Manifesto schema
    const schema = transformer.generateManifestoSchema(proposal, domain, {
      schemaVersion: '1.0.0',
    });

    // Validate
    const validation = transformer.validateGeneratedSchema(schema);

    transformerData = transformer.setTaskSchema(transformerData, task.id, schema);
    transformerData = transformer.setTaskValidation(transformerData, task.id, {
      valid: validation.valid,
      errors: validation.errors.map(e => ({ code: 'VALIDATION', message: e, severity: 'error' as const })),
      warnings: [],
    });

    console.log(`\n  Generated: ${schema.domain}.domain.json`);
    console.log(`    Valid: ${validation.valid}`);
    if (validation.errors.length > 0) {
      console.log(`    Errors: ${validation.errors.join(', ')}`);
    }

    // Create domain file
    const domainFile = transformer.createDomainFile(
      task.id,
      task.domainName,
      schema,
      [],
      transformerData.outputDir
    );
    transformerData = transformer.addDomainFile(transformerData, domainFile);
    transformerData = transformer.updateTaskStatus(transformerData, task.id, 'done');
  }

  const transformerDerived = transformer.calculateDerived(transformerData, transformerState);
  console.log(`\n  Transformer Results:`);
  console.log(`    Tasks: ${transformerDerived.tasksCompleted}/${transformerDerived.tasksTotal}`);
  console.log(`    Files generated: ${transformerDerived.filesGenerated}`);

  // ============================================================
  // Output Summary
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  console.log(`\nGenerated Domain Schemas:`);
  Object.values(transformerData.domainFiles).forEach(file => {
    console.log(`\n  ${file.name}:`);
    const schemaJson = JSON.stringify(file.content, null, 2);
    schemaJson.split('\n').forEach(line => console.log('    ' + line));
  });

  console.log('\n' + '='.repeat(60));
  console.log('Migration Complete!');
  console.log('='.repeat(60));
}

// Run
runMigration().catch(console.error);
