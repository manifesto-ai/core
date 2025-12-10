import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  createRuntime,
  defineDomain,
  defineSource,
  defineDerived,
  defineAction,
  ok,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import {
  createBridge,
  createVanillaAdapter,
  createVanillaActuator,
  setValue,
  setMany,
  executeAction,
  type Bridge,
  type VanillaStore,
} from '../src/index.js';

// =============================================================================
// Test Setup
// =============================================================================

interface TestData {
  name: string;
  age: number;
  email?: string;
}

interface TestState {
  loading: boolean;
  submitted: boolean;
}

function createTestDomain(): ManifestoDomain<TestData, TestState> {
  return defineDomain({
    id: 'test-domain',
    name: 'Test Domain',
    description: 'A test domain for bridge testing',
    dataSchema: z.object({
      name: z.string().min(1),
      age: z.number().min(0),
      email: z.string().email().optional(),
    }),
    stateSchema: z.object({
      loading: z.boolean(),
      submitted: z.boolean(),
    }),
    initialState: {
      loading: false,
      submitted: false,
    },
    paths: {
      sources: {
        'data.name': defineSource({
          schema: z.string().min(1),
          semantic: { type: 'input', description: 'User name' },
        }),
        'data.age': defineSource({
          schema: z.number().min(0),
          semantic: { type: 'input', description: 'User age' },
        }),
        'data.email': defineSource({
          schema: z.string().email().optional(),
          semantic: { type: 'input', description: 'User email' },
        }),
      },
      derived: {
        'derived.isAdult': defineDerived({
          deps: ['data.age'],
          expr: ['>=', ['get', 'data.age'], 18],
          semantic: { type: 'computed', description: 'Is adult' },
        }),
        'derived.canSubmit': defineDerived({
          deps: ['data.name', 'data.age'],
          expr: [
            'all',
            ['>', ['length', ['get', 'data.name']], 0],
            ['>=', ['get', 'data.age'], 0],
          ],
          semantic: { type: 'action-availability', description: 'Can submit' },
        }),
      },
      async: {},
    },
    actions: {
      'action.submit': defineAction({
        deps: ['derived.canSubmit'],
        semantic: {
          type: 'action',
          description: 'Submit the form',
          verb: 'submit',
        },
        preconditions: [
          { path: 'derived.canSubmit', expect: 'true', reason: 'Form must be valid' },
        ],
        effect: {
          _tag: 'SetState',
          path: 'state.submitted',
          value: true,
          description: 'Mark as submitted',
        },
      }),
    },
  });
}

function createTestSetup() {
  const domain = createTestDomain();
  const runtime = createRuntime({
    domain,
    initialData: { name: '', age: 0 },
  });

  const store: VanillaStore<TestData, TestState> = {
    data: { name: '', age: 0 },
    state: { loading: false, submitted: false },
  };

  const onChange = vi.fn();
  const adapter = createVanillaAdapter({ store });
  const actuator = createVanillaActuator({ store, onChange });

  const bridge = createBridge({
    runtime,
    adapter,
    actuator,
  });

  return { domain, runtime, store, adapter, actuator, bridge, onChange };
}

// =============================================================================
// createBridge
// =============================================================================

