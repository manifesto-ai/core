import { describe, it, expect } from 'vitest';
import {
  createInitialData,
  createInitialState,
  startAnalysis,
  updateProgress,
  setPhase,
  requestHITL,
  resolveHITL,
  upgradeModel,
  setError,
  addDiscoveredDomain,
  calculateConfidence,
  calculateCanProceed,
  complete,
} from '../../src/domains/orchestrator.js';
import type { HITLRequest, DiscoveredDomain } from '../../src/domains/types.js';

describe('Orchestrator Domain', () => {
  describe('Initial State', () => {
    it('should create initial data', () => {
      const data = createInitialData('/test/path', '/test/output');

      expect(data.phase).toBe('INIT');
      expect(data.progress.total).toBe(0);
      expect(data.progress.completed).toBe(0);
      expect(data.rootDir).toBe('/test/path');
      expect(data.outputDir).toBe('/test/output');
      expect(data.discoveredDomains).toHaveLength(0);
    });

    it('should create initial state', () => {
      const state = createInitialState();

      expect(state.children.analyzer).toBeNull();
      expect(state.children.summarizer).toBeNull();
      expect(state.children.transformer).toBeNull();
      expect(state.hitl.pending).toBe(false);
      expect(state.hitl.request).toBeNull();
      expect(state.meta.attempts).toBe(0);
      expect(state.meta.currentModel).toBe('gpt-4o-mini');
    });
  });

  describe('Actions', () => {
    it('should start analysis', () => {
      const data = createInitialData();
      const state = createInitialState();

      const result = startAnalysis(data, state, {
        rootDir: '/new/path',
        outputDir: '/new/output',
      });

      expect(result.data.phase).toBe('ANALYZING');
      expect(result.data.rootDir).toBe('/new/path');
      expect(result.state.meta.attempts).toBe(1);
    });

    it('should update progress', () => {
      const data = createInitialData();

      const updated = updateProgress(data, {
        total: 100,
        completed: 50,
      });

      expect(updated.progress.total).toBe(100);
      expect(updated.progress.completed).toBe(50);
    });

    it('should set phase', () => {
      const data = createInitialData();

      const updated = setPhase(data, 'SUMMARIZING');

      expect(updated.phase).toBe('SUMMARIZING');
    });

    it('should request HITL', () => {
      const state = createInitialState();
      const request: HITLRequest = {
        file: '/test/file.tsx',
        pattern: 'useState pattern',
        question: 'How should this be converted?',
        options: [
          { id: '1', label: 'Option A', action: 'convert', confidence: 0.8 },
          { id: '2', label: 'Option B', action: 'skip', confidence: 0.5 },
        ],
      };

      const updated = requestHITL(state, request);

      expect(updated.hitl.pending).toBe(true);
      expect(updated.hitl.request).toEqual(request);
    });

    it('should resolve HITL', () => {
      const state = createInitialState();
      const request: HITLRequest = {
        file: '/test/file.tsx',
        pattern: null,
        question: 'Question?',
        options: [{ id: '1', label: 'Yes', action: 'yes', confidence: 1 }],
      };

      const withRequest = requestHITL(state, request);
      const resolved = resolveHITL(withRequest, '1', 'Custom input');

      expect(resolved.hitl.pending).toBe(false);
      expect(resolved.hitl.request).toBeNull();
      expect(resolved.hitl.history).toHaveLength(1);
      expect(resolved.hitl.history[0]?.response.optionId).toBe('1');
      expect(resolved.hitl.history[0]?.response.customInput).toBe('Custom input');
    });

    it('should upgrade model', () => {
      const state = createInitialState();

      const updated = upgradeModel(state, 'gpt-4o');

      expect(updated.meta.currentModel).toBe('gpt-4o');
    });

    it('should set error', () => {
      const data = createInitialData();
      const state = createInitialState();

      const result = setError(data, state, 'Something went wrong');

      expect(result.data.phase).toBe('FAILED');
      expect(result.state.meta.lastError).toBe('Something went wrong');
    });

    it('should add discovered domain', () => {
      const data = createInitialData();
      const domain: DiscoveredDomain = {
        name: 'user',
        description: 'User management domain',
        files: ['/src/hooks/useUser.ts'],
        confidence: 0.9,
        status: 'pending',
      };

      const updated = addDiscoveredDomain(data, domain);

      expect(updated.discoveredDomains).toHaveLength(1);
      expect(updated.discoveredDomains[0]?.name).toBe('user');
    });

    it('should complete migration', () => {
      const data = createInitialData();
      const analyzing = setPhase(data, 'TRANSFORMING');

      const completed = complete(analyzing);

      expect(completed.phase).toBe('COMPLETE');
    });
  });

  describe('Derived Calculations', () => {
    it('should calculate confidence', () => {
      const data = createInitialData();
      data.progress.total = 100;
      data.progress.completed = 75;

      const confidence = calculateConfidence(data);

      expect(confidence).toBe(0.75);
    });

    it('should return 0 confidence when no files', () => {
      const data = createInitialData();

      const confidence = calculateConfidence(data);

      expect(confidence).toBe(0);
    });

    it('should calculate canProceed', () => {
      const data = createInitialData();
      const state = createInitialState();

      expect(calculateCanProceed(data, state)).toBe(true);

      // With pending HITL
      const withHITL = requestHITL(state, {
        file: '/test',
        pattern: null,
        question: 'Q?',
        options: [],
      });
      expect(calculateCanProceed(data, withHITL)).toBe(false);

      // With failed phase
      const failedData = setPhase(data, 'FAILED');
      expect(calculateCanProceed(failedData, state)).toBe(false);
    });
  });
});
