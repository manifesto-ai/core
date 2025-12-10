/**
 * E2E Pipeline Test
 *
 * Tests the full migration pipeline from Orchestrator through Analyzer, Summarizer, and Transformer.
 * Uses mock LLM provider and in-memory storage.
 */

import { describe, it, expect } from 'vitest';
import type { DetectedPattern, FileAnalysis } from '../../src/parser/types.js';
import type { DomainCandidate, DependencyGraph } from '../../src/domains/analyzer/types.js';
import type { SchemaProposal, DomainSummary } from '../../src/domains/summarizer/types.js';

// Import domain modules
import * as analyzer from '../../src/domains/analyzer/index.js';
import * as summarizer from '../../src/domains/summarizer/index.js';
import * as transformer from '../../src/domains/transformer/index.js';

// Test fixtures
function createMockFileAnalysis(path: string, patterns: DetectedPattern[]): FileAnalysis {
  return {
    path,
    relativePath: path.replace('/src/', ''),
    patterns,
    imports: [],
    exports: [],
    hasJSX: path.endsWith('.tsx'),
    issues: [],
    confidence: 0.9,
  };
}

function createMockPattern(name: string, type: DetectedPattern['type'], metadata: Record<string, unknown> = {}): DetectedPattern {
  return {
    type,
    name,
    confidence: 0.9,
    needsReview: false,
    reviewReason: undefined,
    location: {
      start: { line: 1, column: 0 },
      end: { line: 50, column: 0 },
    },
    metadata,
  };
}

function createMockScannedFile(path: string, relativePath: string, content: string = '', size: number = 1000) {
  return {
    path,
    relativePath,
    extension: path.split('.').pop() ?? '',
    content,
    size: content.length || size,
  };
}