describe('createBridge', () => {
  let setup: ReturnType<typeof createTestSetup>;

  beforeEach(() => {
    setup = createTestSetup();
  });

  afterEach(() => {
    setup.bridge.dispose();
  });

  describe('creation', () => {
    it('should create a bridge with default options', () => {
      const { bridge } = setup;

      expect(bridge).toBeDefined();
      expect(bridge.runtime).toBeDefined();
    });

    it('should expose runtime', () => {
      const { bridge, runtime } = setup;

      expect(bridge.runtime).toBe(runtime);
    });
  });

  describe('get', () => {
    it('should get data values from runtime', () => {
      const { bridge, runtime } = setup;

      runtime.set('data.name', 'John');

      expect(bridge.get('data.name')).toBe('John');
    });

    it('should get derived values from runtime', () => {
      const { bridge, runtime } = setup;

      runtime.set('data.age', 25);

      expect(bridge.get('derived.isAdult')).toBe(true);
    });
  });

  describe('getFieldPolicy', () => {
    it('should get field policy from runtime', () => {
      const { bridge } = setup;

      const policy = bridge.getFieldPolicy('data.name');

      expect(policy).toBeDefined();
      expect(policy.relevant).toBeDefined();
      expect(policy.editable).toBeDefined();
    });
  });

  describe('isActionAvailable', () => {
    it('should return false when preconditions not met', () => {
      const { bridge } = setup;

      expect(bridge.isActionAvailable('action.submit')).toBe(false);
    });

    it('should return true when preconditions are met', () => {
      const { bridge, runtime } = setup;

      runtime.set('data.name', 'John');
      runtime.set('data.age', 25);

      expect(bridge.isActionAvailable('action.submit')).toBe(true);
    });
  });

  describe('capture', () => {
    it('should capture external state into runtime', () => {
      const { bridge, store, runtime } = setup;

      // Set values in external store
      store.data.name = 'John';
      store.data.age = 30;

      // Capture into runtime
      const snapshot = bridge.capture();

      expect(snapshot.data.name).toBe('John');
      expect(snapshot.data.age).toBe(30);
    });
  });

  describe('execute', () => {
    describe('SET_VALUE command', () => {
      it('should set a value in runtime', async () => {
        const { bridge, runtime } = setup;

        const result = await bridge.execute(setValue('data.name', 'John'));

        expect(result.ok).toBe(true);
        expect(runtime.get('data.name')).toBe('John');
      });

      it('should return error for validation failure', async () => {
        const { bridge } = setup;

        // Age must be >= 0
        const result = await bridge.execute(setValue('data.age', -5));

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
        }
      });
    });

    describe('SET_MANY command', () => {
      it('should set multiple values', async () => {
        const { bridge, runtime } = setup;

        const result = await bridge.execute(
          setMany({
            'data.name': 'John',
            'data.age': 30,
          })
        );

        expect(result.ok).toBe(true);
        expect(runtime.get('data.name')).toBe('John');
        expect(runtime.get('data.age')).toBe(30);
      });
    });

    describe('EXECUTE_ACTION command', () => {
      it('should execute action when preconditions met', async () => {
        const { bridge, runtime } = setup;

        // Set up valid state
        runtime.set('data.name', 'John');
        runtime.set('data.age', 25);

        const result = await bridge.execute(executeAction('action.submit'));

        expect(result.ok).toBe(true);
        expect(runtime.get('state.submitted')).toBe(true);
      });

      it('should return error when preconditions not met', async () => {
        const { bridge } = setup;

        // Leave name empty - precondition will fail
        const result = await bridge.execute(executeAction('action.submit'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('EXECUTION_ERROR');
        }
      });
    });
  });

  describe('sync', () => {
    it('should push runtime state to external system', () => {
      const { bridge, runtime, store, onChange } = setup;

      // Set values in runtime
      runtime.set('data.name', 'John');
      runtime.set('data.age', 30);

      // Clear previous onChange calls from runtime.set auto-sync
      onChange.mockClear();

      // Force sync
      bridge.sync();

      // Verify values pushed to store
      expect(store.data.name).toBe('John');
      expect(store.data.age).toBe(30);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on runtime changes', async () => {
      const { bridge, runtime } = setup;

      const listener = vi.fn();
      const unsubscribe = bridge.subscribe(listener);

      runtime.set('data.name', 'John');

      // Wait for async notification
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalled();
      const [snapshot, changedPaths] = listener.mock.calls[0]!;
      expect(snapshot.data.name).toBe('John');
      expect(changedPaths).toContain('data.name');

      unsubscribe();
    });

    it('should stop notifying after unsubscribe', async () => {
      const { bridge, runtime } = setup;

      const listener = vi.fn();
      const unsubscribe = bridge.subscribe(listener);
      unsubscribe();

      runtime.set('data.name', 'John');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should prevent further operations after dispose', async () => {
      const { bridge } = setup;

      bridge.dispose();

      const result = await bridge.execute(setValue('data.name', 'John'));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DISPOSED_ERROR');
      }
    });

    it('should throw on get after dispose', () => {
      const { bridge } = setup;

      bridge.dispose();

      expect(() => bridge.get('data.name')).toThrow('Bridge is disposed');
    });

    it('should throw on capture after dispose', () => {
      const { bridge } = setup;

      bridge.dispose();

      expect(() => bridge.capture()).toThrow('Bridge is disposed');
    });

    it('should be safe to call dispose multiple times', () => {
      const { bridge } = setup;

      bridge.dispose();
      bridge.dispose(); // Should not throw
    });
  });
});

