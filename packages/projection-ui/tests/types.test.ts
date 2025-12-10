import { describe, it, expect } from 'vitest';
import {
  isUIEventSeverity,
  isUIFieldState,
  isUIActionState,
  isUIEvent,
} from '../src/types.js';

describe('types', () => {
  describe('isUIEventSeverity', () => {
    it('should return true for valid severities', () => {
      expect(isUIEventSeverity('success')).toBe(true);
      expect(isUIEventSeverity('info')).toBe(true);
      expect(isUIEventSeverity('warning')).toBe(true);
      expect(isUIEventSeverity('error')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isUIEventSeverity('debug')).toBe(false);
      expect(isUIEventSeverity('')).toBe(false);
      expect(isUIEventSeverity(null)).toBe(false);
      expect(isUIEventSeverity(undefined)).toBe(false);
      expect(isUIEventSeverity(123)).toBe(false);
    });
  });

  describe('isUIFieldState', () => {
    it('should return true for valid field state', () => {
      const state = {
        path: 'data.name',
        visible: true,
        enabled: true,
        required: false,
        updatedAt: Date.now(),
      };
      expect(isUIFieldState(state)).toBe(true);
    });

    it('should return true with optional properties', () => {
      const state = {
        path: 'data.name',
        visible: true,
        enabled: false,
        required: true,
        disabledReason: 'Locked',
        hiddenReason: undefined,
        requiredReason: 'Mandatory',
        updatedAt: Date.now(),
      };
      expect(isUIFieldState(state)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isUIFieldState(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isUIFieldState('string')).toBe(false);
      expect(isUIFieldState(123)).toBe(false);
    });

    it('should return false for missing path', () => {
      expect(isUIFieldState({ visible: true, enabled: true, required: false, updatedAt: 1 })).toBe(false);
    });

    it('should return false for wrong type of path', () => {
      expect(isUIFieldState({ path: 123, visible: true, enabled: true, required: false, updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing visible', () => {
      expect(isUIFieldState({ path: 'data.name', enabled: true, required: false, updatedAt: 1 })).toBe(false);
    });

    it('should return false for wrong type of visible', () => {
      expect(isUIFieldState({ path: 'data.name', visible: 'yes', enabled: true, required: false, updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing enabled', () => {
      expect(isUIFieldState({ path: 'data.name', visible: true, required: false, updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing required', () => {
      expect(isUIFieldState({ path: 'data.name', visible: true, enabled: true, updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing updatedAt', () => {
      expect(isUIFieldState({ path: 'data.name', visible: true, enabled: true, required: false })).toBe(false);
    });
  });

  describe('isUIActionState', () => {
    it('should return true for valid action state', () => {
      const state = {
        actionId: 'action.submit',
        available: true,
        executing: false,
        unavailableReasons: [],
        preconditions: [],
        updatedAt: Date.now(),
      };
      expect(isUIActionState(state)).toBe(true);
    });

    it('should return true with preconditions', () => {
      const state = {
        actionId: 'action.submit',
        available: false,
        executing: false,
        unavailableReasons: ['Name is required'],
        preconditions: [{ path: 'data.name', satisfied: false, reason: 'Name is required' }],
        updatedAt: Date.now(),
      };
      expect(isUIActionState(state)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isUIActionState(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isUIActionState('string')).toBe(false);
    });

    it('should return false for missing actionId', () => {
      expect(isUIActionState({ available: true, executing: false, unavailableReasons: [], preconditions: [], updatedAt: 1 })).toBe(false);
    });

    it('should return false for wrong type of actionId', () => {
      expect(isUIActionState({ actionId: 123, available: true, executing: false, unavailableReasons: [], preconditions: [], updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing available', () => {
      expect(isUIActionState({ actionId: 'action.submit', executing: false, unavailableReasons: [], preconditions: [], updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing executing', () => {
      expect(isUIActionState({ actionId: 'action.submit', available: true, unavailableReasons: [], preconditions: [], updatedAt: 1 })).toBe(false);
    });

    it('should return false for unavailableReasons not being an array', () => {
      expect(isUIActionState({ actionId: 'action.submit', available: true, executing: false, unavailableReasons: 'reason', preconditions: [], updatedAt: 1 })).toBe(false);
    });

    it('should return false for preconditions not being an array', () => {
      expect(isUIActionState({ actionId: 'action.submit', available: true, executing: false, unavailableReasons: [], preconditions: {}, updatedAt: 1 })).toBe(false);
    });

    it('should return false for missing updatedAt', () => {
      expect(isUIActionState({ actionId: 'action.submit', available: true, executing: false, unavailableReasons: [], preconditions: [] })).toBe(false);
    });
  });

  describe('isUIEvent', () => {
    it('should return true for valid event', () => {
      const event = {
        id: 'event-1',
        severity: 'info',
        message: 'Hello',
        channel: 'ui',
        payload: {},
        timestamp: Date.now(),
        dismissed: false,
      };
      expect(isUIEvent(event)).toBe(true);
    });

    it('should return true with optional properties', () => {
      const event = {
        id: 'event-1',
        severity: 'success',
        message: 'Done',
        description: 'Task completed',
        channel: 'ui',
        payload: { data: 'value' },
        timestamp: Date.now(),
        duration: 5000,
        dismissed: false,
      };
      expect(isUIEvent(event)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isUIEvent(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isUIEvent('string')).toBe(false);
    });

    it('should return false for missing id', () => {
      expect(isUIEvent({ severity: 'info', message: 'Hello', channel: 'ui', payload: {}, timestamp: 1, dismissed: false })).toBe(false);
    });

    it('should return false for invalid severity', () => {
      expect(isUIEvent({ id: '1', severity: 'debug', message: 'Hello', channel: 'ui', payload: {}, timestamp: 1, dismissed: false })).toBe(false);
    });

    it('should return false for missing message', () => {
      expect(isUIEvent({ id: '1', severity: 'info', channel: 'ui', payload: {}, timestamp: 1, dismissed: false })).toBe(false);
    });

    it('should return false for missing channel', () => {
      expect(isUIEvent({ id: '1', severity: 'info', message: 'Hello', payload: {}, timestamp: 1, dismissed: false })).toBe(false);
    });

    it('should return false for missing timestamp', () => {
      expect(isUIEvent({ id: '1', severity: 'info', message: 'Hello', channel: 'ui', payload: {}, dismissed: false })).toBe(false);
    });

    it('should return false for missing dismissed', () => {
      expect(isUIEvent({ id: '1', severity: 'info', message: 'Hello', channel: 'ui', payload: {}, timestamp: 1 })).toBe(false);
    });
  });
});
