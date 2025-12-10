import { describe, it, expect } from 'vitest';

import {
  isGraphQLProjectionConfig,
  isDomainChangeEvent,
  isFieldChangeEvent,
} from '../../src/types.js';

describe('Type Guards', () => {
  describe('isGraphQLProjectionConfig', () => {
    it('should return true for valid config', () => {
      expect(isGraphQLProjectionConfig({})).toBe(true);
      expect(isGraphQLProjectionConfig({
        includeIntrospection: true,
        enableSubscriptions: true,
        maxDepth: 10,
      })).toBe(true);
    });

    it('should return false for invalid config', () => {
      expect(isGraphQLProjectionConfig(null)).toBe(false);
      expect(isGraphQLProjectionConfig(undefined)).toBe(false);
      expect(isGraphQLProjectionConfig('string')).toBe(false);
      expect(isGraphQLProjectionConfig({ includeIntrospection: 'yes' })).toBe(false);
      expect(isGraphQLProjectionConfig({ maxDepth: 'ten' })).toBe(false);
    });
  });

  describe('isDomainChangeEvent', () => {
    it('should return true for valid domain change event', () => {
      expect(isDomainChangeEvent({
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        paths: ['data.email'],
        snapshot: {},
      })).toBe(true);

      expect(isDomainChangeEvent({
        type: 'STATE_CHANGED',
        timestamp: Date.now(),
        paths: [],
        snapshot: null,
      })).toBe(true);

      expect(isDomainChangeEvent({
        type: 'ACTION_EXECUTED',
        timestamp: 1234567890,
        paths: ['state.status'],
        snapshot: { data: {}, state: {} },
      })).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isDomainChangeEvent(null)).toBe(false);
      expect(isDomainChangeEvent({})).toBe(false);
      expect(isDomainChangeEvent({
        type: 'INVALID_TYPE',
        timestamp: Date.now(),
        paths: [],
      })).toBe(false);
      expect(isDomainChangeEvent({
        type: 'DATA_CHANGED',
        timestamp: 'not a number',
        paths: [],
      })).toBe(false);
      expect(isDomainChangeEvent({
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        paths: 'not an array',
      })).toBe(false);
    });
  });

  describe('isFieldChangeEvent', () => {
    it('should return true for valid field change event', () => {
      expect(isFieldChangeEvent({
        path: 'data.email',
        previousValue: 'old@example.com',
        newValue: 'new@example.com',
        timestamp: Date.now(),
      })).toBe(true);

      expect(isFieldChangeEvent({
        path: 'state.loading',
        previousValue: false,
        newValue: true,
        timestamp: 1234567890,
      })).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isFieldChangeEvent(null)).toBe(false);
      expect(isFieldChangeEvent({})).toBe(false);
      expect(isFieldChangeEvent({
        path: 123,
        timestamp: Date.now(),
      })).toBe(false);
      expect(isFieldChangeEvent({
        path: 'data.email',
        timestamp: 'not a number',
      })).toBe(false);
    });
  });
});