// =============================================================================
// Sync Modes
// =============================================================================

describe('Sync Modes', () => {
  it('should auto-sync in bidirectional mode (default)', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: '', age: 0 } });
    const store: VanillaStore<TestData, TestState> = {
      data: { name: '', age: 0 },
      state: { loading: false, submitted: false },
    };
    const onChange = vi.fn();
    const adapter = createVanillaAdapter({ store });
    const actuator = createVanillaActuator({ store, onChange });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
      syncMode: 'bidirectional',
      autoSync: true,
    });

    // Change in runtime should sync to external
    runtime.set('data.name', 'John');

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(store.data.name).toBe('John');

    bridge.dispose();
  });

  it('should not auto-sync when autoSync is false', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: '', age: 0 } });
    const store: VanillaStore<TestData, TestState> = {
      data: { name: '', age: 0 },
      state: { loading: false, submitted: false },
    };
    const onChange = vi.fn();
    const adapter = createVanillaAdapter({ store });
    const actuator = createVanillaActuator({ store, onChange });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
      autoSync: false,
    });

    // Change in runtime
    runtime.set('data.name', 'John');

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    // External store should NOT be updated automatically
    expect(store.data.name).toBe('');

    // Manual sync should update it
    bridge.sync();
    expect(store.data.name).toBe('John');

    bridge.dispose();
  });
});

// =============================================================================
// Debounce
// =============================================================================

describe('Debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce sync when debounceMs is set', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: '', age: 0 } });
    const store: VanillaStore<TestData, TestState> = {
      data: { name: '', age: 0 },
      state: { loading: false, submitted: false },
    };
    const onChange = vi.fn();
    const adapter = createVanillaAdapter({ store });
    const actuator = createVanillaActuator({ store, onChange });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
      debounceMs: 100,
    });

    // Multiple rapid changes
    runtime.set('data.name', 'J');
    runtime.set('data.name', 'Jo');
    runtime.set('data.name', 'Joh');
    runtime.set('data.name', 'John');

    // Before debounce timeout
    expect(store.data.name).toBe('');

    // Advance timer
    vi.advanceTimersByTime(100);

    // Now it should be synced
    expect(store.data.name).toBe('John');

    bridge.dispose();
  });

  it('should reset debounce on each change', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: '', age: 0 } });
    const store: VanillaStore<TestData, TestState> = {
      data: { name: '', age: 0 },
      state: { loading: false, submitted: false },
    };
    const adapter = createVanillaAdapter({ store });
    const actuator = createVanillaActuator({ store });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
      debounceMs: 100,
    });

    runtime.set('data.name', 'J');
    vi.advanceTimersByTime(50);

    runtime.set('data.name', 'Jo');
    vi.advanceTimersByTime(50);

    // Still not synced (timer reset)
    expect(store.data.name).toBe('');

    vi.advanceTimersByTime(100);

    // Now synced
    expect(store.data.name).toBe('Jo');

    bridge.dispose();
  });
});
