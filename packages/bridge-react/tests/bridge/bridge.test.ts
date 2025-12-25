/**
 * Tests for Bridge functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  createBridge,
  setValue,
  setMany,
  executeAction,
  isSetValueCommand,
  isSetManyCommand,
  isExecuteActionCommand,
  bridgeError,
} from '../../src/bridge.js';
import { createReactAdapter } from '../../src/adapter.js';
import { createReactActuator } from '../../src/actuator.js';
import {
  defineDomain,
  defineSource,
  defineAction,
  createRuntime,
  setValue as coreSetValue,
} from '@manifesto-ai/core';

// Test domain setup
function createTestDomain() {
  return defineDomain({
    id: 'test-bridge-domain',
    name: 'Test Bridge',
    description: 'Test domain for bridge',
    dataSchema: z.object({
      counter: z.number(),
      user: z.object({
        name: z.string(),
      }),
    }),
    stateSchema: z.object({
      loading: z.boolean(),
    }),
    initialState: { loading: false },
    paths: {
      sources: {
        counter: defineSource({
          schema: z.number(),
          defaultValue: 0,
          semantic: { type: 'number', description: 'Counter' },
        }),
        'user.name': defineSource({
          schema: z.string(),
          defaultValue: '',
          semantic: { type: 'string', description: 'User name' },
        }),
      },
    },
    actions: {
      increment: defineAction({
        deps: ['data.counter'],
        effect: coreSetValue('data.counter', 1),
        semantic: { type: 'action', description: 'Increment', risk: 'low' },
      }),
    },
  });
}

describe('Command Factories', () => {
  describe('setValue', () => {
    it('should create SET_VALUE command', () => {
      const cmd = setValue('data.name', 'John');
      expect(cmd).toEqual({
        type: 'SET_VALUE',
        path: 'data.name',
        value: 'John',
      });
    });
  });

  describe('setMany', () => {
    it('should create SET_MANY command', () => {
      const cmd = setMany({
        'data.name': 'John',
        'data.age': 30,
      });
      expect(cmd).toEqual({
        type: 'SET_MANY',
        updates: {
          'data.name': 'John',
          'data.age': 30,
        },
      });
    });
  });

  describe('executeAction', () => {
    it('should create EXECUTE_ACTION command', () => {
      const cmd = executeAction('submit', { data: 'test' });
      expect(cmd).toEqual({
        type: 'EXECUTE_ACTION',
        actionId: 'submit',
        input: { data: 'test' },
      });
    });

    it('should create EXECUTE_ACTION command without input', () => {
      const cmd = executeAction('reset');
      expect(cmd).toEqual({
        type: 'EXECUTE_ACTION',
        actionId: 'reset',
        input: undefined,
      });
    });
  });
});

describe('Type Guards', () => {
  it('isSetValueCommand should identify SET_VALUE', () => {
    expect(isSetValueCommand(setValue('data.x', 1))).toBe(true);
    expect(isSetValueCommand(setMany({}))).toBe(false);
  });

  it('isSetManyCommand should identify SET_MANY', () => {
    expect(isSetManyCommand(setMany({}))).toBe(true);
    expect(isSetManyCommand(setValue('data.x', 1))).toBe(false);
  });

  it('isExecuteActionCommand should identify EXECUTE_ACTION', () => {
    expect(isExecuteActionCommand(executeAction('test'))).toBe(true);
    expect(isExecuteActionCommand(setValue('data.x', 1))).toBe(false);
  });
});

describe('bridgeError', () => {
  it('should create BridgeError object', () => {
    const error = bridgeError('VALIDATION_ERROR', 'Invalid value', 'data.email');
    expect(error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid value',
      path: 'data.email',
      cause: undefined,
    });
  });

  it('should include cause when provided', () => {
    const cause = new Error('Original error');
    const error = bridgeError('EXECUTION_ERROR', 'Failed', undefined, cause);
    expect(error.cause).toBe(cause);
  });
});

describe('createBridge', () => {
  let domain: ReturnType<typeof createTestDomain>;
  let runtime: ReturnType<typeof createRuntime>;
  let data: { counter: number; user: { name: string } };
  let state: { loading: boolean };

  beforeEach(() => {
    domain = createTestDomain();
    runtime = createRuntime({
      domain,
      initialData: { counter: 0, user: { name: 'Test' } },
    });
    data = { counter: 0, user: { name: 'Test' } };
    state = { loading: false };
  });

  function createTestBridge() {
    const adapter = createReactAdapter({
      getData: () => data,
      getState: () => state,
    });

    const actuator = createReactActuator({
      setData: vi.fn(),
      setState: vi.fn(),
    });

    return createBridge({
      runtime,
      adapter,
      actuator,
    });
  }

  describe('runtime property', () => {
    it('should expose runtime', () => {
      const bridge = createTestBridge();
      expect(bridge.runtime).toBe(runtime);
      bridge.dispose();
    });
  });

  describe('get', () => {
    it('should get value from runtime', () => {
      const bridge = createTestBridge();
      expect(bridge.get('data.counter')).toBe(0);
      bridge.dispose();
    });
  });

  describe('getFieldPolicy', () => {
    it('should get field policy from runtime', () => {
      const bridge = createTestBridge();
      const policy = bridge.getFieldPolicy('data.counter');
      expect(policy).toBeDefined();
      expect(policy.editable).toBe(true);
      bridge.dispose();
    });
  });

  describe('isActionAvailable', () => {
    it('should check action availability', () => {
      const bridge = createTestBridge();
      expect(bridge.isActionAvailable('increment')).toBe(true);
      bridge.dispose();
    });
  });

  describe('execute', () => {
    it('should execute SET_VALUE command', () => {
      const bridge = createTestBridge();

      const result = bridge.execute(setValue('data.counter', 5));

      expect(result).toHaveProperty('ok', true);
      expect(bridge.get('data.counter')).toBe(5);
      bridge.dispose();
    });

    it('should execute SET_MANY command', () => {
      const bridge = createTestBridge();

      const result = bridge.execute(
        setMany({
          'data.counter': 10,
          'data.user.name': 'Updated',
        })
      );

      expect(result).toHaveProperty('ok', true);
      expect(bridge.get('data.counter')).toBe(10);
      expect(bridge.get('data.user.name')).toBe('Updated');
      bridge.dispose();
    });

    it('should execute EXECUTE_ACTION command', async () => {
      const bridge = createTestBridge();

      const result = await bridge.execute(executeAction('increment'));

      expect(result).toHaveProperty('ok', true);
      expect(bridge.get('data.counter')).toBe(1);
      bridge.dispose();
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on changes', () => {
      const bridge = createTestBridge();
      const listener = vi.fn();

      bridge.subscribe(listener);
      bridge.execute(setValue('data.counter', 1));

      // Listener should be called
      expect(listener).toHaveBeenCalled();
      bridge.dispose();
    });

    it('should return unsubscribe function', () => {
      const bridge = createTestBridge();
      const listener = vi.fn();

      const unsubscribe = bridge.subscribe(listener);
      unsubscribe();

      bridge.execute(setValue('data.counter', 1));

      // Listener should not be called after unsubscribe
      // Note: The first call happens before unsubscribe, so check call count
      const callCountBeforeUnsubscribe = listener.mock.calls.length;
      bridge.execute(setValue('data.counter', 2));
      expect(listener.mock.calls.length).toBe(callCountBeforeUnsubscribe);

      bridge.dispose();
    });
  });

  describe('getSnapshot', () => {
    it('should return current snapshot', () => {
      const bridge = createTestBridge();
      const snapshot = bridge.getSnapshot();

      expect(snapshot.data).toEqual({ counter: 0, user: { name: 'Test' } });
      bridge.dispose();
    });
  });

  describe('dispose', () => {
    it('should dispose bridge', () => {
      const bridge = createTestBridge();
      bridge.dispose();

      // Should throw on subsequent operations
      expect(() => bridge.get('data.counter')).toThrow('Bridge has been disposed');
    });

    it('should be idempotent', () => {
      const bridge = createTestBridge();
      bridge.dispose();
      expect(() => bridge.dispose()).not.toThrow();
    });
  });
});
