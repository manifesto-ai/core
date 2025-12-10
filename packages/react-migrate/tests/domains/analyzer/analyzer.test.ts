import { describe, it, expect } from 'vitest';
import {
  createInitialData,
  createInitialState,
  addToQueue,
  getNextTask,
  setCurrentTask,
  completeTask,
  failTask,
  skipTask,
  addDomainCandidate,
  addDomainCandidates,
  addAmbiguousPattern,
  resolveAmbiguousPattern,
  setDependencyGraph,
  incrementAttempts,
  setLastProcessedFile,
  updateProcessingRate,
  calculateDerived,
  isAnalysisComplete,
  needsHITL,
} from '../../../src/domains/analyzer/analyzer.js';
import type {
  FileTask,
  DomainCandidate,
  AmbiguousPattern,
} from '../../../src/domains/analyzer/types.js';
import type { FileAnalysis, DetectedPattern } from '../../../src/parser/types.js';

describe('Analyzer Domain', () => {
  describe('Initial State', () => {
    it('should create initial data with default config', () => {
      const data = createInitialData();

      expect(data.queue).toHaveLength(0);
      expect(data.current).toBeNull();
      expect(data.results).toEqual({});
      expect(data.domainCandidates).toEqual({});
      expect(data.config.confidenceThreshold).toBe(0.7);
      expect(data.config.enableLLMFallback).toBe(true);
      expect(data.config.maxConcurrency).toBe(1);
    });

    it('should create initial data with custom config', () => {
      const data = createInitialData({
        confidenceThreshold: 0.8,
        enableLLMFallback: false,
      });

      expect(data.config.confidenceThreshold).toBe(0.8);
      expect(data.config.enableLLMFallback).toBe(false);
    });

    it('should create initial state', () => {
      const state = createInitialState();

      expect(state.patterns.components).toHaveLength(0);
      expect(state.patterns.hooks).toHaveLength(0);
      expect(state.patterns.contexts).toHaveLength(0);
      expect(state.patterns.reducers).toHaveLength(0);
      expect(state.patterns.effects).toHaveLength(0);
      expect(state.ambiguous).toHaveLength(0);
      expect(state.dependencyGraph.nodes).toHaveLength(0);
      expect(state.dependencyGraph.edges).toHaveLength(0);
      expect(state.meta.attempts).toBe(0);
      expect(state.meta.confidence).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should add tasks to queue', () => {
      const data = createInitialData();
      const tasks: FileTask[] = [
        { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 80, dependencies: [], status: 'pending' },
        { path: '/src/b.tsx', relativePath: 'src/b.tsx', priority: 60, dependencies: [], status: 'pending' },
      ];

      const updated = addToQueue(data, tasks);

      expect(updated.queue).toHaveLength(2);
      expect(updated.queue[0]?.priority).toBe(80);
    });

    it('should get next task by priority', () => {
      const data = createInitialData();
      const tasks: FileTask[] = [
        { path: '/src/low.tsx', relativePath: 'src/low.tsx', priority: 30, dependencies: [], status: 'pending' },
        { path: '/src/high.tsx', relativePath: 'src/high.tsx', priority: 90, dependencies: [], status: 'pending' },
        { path: '/src/mid.tsx', relativePath: 'src/mid.tsx', priority: 50, dependencies: [], status: 'pending' },
      ];
      const withTasks = addToQueue(data, tasks);

      const next = getNextTask(withTasks);

      expect(next).toBeDefined();
      expect(next?.path).toBe('/src/high.tsx');
    });

    it('should return null when no pending tasks', () => {
      const data = createInitialData();
      const tasks: FileTask[] = [
        { path: '/src/done.tsx', relativePath: 'src/done.tsx', priority: 50, dependencies: [], status: 'done' },
      ];
      const withTasks = addToQueue(data, tasks);

      const next = getNextTask(withTasks);

      expect(next).toBeNull();
    });

    it('should set current task', () => {
      const data = createInitialData();
      const task: FileTask = { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'pending' };
      const withTask = addToQueue(data, [task]);

      const updated = setCurrentTask(withTask, task);

      expect(updated.current?.path).toBe('/src/a.tsx');
      expect(updated.queue[0]?.status).toBe('in_progress');
    });
  });

  describe('Task Completion', () => {
    it('should complete task with analysis result', () => {
      const data = createInitialData();
      const state = createInitialState();
      const task: FileTask = { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'in_progress' };
      const withTask = { ...addToQueue(data, [task]), current: task };

      const analysis: FileAnalysis = {
        path: '/src/a.tsx',
        relativePath: 'src/a.tsx',
        type: 'component',
        ast: null,
        patterns: [
          { type: 'component', name: 'MyComponent', location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } }, confidence: 0.95, metadata: {}, needsReview: false },
        ],
        imports: [],
        exports: [],
        confidence: 0.95,
        issues: [],
        parseTime: 10,
      };

      const result = completeTask(withTask, state, '/src/a.tsx', analysis);

      expect(result.data.results['/src/a.tsx']).toBeDefined();
      expect(result.data.queue[0]?.status).toBe('done');
      // Note: completeTask does not reset current to null
      expect(result.data.current?.status).toBe('done');
      expect(result.state.patterns.components).toHaveLength(1);
    });

    it('should fail task with error', () => {
      const data = createInitialData();
      const state = createInitialState();
      const task: FileTask = { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'in_progress' };
      const withTask = { ...addToQueue(data, [task]), current: task };

      const result = failTask(withTask, state, '/src/a.tsx', 'Parse error');

      expect(result.data.queue[0]?.status).toBe('failed');
      expect(result.state.meta.errors).toHaveLength(1);
      expect(result.state.meta.errors[0]?.error).toBe('Parse error');
    });

    it('should skip task with reason', () => {
      const data = createInitialData();
      const task: FileTask = { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'pending' };
      const withTask = addToQueue(data, [task]);

      const updated = skipTask(withTask, '/src/a.tsx', 'Not a React file');

      expect(updated.queue[0]?.status).toBe('skipped');
    });
  });

  describe('Domain Candidates', () => {
    it('should add single domain candidate', () => {
      const data = createInitialData();
      const candidate: DomainCandidate = {
        id: 'domain-1',
        name: 'user',
        description: 'User domain',
        files: ['/src/useUser.ts'],
        patterns: [],
        confidence: 0.85,
        suggestedBy: 'hook',
        relationships: [],
      };

      const updated = addDomainCandidate(data, candidate);

      expect(updated.domainCandidates['domain-1']).toBeDefined();
      expect(updated.domainCandidates['domain-1']?.name).toBe('user');
    });

    it('should add multiple domain candidates', () => {
      const data = createInitialData();
      const candidates: DomainCandidate[] = [
        { id: 'domain-1', name: 'user', description: '', files: [], patterns: [], confidence: 0.8, suggestedBy: 'hook', relationships: [] },
        { id: 'domain-2', name: 'auth', description: '', files: [], patterns: [], confidence: 0.9, suggestedBy: 'context', relationships: [] },
      ];

      const updated = addDomainCandidates(data, candidates);

      expect(Object.keys(updated.domainCandidates)).toHaveLength(2);
    });
  });

  describe('Ambiguous Patterns', () => {
    it('should add ambiguous pattern', () => {
      const state = createInitialState();
      const ambiguous: AmbiguousPattern = {
        id: 'ambig-1',
        filePath: '/src/useAuth.ts',
        pattern: { type: 'hook', name: 'useAuth', location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } }, confidence: 0.5, metadata: {}, needsReview: true },
        reason: 'Low confidence',
        suggestedResolutions: [],
      };

      const updated = addAmbiguousPattern(state, ambiguous);

      expect(updated.ambiguous).toHaveLength(1);
      expect(updated.ambiguous[0]?.id).toBe('ambig-1');
    });

    it('should resolve ambiguous pattern', () => {
      const state = createInitialState();
      const ambiguous: AmbiguousPattern = {
        id: 'ambig-1',
        filePath: '/src/useAuth.ts',
        pattern: { type: 'hook', name: 'useAuth', location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } }, confidence: 0.5, metadata: {}, needsReview: true },
        reason: 'Low confidence',
        suggestedResolutions: [],
      };
      const withAmbiguous = addAmbiguousPattern(state, ambiguous);

      const updated = resolveAmbiguousPattern(withAmbiguous, 'ambig-1', 'keep');

      expect(updated.ambiguous[0]?.resolution).toBe('keep');
    });
  });

  describe('Dependency Graph', () => {
    it('should set dependency graph', () => {
      const state = createInitialState();
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx'],
        edges: [{ from: '/src/a.tsx', to: '/src/b.tsx', type: 'import' as const }],
        adjacencyList: { '/src/a.tsx': ['/src/b.tsx'], '/src/b.tsx': [] },
        reverseAdjacencyList: { '/src/a.tsx': [], '/src/b.tsx': ['/src/a.tsx'] },
      };

      const updated = setDependencyGraph(state, graph);

      expect(updated.dependencyGraph.nodes).toHaveLength(2);
      expect(updated.dependencyGraph.edges).toHaveLength(1);
    });
  });

  describe('Meta Updates', () => {
    it('should increment attempts', () => {
      const state = createInitialState();

      const updated = incrementAttempts(state);

      expect(updated.meta.attempts).toBe(1);
    });

    it('should set last processed file', () => {
      const state = createInitialState();

      const updated = setLastProcessedFile(state, '/src/file.tsx');

      expect(updated.meta.lastProcessedFile).toBe('/src/file.tsx');
    });

    it('should update processing rate', () => {
      const state = createInitialState();

      const updated = updateProcessingRate(state, 10, 5); // 10 files in 5 seconds

      expect(updated.meta.processingRate).toBe(2);
    });
  });

  describe('Derived Calculations', () => {
    it('should calculate derived values', () => {
      const data = createInitialData();
      const state = createInitialState();

      const tasks: FileTask[] = [
        { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'done' },
        { path: '/src/b.tsx', relativePath: 'src/b.tsx', priority: 50, dependencies: [], status: 'done' },
        { path: '/src/c.tsx', relativePath: 'src/c.tsx', priority: 50, dependencies: [], status: 'pending' },
      ];
      const withTasks = addToQueue(data, tasks);

      const derived = calculateDerived(withTasks, state);

      expect(derived.filesTotal).toBe(3);
      expect(derived.filesProcessed).toBe(2);
      // Progress is 0-100 percent, not 0-1 ratio
      expect(derived.progress).toBeCloseTo(66.67, 1);
    });

    it('should handle empty queue', () => {
      const data = createInitialData();
      const state = createInitialState();

      const derived = calculateDerived(data, state);

      expect(derived.filesTotal).toBe(0);
      expect(derived.filesProcessed).toBe(0);
      expect(derived.progress).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should check if analysis is complete', () => {
      const data = createInitialData();

      expect(isAnalysisComplete(data)).toBe(true); // empty queue is complete

      const tasks: FileTask[] = [
        { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'pending' },
      ];
      const withTasks = addToQueue(data, tasks);

      expect(isAnalysisComplete(withTasks)).toBe(false);

      const withDoneTasks = addToQueue(data, [
        { path: '/src/a.tsx', relativePath: 'src/a.tsx', priority: 50, dependencies: [], status: 'done' },
      ]);

      expect(isAnalysisComplete(withDoneTasks)).toBe(true);
    });

    it('should determine if pattern needs HITL', () => {
      const lowConfidence: DetectedPattern = {
        type: 'hook',
        name: 'useAuth',
        location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } },
        confidence: 0.5,
        metadata: {},
        needsReview: false,
      };

      const markedForReview: DetectedPattern = {
        type: 'hook',
        name: 'useAuth',
        location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } },
        confidence: 0.9,
        metadata: {},
        needsReview: true,
      };

      const highConfidence: DetectedPattern = {
        type: 'hook',
        name: 'useAuth',
        location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } },
        confidence: 0.9,
        metadata: {},
        needsReview: false,
      };

      expect(needsHITL(lowConfidence, 0.7)).toBe(true);
      expect(needsHITL(markedForReview, 0.7)).toBe(true);
      expect(needsHITL(highConfidence, 0.7)).toBe(false);
    });
  });
});
