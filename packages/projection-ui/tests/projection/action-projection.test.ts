import { describe, it, expect } from 'vitest';
import type { PreconditionStatus } from '@manifesto-ai/core';
import {
  projectActionState,
  projectActionStates,
  createActionProjectionDiff,
  isActionStateEqual,
  getAvailableActions,
  getUnavailableActions,
  getExecutingActions,
  setExecuting,
} from '../../src/projection/action-projection.js';
import type { UIActionState, UIActionStateMap } from '../../src/types.js';

describe('action-projection', () => {
  describe('projectActionState', () => {
    it('should project an available action', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.name', expect: 'string', actual: 'John', satisfied: true, reason: 'Name is valid' },
        { path: 'data.age', expect: '>= 18', actual: 25, satisfied: true, reason: 'Is adult' },
      ];

      const state = projectActionState('action.submit', preconditions);

      expect(state.actionId).toBe('action.submit');
      expect(state.available).toBe(true);
      expect(state.executing).toBe(false);
      expect(state.unavailableReasons).toHaveLength(0);
      expect(state.preconditions).toHaveLength(2);
      expect(state.preconditions[0]?.path).toBe('data.name');
      expect(state.preconditions[0]?.satisfied).toBe(true);
    });

    it('should project an unavailable action with reasons', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.name', expect: 'non-empty', actual: '', satisfied: false, reason: 'Name is required' },
        { path: 'data.age', expect: '>= 18', actual: 15, satisfied: false, reason: 'Must be 18 or older' },
      ];

      const state = projectActionState('action.submit', preconditions);

      expect(state.available).toBe(false);
      expect(state.unavailableReasons).toHaveLength(2);
      expect(state.unavailableReasons).toContain('Name is required');
      expect(state.unavailableReasons).toContain('Must be 18 or older');
    });

    it('should generate reason from path and expect when reason is missing', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.name', expect: 'non-empty', actual: '', satisfied: false, reason: '' },
      ];

      const state = projectActionState('action.submit', preconditions);

      expect(state.unavailableReasons[0]).toBe('data.name must be non-empty');
    });

    it('should exclude preconditions when configured', () => {
      const preconditions: PreconditionStatus[] = [
        { path: 'data.name', expect: 'string', actual: 'John', satisfied: true, reason: '' },
      ];

      const state = projectActionState('action.submit', preconditions, {
        includePreconditions: false,
      });

      expect(state.preconditions).toHaveLength(0);
    });

    it('should project action with empty preconditions as available', () => {
      const state = projectActionState('action.noConditions', []);

      expect(state.available).toBe(true);
      expect(state.unavailableReasons).toHaveLength(0);
    });
  });

  describe('projectActionStates', () => {
    it('should project multiple actions', () => {
      const actions = new Map<string, PreconditionStatus[]>([
        ['action.submit', [{ path: 'data.name', expect: 'string', actual: 'John', satisfied: true, reason: '' }]],
        ['action.delete', [{ path: 'state.canDelete', expect: 'true', actual: false, satisfied: false, reason: 'Cannot delete' }]],
      ]);

      const states = projectActionStates(actions);

      expect(states.size).toBe(2);
      expect(states.get('action.submit')?.available).toBe(true);
      expect(states.get('action.delete')?.available).toBe(false);
    });

    it('should return empty map for empty input', () => {
      const states = projectActionStates(new Map());
      expect(states.size).toBe(0);
    });
  });

  describe('isActionStateEqual', () => {
    const baseState: UIActionState = {
      actionId: 'action.submit',
      available: true,
      executing: false,
      unavailableReasons: [],
      preconditions: [{ path: 'data.name', satisfied: true, reason: 'OK' }],
      updatedAt: 1000,
    };

    it('should return true for equal states', () => {
      const other: UIActionState = { ...baseState, updatedAt: 2000 };
      expect(isActionStateEqual(baseState, other)).toBe(true);
    });

    it('should return true ignoring executing flag', () => {
      const other: UIActionState = { ...baseState, executing: true };
      expect(isActionStateEqual(baseState, other)).toBe(true);
    });

    it('should return false when available differs', () => {
      const other: UIActionState = { ...baseState, available: false };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when actionId differs', () => {
      const other: UIActionState = { ...baseState, actionId: 'action.delete' };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when unavailableReasons length differs', () => {
      const other: UIActionState = { ...baseState, unavailableReasons: ['Reason 1'] };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when unavailableReasons content differs', () => {
      const stateWithReasons: UIActionState = { ...baseState, unavailableReasons: ['Reason A'] };
      const other: UIActionState = { ...baseState, unavailableReasons: ['Reason B'] };
      expect(isActionStateEqual(stateWithReasons, other)).toBe(false);
    });

    it('should return false when preconditions length differs', () => {
      const other: UIActionState = { ...baseState, preconditions: [] };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when precondition path differs', () => {
      const other: UIActionState = {
        ...baseState,
        preconditions: [{ path: 'data.email', satisfied: true, reason: 'OK' }],
      };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when precondition satisfied differs', () => {
      const other: UIActionState = {
        ...baseState,
        preconditions: [{ path: 'data.name', satisfied: false, reason: 'OK' }],
      };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when precondition reason differs', () => {
      const other: UIActionState = {
        ...baseState,
        preconditions: [{ path: 'data.name', satisfied: true, reason: 'Different' }],
      };
      expect(isActionStateEqual(baseState, other)).toBe(false);
    });
  });

  describe('createActionProjectionDiff', () => {
    const baseState: UIActionState = {
      actionId: 'action.submit',
      available: true,
      executing: false,
      unavailableReasons: [],
      preconditions: [],
      updatedAt: 1000,
    };

    it('should detect added actions', () => {
      const previous: UIActionStateMap = new Map();
      const current: UIActionStateMap = new Map([['action.submit', baseState]]);

      const diff = createActionProjectionDiff(previous, current);
      expect(diff).toContain('action.submit');
    });

    it('should detect removed actions', () => {
      const previous: UIActionStateMap = new Map([['action.submit', baseState]]);
      const current: UIActionStateMap = new Map();

      const diff = createActionProjectionDiff(previous, current);
      expect(diff).toContain('action.submit');
    });

    it('should detect changed availability', () => {
      const previous: UIActionStateMap = new Map([['action.submit', baseState]]);
      const current: UIActionStateMap = new Map([
        ['action.submit', { ...baseState, available: false }],
      ]);

      const diff = createActionProjectionDiff(previous, current);
      expect(diff).toContain('action.submit');
    });

    it('should return empty array when nothing changed', () => {
      const previous: UIActionStateMap = new Map([['action.submit', baseState]]);
      const current: UIActionStateMap = new Map([
        ['action.submit', { ...baseState, updatedAt: 2000 }],
      ]);

      const diff = createActionProjectionDiff(previous, current);
      expect(diff).toHaveLength(0);
    });
  });

  describe('getAvailableActions', () => {
    it('should filter to only available actions', () => {
      const states: UIActionStateMap = new Map([
        ['action.submit', { actionId: 'action.submit', available: true, executing: false, unavailableReasons: [], preconditions: [], updatedAt: 1000 }],
        ['action.delete', { actionId: 'action.delete', available: false, executing: false, unavailableReasons: ['Not allowed'], preconditions: [], updatedAt: 1000 }],
      ]);

      const available = getAvailableActions(states);

      expect(available.size).toBe(1);
      expect(available.has('action.submit')).toBe(true);
      expect(available.has('action.delete')).toBe(false);
    });
  });

  describe('getUnavailableActions', () => {
    it('should get unavailable actions with reasons', () => {
      const states: UIActionStateMap = new Map([
        ['action.submit', { actionId: 'action.submit', available: true, executing: false, unavailableReasons: [], preconditions: [], updatedAt: 1000 }],
        ['action.delete', { actionId: 'action.delete', available: false, executing: false, unavailableReasons: ['Not allowed', 'Missing permission'], preconditions: [], updatedAt: 1000 }],
      ]);

      const unavailable = getUnavailableActions(states);

      expect(unavailable.size).toBe(1);
      expect(unavailable.get('action.delete')).toEqual(['Not allowed', 'Missing permission']);
    });
  });

  describe('getExecutingActions', () => {
    it('should get currently executing actions', () => {
      const states: UIActionStateMap = new Map([
        ['action.submit', { actionId: 'action.submit', available: true, executing: true, unavailableReasons: [], preconditions: [], updatedAt: 1000 }],
        ['action.delete', { actionId: 'action.delete', available: true, executing: false, unavailableReasons: [], preconditions: [], updatedAt: 1000 }],
      ]);

      const executing = getExecutingActions(states);

      expect(executing).toHaveLength(1);
      expect(executing).toContain('action.submit');
    });
  });

  describe('setExecuting', () => {
    it('should clone state with executing flag set', () => {
      const state: UIActionState = {
        actionId: 'action.submit',
        available: true,
        executing: false,
        unavailableReasons: [],
        preconditions: [],
        updatedAt: 1000,
      };

      const updated = setExecuting(state, true);

      expect(updated.executing).toBe(true);
      expect(updated.updatedAt).toBeGreaterThan(state.updatedAt);
      // Original should be unchanged
      expect(state.executing).toBe(false);
    });

    it('should set executing to false', () => {
      const state: UIActionState = {
        actionId: 'action.submit',
        available: true,
        executing: true,
        unavailableReasons: [],
        preconditions: [],
        updatedAt: 1000,
      };

      const updated = setExecuting(state, false);

      expect(updated.executing).toBe(false);
    });
  });
});
