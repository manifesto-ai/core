/**
 * Tests for createReactAdapter
 */

import { describe, it, expect, vi } from 'vitest';
import { createReactAdapter } from '../../src/adapter.js';

describe('createReactAdapter', () => {
  describe('getData', () => {
    it('should get data by path', () => {
      const adapter = createReactAdapter({
        getData: () => ({ user: { name: 'John' } }),
        getState: () => ({}),
      });

      expect(adapter.getData('data.user.name')).toBe('John');
    });

    it('should return undefined for non-existent path', () => {
      const adapter = createReactAdapter({
        getData: () => ({ user: {} }),
        getState: () => ({}),
      });

      expect(adapter.getData('data.user.email')).toBeUndefined();
    });

    it('should handle array indices', () => {
      const adapter = createReactAdapter({
        getData: () => ({ items: ['a', 'b', 'c'] }),
        getState: () => ({}),
      });

      expect(adapter.getData('data.items[1]')).toBe('b');
    });
  });

  describe('getState', () => {
    it('should get state by path', () => {
      const adapter = createReactAdapter({
        getData: () => ({}),
        getState: () => ({ loading: true }),
      });

      expect(adapter.getState('state.loading')).toBe(true);
    });
  });

  describe('getValidity', () => {
    it('should return validity from map', () => {
      const validity = new Map([
        ['data.email', { valid: false, errors: ['Invalid email'] }],
      ]);

      const adapter = createReactAdapter({
        getData: () => ({}),
        getState: () => ({}),
        validity,
      });

      expect(adapter.getValidity?.('data.email')).toEqual({
        valid: false,
        errors: ['Invalid email'],
      });
    });

    it('should return undefined for unknown path', () => {
      const adapter = createReactAdapter({
        getData: () => ({}),
        getState: () => ({}),
        validity: new Map(),
      });

      expect(adapter.getValidity?.('data.unknown')).toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('should call onSubscribe when provided', () => {
      const mockUnsubscribe = vi.fn();
      const mockOnSubscribe = vi.fn().mockReturnValue(mockUnsubscribe);
      const mockListener = vi.fn();

      const adapter = createReactAdapter({
        getData: () => ({}),
        getState: () => ({}),
        onSubscribe: mockOnSubscribe,
      });

      const unsubscribe = adapter.subscribe?.(mockListener);

      expect(mockOnSubscribe).toHaveBeenCalledWith(mockListener);

      // Calling unsubscribe should call the returned mockUnsubscribe
      unsubscribe?.();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should return no-op when onSubscribe not provided', () => {
      const adapter = createReactAdapter({
        getData: () => ({}),
        getState: () => ({}),
      });

      const unsubscribe = adapter.subscribe?.(() => {});
      expect(unsubscribe).toBeInstanceOf(Function);
    });
  });

  describe('captureData', () => {
    it('should flatten data object', () => {
      const adapter = createReactAdapter({
        getData: () => ({ user: { name: 'John', age: 30 } }),
        getState: () => ({}),
      });

      const captured = adapter.captureData();

      expect(captured['data.user.name']).toBe('John');
      expect(captured['data.user.age']).toBe(30);
    });

    it('should preserve arrays', () => {
      const adapter = createReactAdapter({
        getData: () => ({ items: [1, 2, 3] }),
        getState: () => ({}),
      });

      const captured = adapter.captureData();

      expect(captured['data.items']).toEqual([1, 2, 3]);
    });
  });

  describe('captureState', () => {
    it('should flatten state object', () => {
      const adapter = createReactAdapter({
        getData: () => ({}),
        getState: () => ({ ui: { loading: true, error: null } }),
      });

      const captured = adapter.captureState();

      expect(captured['state.ui.loading']).toBe(true);
      expect(captured['state.ui.error']).toBeNull();
    });
  });
});
