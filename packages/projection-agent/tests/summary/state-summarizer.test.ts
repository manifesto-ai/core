import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import type { AgentPathInfo, AgentActionInfo, AgentDomainInfo } from '../../src/types.js';
import {
  categorizePathsByType,
  getInvalidPaths,
  getEmptyRequiredPaths,
  getFilledPaths,
  calculateCompletion,
  generateHighlights,
  generateIssues,
  summarizeActions,
  generateSummaryText,
  summarizeState,
  summarizeBlockers,
  summarizeNextSteps,
} from '../../src/summary/state-summarizer.js';

describe('State Summarizer', () => {
  const createMockPath = (overrides?: Partial<AgentPathInfo>): AgentPathInfo => ({
    path: 'data.test' as SemanticPath,
    value: 'test value',
    displayValue: 'test value',
    semantic: { type: 'input', description: 'Test field' },
    validity: { valid: true, issues: [] },
    policy: { relevant: true, editable: true, required: false, visible: true },
    ...overrides,
  });

  const createMockAction = (overrides?: Partial<AgentActionInfo>): AgentActionInfo => ({
    id: 'action.test',
    verb: 'test',
    description: 'Test action',
    canExecute: true,
    blockedReasons: [],
    willDo: [],
    risk: 'low',
    requiresInput: false,
    ...overrides,
  });

  const createMockDomain = (): AgentDomainInfo => ({
    id: 'test-domain',
    name: 'Test Domain',
    description: 'A test domain',
  });

  describe('categorizePathsByType', () => {
    it('should categorize paths by semantic type', () => {
      const paths = [
        createMockPath({ path: 'data.input1' as SemanticPath, semantic: { type: 'input', description: 'Input 1' } }),
        createMockPath({ path: 'data.input2' as SemanticPath, semantic: { type: 'input', description: 'Input 2' } }),
        createMockPath({ path: 'data.computed' as SemanticPath, semantic: { type: 'computed', description: 'Computed' } }),
      ];
      const categories = categorizePathsByType(paths);
      expect(categories['input']).toHaveLength(2);
      expect(categories['computed']).toHaveLength(1);
    });
  });

  describe('getInvalidPaths', () => {
    it('should return only invalid paths', () => {
      const paths = [
        createMockPath({ validity: { valid: true, issues: [] } }),
        createMockPath({ validity: { valid: false, issues: [{ code: 'err', message: 'Error', path: 'data.test' as SemanticPath, severity: 'error' }] } }),
      ];
      const invalid = getInvalidPaths(paths);
      expect(invalid).toHaveLength(1);
    });
  });

  describe('getEmptyRequiredPaths', () => {
    it('should return required paths that are empty', () => {
      const paths = [
        createMockPath({ value: '', policy: { relevant: true, editable: true, required: true, visible: true } }),
        createMockPath({ value: 'filled', policy: { relevant: true, editable: true, required: true, visible: true } }),
        createMockPath({ value: '', policy: { relevant: true, editable: true, required: false, visible: true } }),
      ];
      const emptyRequired = getEmptyRequiredPaths(paths);
      expect(emptyRequired).toHaveLength(1);
    });

    it('should detect null as empty', () => {
      const paths = [
        createMockPath({ value: null, policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      expect(getEmptyRequiredPaths(paths)).toHaveLength(1);
    });

    it('should detect undefined as empty', () => {
      const paths = [
        createMockPath({ value: undefined, policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      expect(getEmptyRequiredPaths(paths)).toHaveLength(1);
    });

    it('should detect empty array as empty', () => {
      const paths = [
        createMockPath({ value: [], policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      expect(getEmptyRequiredPaths(paths)).toHaveLength(1);
    });
  });

  describe('getFilledPaths', () => {
    it('should return non-empty paths', () => {
      const paths = [
        createMockPath({ value: 'filled' }),
        createMockPath({ value: '' }),
        createMockPath({ value: null }),
      ];
      const filled = getFilledPaths(paths);
      expect(filled).toHaveLength(1);
    });
  });

  describe('calculateCompletion', () => {
    it('should return 100 when no required fields', () => {
      const paths = [
        createMockPath({ policy: { relevant: true, editable: true, required: false, visible: true } }),
      ];
      expect(calculateCompletion(paths)).toBe(100);
    });

    it('should calculate percentage of filled required fields', () => {
      const paths = [
        createMockPath({ value: 'filled', policy: { relevant: true, editable: true, required: true, visible: true } }),
        createMockPath({ value: '', policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      expect(calculateCompletion(paths)).toBe(50);
    });

    it('should return 100 when all required fields are filled', () => {
      const paths = [
        createMockPath({ value: 'filled1', policy: { relevant: true, editable: true, required: true, visible: true } }),
        createMockPath({ value: 'filled2', policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      expect(calculateCompletion(paths)).toBe(100);
    });
  });

  describe('generateHighlights', () => {
    it('should generate highlights from filled paths', () => {
      const paths = [
        createMockPath({ value: 'John', displayValue: 'John', semantic: { type: 'input', description: 'Name' } }),
      ];
      const highlights = generateHighlights(paths);
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toContain('John');
    });

    it('should limit number of highlights', () => {
      const paths = Array.from({ length: 10 }, (_, i) =>
        createMockPath({ value: `value${i}`, displayValue: `value${i}`, path: `data.field${i}` as SemanticPath })
      );
      const highlights = generateHighlights(paths, 3);
      expect(highlights).toHaveLength(3);
    });
  });

  describe('generateIssues', () => {
    it('should include validation errors', () => {
      const paths = [
        createMockPath({
          validity: {
            valid: false,
            issues: [{ code: 'invalid', message: 'Invalid email', path: 'data.email' as SemanticPath, severity: 'error' }],
          },
          semantic: { type: 'input', description: 'Email' },
        }),
      ];
      const issues = generateIssues(paths);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Invalid email');
    });

    it('should include missing required fields', () => {
      const paths = [
        createMockPath({
          value: '',
          policy: { relevant: true, editable: true, required: true, visible: true },
          semantic: { type: 'input', description: 'Name' },
        }),
      ];
      const issues = generateIssues(paths);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('required');
    });
  });

  describe('summarizeActions', () => {
    it('should summarize available actions', () => {
      const actions = [
        createMockAction({ id: 'action.save', verb: 'save', canExecute: true }),
        createMockAction({ id: 'action.submit', verb: 'submit', canExecute: true }),
      ];
      const summary = summarizeActions(actions);
      expect(summary).toContain('2');
      expect(summary).toContain('save');
    });

    it('should indicate when no actions available', () => {
      const actions: AgentActionInfo[] = [];
      const summary = summarizeActions(actions);
      expect(summary).toContain('No actions');
    });

    it('should mention blocked actions', () => {
      const actions = [
        createMockAction({ canExecute: true }),
        createMockAction({ canExecute: false }),
      ];
      const summary = summarizeActions(actions);
      expect(summary).toContain('blocked');
    });
  });

  describe('generateSummaryText', () => {
    it('should generate complete summary', () => {
      const domain = createMockDomain();
      const paths = [
        createMockPath({ value: 'filled', policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      const actions = [createMockAction()];
      const summary = generateSummaryText(domain, paths, actions);
      expect(summary).toContain('Test Domain');
      // When 100%, it says "is complete" instead of "100%"
      expect(summary).toContain('is complete');
    });

    it('should indicate issues', () => {
      const domain = createMockDomain();
      const paths = [
        createMockPath({
          value: '',
          policy: { relevant: true, editable: true, required: true, visible: true },
        }),
      ];
      const actions: AgentActionInfo[] = [];
      const summary = generateSummaryText(domain, paths, actions);
      expect(summary).toContain('issue');
    });
  });

  describe('summarizeState', () => {
    it('should return complete summary object', () => {
      const domain = createMockDomain();
      const paths = [createMockPath({ value: 'filled' })];
      const actions = [createMockAction()];
      const summary = summarizeState(domain, paths, actions);

      expect(summary.text).toBeDefined();
      expect(summary.highlights).toBeDefined();
      expect(summary.issues).toBeDefined();
      expect(summary.completionPercent).toBeDefined();
    });
  });

  describe('summarizeBlockers', () => {
    it('should list missing required fields', () => {
      const paths = [
        createMockPath({
          value: '',
          policy: { relevant: true, editable: true, required: true, visible: true },
          semantic: { type: 'input', description: 'Email' },
        }),
      ];
      const actions: AgentActionInfo[] = [];
      const blockers = summarizeBlockers(paths, actions);
      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers[0]).toContain('Fill');
    });

    it('should list blocked action reasons', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({
          canExecute: false,
          blockedReasons: ['Email is required'],
        }),
      ];
      const blockers = summarizeBlockers(paths, actions);
      expect(blockers.some((b) => b.includes('Email'))).toBe(true);
    });
  });

  describe('summarizeNextSteps', () => {
    it('should list available actions', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ verb: 'save', description: 'Save changes' }),
      ];
      const steps = summarizeNextSteps(paths, actions);
      expect(steps.some((s) => s.includes('save'))).toBe(true);
    });

    it('should suggest optional fields', () => {
      const paths = [
        createMockPath({
          value: '',
          policy: { relevant: true, editable: true, required: false, visible: true },
          semantic: { type: 'input', description: 'Notes' },
        }),
      ];
      const actions: AgentActionInfo[] = [];
      const steps = summarizeNextSteps(paths, actions);
      expect(steps.some((s) => s.includes('Optionally'))).toBe(true);
    });
  });
});
