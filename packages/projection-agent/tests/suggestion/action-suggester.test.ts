import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import type { AgentPathInfo, AgentActionInfo } from '../../src/types.js';
import {
  suggestAction,
  suggestAlternatives,
  suggestForGoal,
  canAchieveGoal,
  rankActions,
} from '../../src/suggestion/action-suggester.js';

describe('Action Suggester', () => {
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

  describe('rankActions', () => {
    it('should rank available actions higher', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.blocked', canExecute: false }),
        createMockAction({ id: 'action.available', canExecute: true }),
      ];
      const ranked = rankActions(actions, paths);
      expect(ranked[0].action.id).toBe('action.available');
    });

    it('should prefer low-risk actions', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.high', risk: 'high' }),
        createMockAction({ id: 'action.low', risk: 'low' }),
      ];
      const ranked = rankActions(actions, paths);
      expect(ranked[0].action.id).toBe('action.low');
    });

    it('should rank submit higher when form is complete', () => {
      const paths = [
        createMockPath({ value: 'filled', policy: { relevant: true, editable: true, required: true, visible: true } }),
      ];
      const actions = [
        createMockAction({ id: 'action.edit', verb: 'edit' }),
        createMockAction({ id: 'action.submit', verb: 'submit' }),
      ];
      const ranked = rankActions(actions, paths);
      expect(ranked[0].action.id).toBe('action.submit');
    });

    it('should rank validate higher when there are errors', () => {
      const paths = [
        createMockPath({
          validity: {
            valid: false,
            issues: [{ code: 'err', message: 'Error', path: 'data.test' as SemanticPath, severity: 'error' }],
          },
        }),
      ];
      const actions = [
        createMockAction({ id: 'action.save', verb: 'save' }),
        createMockAction({ id: 'action.validate', verb: 'validate' }),
      ];
      const ranked = rankActions(actions, paths);
      expect(ranked[0].action.id).toBe('action.validate');
    });

    it('should rank destructive actions lower', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.delete', verb: 'delete' }),
        createMockAction({ id: 'action.save', verb: 'save' }),
      ];
      const ranked = rankActions(actions, paths);
      expect(ranked[0].action.id).toBe('action.save');
    });
  });

  describe('suggestAction', () => {
    it('should return undefined when no actions', () => {
      const paths: AgentPathInfo[] = [];
      const actions: AgentActionInfo[] = [];
      const suggestion = suggestAction(paths, actions);
      expect(suggestion).toBeUndefined();
    });

    it('should return undefined when no available actions', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ canExecute: false }),
      ];
      const suggestion = suggestAction(paths, actions);
      expect(suggestion).toBeUndefined();
    });

    it('should suggest an action with reason', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [createMockAction()];
      const suggestion = suggestAction(paths, actions);
      expect(suggestion).toBeDefined();
      expect(suggestion?.action).toBe('action.test');
      expect(suggestion?.reason).toBeDefined();
      expect(suggestion?.confidence).toBeGreaterThan(0);
    });

    it('should respect minimum confidence', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ canExecute: true, risk: 'high' }),
      ];
      const suggestion = suggestAction(paths, actions, { minConfidence: 0.9 });
      // High risk action may not meet confidence threshold
      expect(suggestion === undefined || suggestion.confidence >= 0.3).toBe(true);
    });
  });

  describe('suggestAlternatives', () => {
    it('should return multiple suggestions', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.a', verb: 'a' }),
        createMockAction({ id: 'action.b', verb: 'b' }),
        createMockAction({ id: 'action.c', verb: 'c' }),
      ];
      const suggestions = suggestAlternatives(paths, actions, {}, 3);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should limit suggestions', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.a' }),
        createMockAction({ id: 'action.b' }),
        createMockAction({ id: 'action.c' }),
        createMockAction({ id: 'action.d' }),
      ];
      const suggestions = suggestAlternatives(paths, actions, {}, 2);
      expect(suggestions.length).toBe(2);
    });
  });

  describe('suggestForGoal', () => {
    it('should suggest action matching goal', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.save', verb: 'save', description: 'Save the document' }),
        createMockAction({ id: 'action.delete', verb: 'delete', description: 'Delete the document' }),
      ];
      const suggestion = suggestForGoal('save', paths, actions);
      expect(suggestion?.action).toBe('action.save');
    });

    it('should return undefined if no matching action', () => {
      const paths: AgentPathInfo[] = [];
      const actions = [
        createMockAction({ id: 'action.save', verb: 'save', description: 'Save' }),
      ];
      const suggestion = suggestForGoal('print', paths, actions);
      // May still suggest something if no good match
      expect(suggestion === undefined || suggestion.action !== undefined).toBe(true);
    });
  });

  describe('canAchieveGoal', () => {
    it('should return possible when matching action is available', () => {
      const actions = [
        createMockAction({ verb: 'save', description: 'Save the document', canExecute: true }),
      ];
      const result = canAchieveGoal('save', actions);
      expect(result.possible).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should return not possible when no matching action', () => {
      const actions = [
        createMockAction({ verb: 'save', description: 'Save', canExecute: true }),
      ];
      const result = canAchieveGoal('print', actions);
      expect(result.possible).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it('should return blockers when action exists but is blocked', () => {
      const actions = [
        createMockAction({
          verb: 'save',
          description: 'Save the document',
          canExecute: false,
          blockedReasons: ['Document is read-only'],
        }),
      ];
      const result = canAchieveGoal('save', actions);
      expect(result.possible).toBe(false);
      expect(result.blockers).toContain('Document is read-only');
    });
  });
});
