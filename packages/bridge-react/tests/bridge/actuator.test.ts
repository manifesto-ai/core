/**
 * Tests for createReactActuator
 */

import { describe, it, expect, vi } from 'vitest';
import { createReactActuator, parsePath, setNestedValue } from '../../src/actuator.js';

describe('parsePath', () => {
  it('should parse dot notation path', () => {
    expect(parsePath('data.user.name')).toEqual(['data', 'user', 'name']);
  });

  it('should parse bracket notation path', () => {
    expect(parsePath('data.items[0]')).toEqual(['data', 'items', '0']);
  });

  it('should parse mixed notation path', () => {
    expect(parsePath('data.users[0].name')).toEqual(['data', 'users', '0', 'name']);
  });

  it('should handle empty path', () => {
    expect(parsePath('')).toEqual([]);
  });
});

describe('setNestedValue', () => {
  it('should set nested value', () => {
    const obj = { user: { name: 'John' } };
    setNestedValue(obj, ['user', 'name'], 'Jane');
    expect(obj.user.name).toBe('Jane');
  });

  it('should create intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, ['user', 'name'], 'John');
    expect((obj.user as Record<string, unknown>).name).toBe('John');
  });

  it('should create intermediate arrays', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, ['items', '0'], 'first');
    expect((obj.items as unknown[])[0]).toBe('first');
  });

  it('should handle empty segments', () => {
    const obj = { value: 1 };
    setNestedValue(obj, [], 2);
    expect(obj.value).toBe(1); // Should not change
  });
});

describe('createReactActuator', () => {
  describe('setData', () => {
    it('should call setData handler', () => {
      const mockSetData = vi.fn();
      const actuator = createReactActuator({
        setData: mockSetData,
      });

      actuator.setData('data.user.name', 'John');

      expect(mockSetData).toHaveBeenCalledWith('data.user.name', 'John');
    });
  });

  describe('setState', () => {
    it('should call setState handler when provided', () => {
      const mockSetState = vi.fn();
      const actuator = createReactActuator({
        setData: vi.fn(),
        setState: mockSetState,
      });

      actuator.setState('state.loading', true);

      expect(mockSetState).toHaveBeenCalledWith('state.loading', true);
    });

    it('should be no-op when setState not provided', () => {
      const actuator = createReactActuator({
        setData: vi.fn(),
      });

      // Should not throw
      expect(() => actuator.setState('state.loading', true)).not.toThrow();
    });
  });

  describe('setManyData', () => {
    it('should call setData for each update', () => {
      const mockSetData = vi.fn();
      const actuator = createReactActuator({
        setData: mockSetData,
      });

      actuator.setManyData?.({
        'data.user.name': 'John',
        'data.user.age': 30,
      });

      expect(mockSetData).toHaveBeenCalledTimes(2);
      expect(mockSetData).toHaveBeenCalledWith('data.user.name', 'John');
      expect(mockSetData).toHaveBeenCalledWith('data.user.age', 30);
    });
  });

  describe('setManyState', () => {
    it('should call setState for each update', () => {
      const mockSetState = vi.fn();
      const actuator = createReactActuator({
        setData: vi.fn(),
        setState: mockSetState,
      });

      actuator.setManyState?.({
        'state.loading': false,
        'state.error': null,
      });

      expect(mockSetState).toHaveBeenCalledTimes(2);
    });
  });

  describe('focus', () => {
    it('should call onFocus handler', () => {
      const mockOnFocus = vi.fn();
      const actuator = createReactActuator({
        setData: vi.fn(),
        onFocus: mockOnFocus,
      });

      actuator.focus?.('data.email');

      expect(mockOnFocus).toHaveBeenCalledWith('data.email');
    });

    it('should be no-op when onFocus not provided', () => {
      const actuator = createReactActuator({
        setData: vi.fn(),
      });

      expect(() => actuator.focus?.('data.email')).not.toThrow();
    });
  });

  describe('navigate', () => {
    it('should call onNavigate handler', () => {
      const mockOnNavigate = vi.fn();
      const actuator = createReactActuator({
        setData: vi.fn(),
        onNavigate: mockOnNavigate,
      });

      actuator.navigate?.('/home', 'push');

      expect(mockOnNavigate).toHaveBeenCalledWith('/home', 'push');
    });
  });

  describe('apiCall', () => {
    it('should call onApiCall handler', async () => {
      const mockOnApiCall = vi.fn().mockResolvedValue({ data: 'result' });
      const actuator = createReactActuator({
        setData: vi.fn(),
        onApiCall: mockOnApiCall,
      });

      const request = { method: 'GET' as const, url: '/api/users' };
      const result = await actuator.apiCall?.(request);

      expect(mockOnApiCall).toHaveBeenCalledWith(request);
      expect(result).toEqual({ data: 'result' });
    });

    it('should throw when onApiCall not provided', async () => {
      const actuator = createReactActuator({
        setData: vi.fn(),
      });

      await expect(
        actuator.apiCall?.({ method: 'GET', url: '/api/users' })
      ).rejects.toThrow('API call handler not configured');
    });
  });
});
