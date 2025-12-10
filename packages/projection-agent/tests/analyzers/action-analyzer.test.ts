import { describe, it, expect } from 'vitest';
import type { ActionDefinition, PreconditionStatus } from '@manifesto-ai/core';
import {
  preconditionsToBlockedReasons,
  analyzeAction,
  analyzeAllActions,
  getAvailableActions,
  getBlockedActions,
  groupActionsByRisk,
  zodToJsonSchema,
} from '../../src/analyzers/action-analyzer.js';

describe('Action Analyzer', () => {
  describe('preconditionsToBlockedReasons', () => {
    it('should return empty array when all satisfied', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.email' as any, satisfied: true, actual: 'test@test.com', expect: 'non-empty' },
      ];
      expect(preconditionsToBlockedReasons(preconditions)).toEqual([]);
    });

    it('should return reasons for unsatisfied preconditions', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.email' as any, satisfied: false, actual: '', expect: 'non-empty' },
      ];
      const reasons = preconditionsToBlockedReasons(preconditions);
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('data.email');
    });

    it('should use explicit reason if available', () => {
      const preconditions: PreconditionStatus[] = [
        {
          path: 'data.email' as any,
          satisfied: false,
          actual: '',
          expect: 'non-empty',
          reason: 'Email is required',
        },
      ];
      const reasons = preconditionsToBlockedReasons(preconditions);
      expect(reasons[0]).toBe('Email is required');
    });

    it('should handle various value types', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.null' as any, satisfied: false, actual: null, expect: 'non-null' },
        { path: 'data.undefined' as any, satisfied: false, actual: undefined, expect: 'defined' },
        { path: 'data.boolean' as any, satisfied: false, actual: false, expect: 'true' },
        { path: 'data.number' as any, satisfied: false, actual: 0, expect: '> 0' },
      ];
      const reasons = preconditionsToBlockedReasons(preconditions);
      expect(reasons).toHaveLength(4);
      expect(reasons[0]).toContain('null');
      expect(reasons[1]).toContain('undefined');
      expect(reasons[2]).toContain('false');
      expect(reasons[3]).toContain('0');
    });
  });

  describe('analyzeAction', () => {
    const createMockAction = (overrides?: Partial<ActionDefinition>): ActionDefinition => ({
      semantic: {
        verb: 'submit',
        type: 'action',
        description: 'Submit the form',
      },
      ...overrides,
    });

    it('should analyze an action with no preconditions', () => {
      const action = createMockAction();
      const result = analyzeAction('action.submit', action, []);

      expect(result.id).toBe('action.submit');
      expect(result.verb).toBe('submit');
      expect(result.description).toBe('Submit the form');
      expect(result.canExecute).toBe(true);
      expect(result.blockedReasons).toEqual([]);
    });

    it('should mark action as blocked when preconditions fail', () => {
      const action = createMockAction();
      const preconditions: PreconditionStatus[] = [
        { path: 'data.email' as any, satisfied: false, actual: '', expect: 'non-empty' },
      ];
      const result = analyzeAction('action.submit', action, preconditions);

      expect(result.canExecute).toBe(false);
      expect(result.blockedReasons).toHaveLength(1);
    });

    it('should include effect description in willDo', () => {
      const action = createMockAction({
        effect: {
          _tag: 'SetValue',
          path: 'data.submitted' as any,
          value: true,
          description: 'Mark form as submitted',
        },
      });
      const result = analyzeAction('action.submit', action, []);

      expect(result.willDo).toContain('Mark form as submitted');
    });

    it('should assess risk level', () => {
      const action = createMockAction({
        semantic: {
          verb: 'delete',
          type: 'action',
          description: 'Delete the item',
          risk: 'high',
        },
      });
      const result = analyzeAction('action.delete', action, []);

      expect(result.risk).toBe('high');
    });
  });

  describe('analyzeAllActions', () => {
    it('should analyze multiple actions', () => {
      const actions: Record<string, ActionDefinition> = {
        'action.save': {
          semantic: { verb: 'save', type: 'action', description: 'Save changes' },
        },
        'action.cancel': {
          semantic: { verb: 'cancel', type: 'action', description: 'Cancel changes' },
        },
      };
      const getPreconditions = () => [];
      const results = analyzeAllActions(actions, getPreconditions);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain('action.save');
      expect(results.map((r) => r.id)).toContain('action.cancel');
    });
  });

  describe('getAvailableActions', () => {
    it('should filter to available actions', () => {
      const actions = [
        { id: 'a1', canExecute: true, verb: 'a', description: 'a', blockedReasons: [], willDo: [], risk: 'low' as const, requiresInput: false },
        { id: 'a2', canExecute: false, verb: 'b', description: 'b', blockedReasons: ['reason'], willDo: [], risk: 'low' as const, requiresInput: false },
      ];
      const available = getAvailableActions(actions);

      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('a1');
    });
  });

  describe('getBlockedActions', () => {
    it('should filter to blocked actions', () => {
      const actions = [
        { id: 'a1', canExecute: true, verb: 'a', description: 'a', blockedReasons: [], willDo: [], risk: 'low' as const, requiresInput: false },
        { id: 'a2', canExecute: false, verb: 'b', description: 'b', blockedReasons: ['reason'], willDo: [], risk: 'low' as const, requiresInput: false },
      ];
      const blocked = getBlockedActions(actions);

      expect(blocked).toHaveLength(1);
      expect(blocked[0].id).toBe('a2');
    });
  });

  describe('groupActionsByRisk', () => {
    it('should group actions by risk level', () => {
      const actions = [
        { id: 'a1', canExecute: true, verb: 'a', description: 'a', blockedReasons: [], willDo: [], risk: 'low' as const, requiresInput: false },
        { id: 'a2', canExecute: true, verb: 'b', description: 'b', blockedReasons: [], willDo: [], risk: 'medium' as const, requiresInput: false },
        { id: 'a3', canExecute: true, verb: 'c', description: 'c', blockedReasons: [], willDo: [], risk: 'high' as const, requiresInput: false },
      ];
      const grouped = groupActionsByRisk(actions);

      expect(grouped.low).toHaveLength(1);
      expect(grouped.medium).toHaveLength(1);
      expect(grouped.high).toHaveLength(1);
    });
  });

  describe('zodToJsonSchema', () => {
    it('should return undefined for non-Zod values', () => {
      expect(zodToJsonSchema(null)).toBeUndefined();
      expect(zodToJsonSchema({})).toBeUndefined();
    });

    it('should convert ZodString', () => {
      const mockZodString = { _def: { typeName: 'ZodString' } };
      expect(zodToJsonSchema(mockZodString)).toEqual({ type: 'string' });
    });

    it('should convert ZodNumber', () => {
      const mockZodNumber = { _def: { typeName: 'ZodNumber' } };
      expect(zodToJsonSchema(mockZodNumber)).toEqual({ type: 'number' });
    });

    it('should convert ZodBoolean', () => {
      const mockZodBoolean = { _def: { typeName: 'ZodBoolean' } };
      expect(zodToJsonSchema(mockZodBoolean)).toEqual({ type: 'boolean' });
    });
  });
});