describe('E2E Pipeline', () => {
  describe('Full Domain Extraction Pipeline', () => {
    it('processes patterns from analysis to schema generation', () => {
      // ============================================================
      // PHASE 1: Analyzer - Pattern Detection & Domain Candidate Extraction
      // ============================================================

      // Simulated file analyses (what parser would produce)
      // Note: props should be array format for extractEntitiesFromPatterns
      const analyses: FileAnalysis[] = [
        createMockFileAnalysis('/src/components/UserProfile.tsx', [
          createMockPattern('UserProfile', 'component', {
            props: ['name', 'email', 'avatar'],
          }),
          createMockPattern('useUser', 'hook'),
        ]),
        createMockFileAnalysis('/src/components/UserList.tsx', [
          createMockPattern('UserList', 'component', {
            props: ['users'],
          }),
        ]),
        createMockFileAnalysis('/src/hooks/useAuth.ts', [
          createMockPattern('useAuth', 'hook', {
            returnType: '{ isLoggedIn: boolean, user: User | null, login: () => void, logout: () => void }',
          }),
        ]),
        createMockFileAnalysis('/src/contexts/UserContext.tsx', [
          createMockPattern('UserContext', 'context', {
            contextValue: '{ user: User | null, setUser: (user: User) => void }',
          }),
          createMockPattern('UserProvider', 'context'),
        ]),
        createMockFileAnalysis('/src/reducers/userReducer.ts', [
          createMockPattern('userReducer', 'reducer', {
            stateShape: { user: 'User | null', loading: 'boolean', error: 'string | null' },
            actions: ['SET_USER', 'CLEAR_USER', 'UPDATE_PROFILE'],
          }),
        ]),
      ];

      // Create scanned files for priority calculation
      // Context file has createContext pattern for higher priority
      const scannedFiles = analyses.map(a => {
        if (a.path.includes('Context')) {
          return createMockScannedFile(a.path, a.relativePath, 'import { createContext } from "react"; export const UserContext = createContext<UserContextValue>(null);');
        }
        return createMockScannedFile(a.path, a.relativePath);
      });

      // Calculate file priorities using correct API
      const priorities = scannedFiles.map(file => ({
        path: file.path,
        priority: analyzer.calculatePriority(file),
      }));

      expect(priorities.length).toBe(5);
      // Context files should have higher priority
      const contextFile = priorities.find(p => p.path.includes('Context'));
      const listFile = priorities.find(p => p.path.includes('List'));
      expect(contextFile!.priority).toBeGreaterThan(listFile!.priority);

      // Build dependency graph
      const graph = analyzer.buildDependencyGraph(analyses);
      expect(graph.nodes.length).toBe(5);

      // Create domain candidates from patterns
      const allPatterns = analyses.flatMap(a => a.patterns);
      const patternFileMap = new Map<DetectedPattern, string>();
      for (const analysis of analyses) {
        for (const pattern of analysis.patterns) {
          patternFileMap.set(pattern, analysis.path);
        }
      }

      // Create analyzer data/state
      let analyzerData = analyzer.createInitialData({ confidenceThreshold: 0.7, enableLLMFallback: false });
      let analyzerState = analyzer.createInitialState();

      // Add file tasks to queue using proper function (addToQueue expects array)
      const fileTasks = scannedFiles.map(file => ({
        path: file.path,
        relativePath: file.relativePath,
        priority: analyzer.calculatePriority(file),
        dependencies: [],
        status: 'pending' as const,
      }));
      analyzerData = analyzer.addToQueue(analyzerData, fileTasks);

      // Process files (simulate completing analysis)
      for (const analysis of analyses) {
        analyzerData = analyzer.addResult(analyzerData, analysis);
        analyzerData = analyzer.updateTaskStatus(analyzerData, analysis.path, 'done');
      }

      // Aggregate patterns into state (aggregatePatterns takes single FileAnalysis)
      for (const analysis of analyses) {
        analyzerState = analyzer.aggregatePatterns(analyzerState, analysis);
      }

      // Extract domain candidates
      const domainCandidate: DomainCandidate = {
        id: 'candidate-user',
        name: 'User',
        confidence: 0.85,
        sourceFiles: analyses.map(a => a.path),
        sourcePatterns: allPatterns.map(p => p.name),
        suggestedBy: 'context_pattern',
        needsReview: false,
        reviewReason: undefined,
      };

      analyzerData = analyzer.addDomainCandidate(analyzerData, domainCandidate);

      const analyzerDerived = analyzer.calculateDerived(analyzerData, analyzerState);
      expect(analyzerDerived.domainsDiscovered).toBe(1);

      // ============================================================
      // PHASE 2: Summarizer - Clustering & Schema Proposal
      // ============================================================

      // Create summarizer data/state
      let summarizerData = summarizer.createInitialData('analyzer-ref-1');
      let summarizerState = summarizer.createInitialState();

      // Perform clustering
      const clusteringResult = summarizer.performClustering([domainCandidate], graph, 1);
      expect(clusteringResult.clusters.length).toBeGreaterThan(0);

      // Convert clusters to domain summaries
      const domainSummaries = summarizer.clustersToDomainSummaries(clusteringResult.clusters, [domainCandidate]);
      expect(domainSummaries.length).toBeGreaterThan(0);

      // Add domains to summarizer data
      for (const domain of domainSummaries) {
        summarizerData = summarizer.addDomain(summarizerData, domain);
      }

      // Generate schema proposals
      const proposals: SchemaProposal[] = [];
      for (const domain of domainSummaries) {
        // Get patterns for this domain
        const domainPatterns = allPatterns.filter(p => {
          const file = patternFileMap.get(p);
          return file && domain.sourceFiles.includes(file);
        });

        const proposal = summarizer.generateSchemaProposal(domain, domainPatterns, [], {
          confidenceThreshold: 0.7,
        });

        proposals.push(proposal);
        summarizerState = summarizer.addSchemaProposal(summarizerState, proposal);
      }

      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0]!.entities.length).toBeGreaterThan(0);

      const summarizerDerived = summarizer.calculateDerived(summarizerData, summarizerState);
      // domainsTotal은 실제 summarizerData에 추가된 도메인 수와 일치해야 함
      expect(summarizerDerived.domainsTotal).toBeGreaterThan(0);
      expect(summarizerDerived.domainsTotal).toBe(Object.keys(summarizerData.domains).length);
      // proposalsReady는 생성된 고유 proposal 수 (domainId 기준)
      expect(summarizerDerived.proposalsReady).toBe(Object.keys(summarizerState.schemaProposals).length);

      // ============================================================
      // PHASE 3: Transformer - Schema Generation & File Output
      // ============================================================

      // Create transformer data/state
      let transformerData = transformer.createInitialData('summarizer-ref-1', {
        outputDir: './manifesto',
        schemaVersion: '1.0.0',
      });
      let transformerState = transformer.createInitialState();

      // Create transformation tasks
      const tasks = proposals.map(proposal => {
        return transformer.createTask(proposal.domainId, proposal.domainName, proposal);
      });

      for (const task of tasks) {
        transformerData = transformer.addTask(transformerData, task);
      }

      // Generate schemas
      for (const task of tasks) {
        const proposal = task.proposal;
        const domain = domainSummaries.find(d => d.id === proposal.domainId);

        if (!domain) continue;

        // Generate Manifesto schema
        const schema = transformer.generateManifestoSchema(proposal, domain, {
          schemaVersion: '1.0.0',
        });

        // Validate schema
        const validation = transformer.validateGeneratedSchema(schema);
        expect(validation.valid).toBe(true);

        // Update task with schema
        transformerData = transformer.setTaskSchema(transformerData, task.id, schema);
        transformerData = transformer.setTaskValidation(transformerData, task.id, {
          valid: validation.valid,
          errors: validation.errors.map(e => ({ code: 'VALIDATION', message: e, severity: 'error' as const })),
          warnings: [],
        });

        // Create domain file
        const domainFile = transformer.createDomainFile(
          task.id,
          task.domainName,
          schema,
          [],
          './manifesto'
        );

        transformerData = transformer.addDomainFile(transformerData, domainFile);
        transformerData = transformer.updateTaskStatus(transformerData, task.id, 'done');
      }

      // Calculate final derived state
      const transformerDerived = transformer.calculateDerived(transformerData, transformerState);
      // 테스크 수는 실제 transformerData에 추가된 테스크 수와 일치
      const actualTasksCount = Object.keys(transformerData.tasks).length;
      expect(transformerDerived.tasksTotal).toBe(actualTasksCount);
      expect(transformerDerived.tasksCompleted).toBe(actualTasksCount);
      expect(transformerDerived.filesGenerated).toBe(actualTasksCount);

      // Verify output structure
      const domainFiles = Object.values(transformerData.domainFiles);
      const outputStructure = transformer.createOutputStructure(domainFiles, './manifesto');

      expect(outputStructure.domains.length).toBe(domainFiles.length);
      expect(outputStructure.meta.migrationLog.summary.totalDomains).toBe(domainFiles.length);

      // Create write plan
      const writePlan = transformer.createWritePlan(outputStructure, './manifesto');
      expect(writePlan.filesToWrite.length).toBeGreaterThan(0);
      expect(writePlan.directoriesToCreate).toContain('./manifesto/_meta');
    });

    it('handles HITL scenarios with low confidence patterns', () => {
      // Create analyzer state
      let analyzerState = analyzer.createInitialState();

      // Add patterns through file analysis (proper way)
      const lowConfidenceAnalysis: FileAnalysis = {
        path: '/src/hooks/useAmbiguous.ts',
        relativePath: 'hooks/useAmbiguous.ts',
        patterns: [
          {
            type: 'hook',
            name: 'useAmbiguous',
            confidence: 0.5, // Low confidence
            needsReview: true,
            reviewReason: 'Multiple possible interpretations',
            location: {
              start: { line: 1, column: 0 },
              end: { line: 10, column: 0 },
            },
            metadata: {},
          },
        ],
        imports: [],
        exports: [],
        hasJSX: false,
        issues: [],
        confidence: 0.5,
      };

      // Aggregate patterns from analysis (single FileAnalysis, not array)
      analyzerState = analyzer.aggregatePatterns(analyzerState, lowConfidenceAnalysis);

      // The pattern should be in the hooks collection
      expect(analyzerState.patterns.hooks.length).toBe(1);
      expect(analyzerState.patterns.hooks[0]!.needsReview).toBe(true);

      // Create summarizer state with low confidence proposal
      let summarizerState = summarizer.createInitialState();

      const lowConfidenceProposal: SchemaProposal = {
        id: 'proposal-ambiguous',
        domainId: 'domain-ambiguous',
        domainName: 'Ambiguous',
        entities: [],
        state: [],
        intents: [],
        confidence: 0.5, // Low confidence
        alternatives: [],
        reviewNotes: ['Low confidence - needs human review'],
        needsReview: true,
      };

      summarizerState = summarizer.addSchemaProposal(summarizerState, lowConfidenceProposal);

      // Check proposal is stored and marked as needsReview
      const proposals = Object.values(summarizerState.schemaProposals);
      const needingReviewCount = proposals.filter(p => p.needsReview).length;

      expect(needingReviewCount).toBe(1);
      expect(proposals[0]!.needsReview).toBe(true);
    });

    it('handles multiple domains with relationships', () => {
      // Create two domain candidates
      const userCandidate: DomainCandidate = {
        id: 'candidate-user',
        name: 'User',
        confidence: 0.9,
        sourceFiles: ['/src/user/Profile.tsx'],
        sourcePatterns: ['UserProfile'],
        suggestedBy: 'component_pattern',
        needsReview: false,
        reviewReason: undefined,
      };

      const productCandidate: DomainCandidate = {
        id: 'candidate-product',
        name: 'Product',
        confidence: 0.9,
        sourceFiles: ['/src/product/ProductCard.tsx'],
        sourcePatterns: ['ProductCard'],
        suggestedBy: 'component_pattern',
        needsReview: false,
        reviewReason: undefined,
      };

      let summarizerData = summarizer.createInitialData('analyzer-ref');

      // Create domain summaries
      const userSummary: DomainSummary = {
        id: 'domain-user',
        name: 'User',
        description: 'User management domain',
        sourceFiles: ['/src/user/Profile.tsx'],
        entities: [],
        actions: [],
        boundaries: {
          imports: ['Product'],
          exports: ['User', 'UserProfile'],
          sharedState: [],
        },
        suggestedBy: userCandidate.id,
        confidence: 0.9,
        needsReview: false,
        reviewNotes: [],
      };

      const productSummary: DomainSummary = {
        id: 'domain-product',
        name: 'Product',
        description: 'Product catalog domain',
        sourceFiles: ['/src/product/ProductCard.tsx'],
        entities: [],
        actions: [],
        boundaries: {
          imports: [],
          exports: ['Product', 'ProductCard'],
          sharedState: [],
        },
        suggestedBy: productCandidate.id,
        confidence: 0.9,
        needsReview: false,
        reviewNotes: [],
      };

      summarizerData = summarizer.addDomain(summarizerData, userSummary);
      summarizerData = summarizer.addDomain(summarizerData, productSummary);

      expect(Object.keys(summarizerData.domains)).toHaveLength(2);

      // Add relationship
      let summarizerState = summarizer.createInitialState();
      summarizerState = summarizer.addRelationships(summarizerState, [{
        type: 'dependency',
        from: 'domain-user',
        to: 'domain-product',
        strength: 0.7,
        evidence: ['User imports Product'],
      }]);

      expect(summarizerState.relationships.dependencies).toHaveLength(1);

      const derived = summarizer.calculateDerived(summarizerData, summarizerState);
      expect(derived.domainsTotal).toBe(2);
      // Check relationships count through the state
      const totalRelationships =
        summarizerState.relationships.dependencies.length +
        summarizerState.relationships.sharedState.length +
        summarizerState.relationships.eventFlows.length;
      expect(totalRelationships).toBe(1);
    });
  });

  describe('Domain State Transitions', () => {
    it('tracks analyzer state transitions correctly', () => {
      let data = analyzer.createInitialData();
      let state = analyzer.createInitialState();

      // Add file tasks using addToQueue (expects array of tasks)
      data = analyzer.addToQueue(data, [
        {
          path: '/a.tsx',
          relativePath: 'a.tsx',
          priority: 50,
          dependencies: [],
          status: 'pending',
        },
        {
          path: '/b.tsx',
          relativePath: 'b.tsx',
          priority: 50,
          dependencies: [],
          status: 'pending',
        },
      ]);

      let derived = analyzer.calculateDerived(data, state);
      expect(derived.filesTotal).toBe(2);
      expect(derived.filesProcessed).toBe(0);

      // Process first file
      data = analyzer.updateTaskStatus(data, '/a.tsx', 'done');
      derived = analyzer.calculateDerived(data, state);
      expect(derived.filesProcessed).toBe(1);
      expect(derived.progress).toBe(50);

      // Process second file
      data = analyzer.updateTaskStatus(data, '/b.tsx', 'done');
      derived = analyzer.calculateDerived(data, state);
      expect(derived.filesProcessed).toBe(2);
      expect(derived.progress).toBe(100);
    });

    it('tracks transformer state transitions correctly', () => {
      let data = transformer.createInitialData('ref');
      let state = transformer.createInitialState();

      const mockProposal: SchemaProposal = {
        id: 'p1',
        domainId: 'd1',
        domainName: 'Test',
        entities: [],
        state: [],
        intents: [],
        confidence: 0.9,
        alternatives: [],
        reviewNotes: [],
        needsReview: false,
      };

      // Add tasks
      const task1 = transformer.createTask('d1', 'Domain1', mockProposal);
      const task2 = transformer.createTask('d2', 'Domain2', mockProposal);

      data = transformer.addTask(data, task1);
      data = transformer.addTask(data, task2);

      let derived = transformer.calculateDerived(data, state);
      expect(derived.tasksTotal).toBe(2);
      expect(derived.overallProgress).toBe(0);

      // Complete first task
      data = transformer.updateTaskStatus(data, task1.id, 'done');
      derived = transformer.calculateDerived(data, state);
      expect(derived.tasksCompleted).toBe(1);
      expect(derived.overallProgress).toBe(50);

      // Fail second task
      data = transformer.updateTaskStatus(data, task2.id, 'failed', 'Test error');
      derived = transformer.calculateDerived(data, state);
      expect(derived.tasksFailed).toBe(1);
      expect(transformer.isTransformationComplete(data)).toBe(true);
      expect(transformer.allTasksSucceeded(data)).toBe(false);
    });
  });

  describe('Snapshot and Persistence', () => {
    it('creates valid snapshots at each phase', () => {
      // Analyzer snapshot
      const analyzerSnapshot = analyzer.createSnapshot(
        analyzer.createInitialData(),
        analyzer.createInitialState()
      );
      expect(analyzerSnapshot.data).toBeDefined();
      expect(analyzerSnapshot.state).toBeDefined();
      expect(analyzerSnapshot.derived).toBeDefined();

      // Summarizer snapshot
      const summarizerSnapshot = summarizer.createSnapshot(
        summarizer.createInitialData('ref'),
        summarizer.createInitialState()
      );
      expect(summarizerSnapshot.data).toBeDefined();
      expect(summarizerSnapshot.state).toBeDefined();
      expect(summarizerSnapshot.derived).toBeDefined();

      // Transformer snapshot
      const transformerSnapshot = transformer.createSnapshot(
        transformer.createInitialData('ref'),
        transformer.createInitialState()
      );
      expect(transformerSnapshot.data).toBeDefined();
      expect(transformerSnapshot.state).toBeDefined();
      expect(transformerSnapshot.derived).toBeDefined();
    });
  });
});
