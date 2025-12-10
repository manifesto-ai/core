import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { z } from 'zod';
import {
  createRuntime,
  defineDomain,
  defineSource,
  defineDerived,
  defineAction,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import { createBridge } from '@manifesto-ai/bridge';
import {
  createZustandAdapter,
  createZustandActuator,
  createZustandBridgeSetup,
} from '../src/index.js';

// =============================================================================
// Test Setup
// =============================================================================

interface TestStoreState {
  name: string;
  age: number;
  email?: string;
  loading: boolean;
  submitted: boolean;
}

interface TestData {
  name: string;
  age: number;
  email?: string;
}

interface TestState {
  loading: boolean;
  submitted: boolean;
}

function createTestStore(
  initialState: Partial<TestStoreState> = {}
): StoreApi<TestStoreState> {
  return createStore<TestStoreState>()((set) => ({
    name: '',
    age: 0,
    email: undefined,
    loading: false,
    submitted: false,
    ...initialState,
  }));
}

function createTestDomain(): ManifestoDomain<TestData, TestState> {
  return defineDomain({
    id: 'test-domain',
    name: 'Test Domain',
    description: 'A test domain for Zustand bridge testing',
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

// =============================================================================
// createZustandAdapter Tests
// =============================================================================

describe('createZustandAdapter', () => {
  let store: StoreApi<TestStoreState>;

  beforeEach(() => {
    store = createTestStore({ name: 'John', age: 25 });
  });

  describe('getData', () => {
    it('should get data value with data. prefix', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age, email: s.email }),
      });

      expect(adapter.getData('data.name')).toBe('John');
      expect(adapter.getData('data.age')).toBe(25);
    });

    it('should get data value without prefix', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      expect(adapter.getData('name')).toBe('John');
    });
  });

  describe('getState', () => {
    it('should get state value with stateSelector', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
        stateSelector: (s) => ({ loading: s.loading, submitted: s.submitted }),
      });

      expect(adapter.getState('state.loading')).toBe(false);
      expect(adapter.getState('state.submitted')).toBe(false);
    });

    it('should return undefined without stateSelector', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      expect(adapter.getState('state.loading')).toBeUndefined();
    });
  });

  describe('getValidity', () => {
    it('should return validity from map', () => {
      const validity = new Map([
        ['data.name', { valid: false, issues: [{ code: 'required', message: 'Required', path: 'data.name', severity: 'error' as const }] }],
      ]);

      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
        validity,
      });

      const result = adapter.getValidity!('data.name');
      expect(result?.valid).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should notify listener when store changes', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      const listener = vi.fn();
      adapter.subscribe!(listener);

      store.setState({ name: 'Jane' });

      expect(listener).toHaveBeenCalledWith(['data.name']);
    });

    it('should unsubscribe correctly', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      const listener = vi.fn();
      const unsubscribe = adapter.subscribe!(listener);
      unsubscribe();

      store.setState({ name: 'Jane' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should detect multiple changed paths', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      const listener = vi.fn();
      adapter.subscribe!(listener);

      store.setState({ name: 'Jane', age: 30 });

      expect(listener).toHaveBeenCalledWith(expect.arrayContaining(['data.name', 'data.age']));
    });
  });

  describe('captureData', () => {
    it('should capture all data values', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      const data = adapter.captureData();

      expect(data).toEqual({
        'data.name': 'John',
        'data.age': 25,
      });
    });
  });

  describe('captureState', () => {
    it('should capture all state values', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
        stateSelector: (s) => ({ loading: s.loading, submitted: s.submitted }),
      });

      const state = adapter.captureState();

      expect(state).toEqual({
        'state.loading': false,
        'state.submitted': false,
      });
    });

    it('should return empty without stateSelector', () => {
      const adapter = createZustandAdapter(store, {
        dataSelector: (s) => ({ name: s.name, age: s.age }),
      });

      const state = adapter.captureState();

      expect(state).toEqual({});
    });
  });
});

// =============================================================================
// createZustandActuator Tests
// =============================================================================

describe('createZustandActuator', () => {
  let store: StoreApi<TestStoreState>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('setData', () => {
    it('should set data value', () => {
      const actuator = createZustandActuator(store, {
        setData: (path, value, s) => {
          const field = path.startsWith('data.') ? path.slice(5) : path;
          s.setState({ [field]: value } as Partial<TestStoreState>);
        },
      });

      actuator.setData('data.name', 'John');

      expect(store.getState().name).toBe('John');
    });
  });

  describe('setState', () => {
    it('should set state value when handler provided', () => {
      const actuator = createZustandActuator(store, {
        setData: () => {},
        setState: (path, value, s) => {
          const field = path.startsWith('state.') ? path.slice(6) : path;
          s.setState({ [field]: value } as Partial<TestStoreState>);
        },
      });

      actuator.setState('state.loading', true);

      expect(store.getState().loading).toBe(true);
    });

    it('should be no-op without handler', () => {
      const actuator = createZustandActuator(store, {
        setData: () => {},
      });

      actuator.setState('state.loading', true);

      expect(store.getState().loading).toBe(false);
    });
  });

  describe('setManyData', () => {
    it('should set multiple data values', () => {
      const actuator = createZustandActuator(store, {
        setData: (path, value, s) => {
          const field = path.startsWith('data.') ? path.slice(5) : path;
          s.setState({ [field]: value } as Partial<TestStoreState>);
        },
      });

      actuator.setManyData!({
        'data.name': 'John',
        'data.age': 30,
      });

      expect(store.getState().name).toBe('John');
      expect(store.getState().age).toBe(30);
    });
  });

  describe('focus', () => {
    it('should call onFocus handler', () => {
      const onFocus = vi.fn();
      const actuator = createZustandActuator(store, {
        setData: () => {},
        onFocus,
      });

      actuator.focus!('data.name');

      expect(onFocus).toHaveBeenCalledWith('data.name');
    });
  });

  describe('navigate', () => {
    it('should call onNavigate handler', () => {
      const onNavigate = vi.fn();
      const actuator = createZustandActuator(store, {
        setData: () => {},
        onNavigate,
      });

      actuator.navigate!('/dashboard', 'push');

      expect(onNavigate).toHaveBeenCalledWith('/dashboard', 'push');
    });
  });

  describe('apiCall', () => {
    it('should call onApiCall handler', async () => {
      const onApiCall = vi.fn().mockResolvedValue({ success: true });
      const actuator = createZustandActuator(store, {
        setData: () => {},
        onApiCall,
      });

      const result = await actuator.apiCall!({
        endpoint: '/api/users',
        method: 'GET',
      });

      expect(onApiCall).toHaveBeenCalledWith({
        endpoint: '/api/users',
        method: 'GET',
      });
      expect(result).toEqual({ success: true });
    });

    it('should reject without handler', async () => {
      const actuator = createZustandActuator(store, {
        setData: () => {},
      });

      await expect(
        actuator.apiCall!({ endpoint: '/api', method: 'GET' })
      ).rejects.toThrow('API call handler not configured');
    });
  });
});

// =============================================================================
// createZustandBridgeSetup Tests
// =============================================================================

describe('createZustandBridgeSetup', () => {
  let store: StoreApi<TestStoreState>;

  beforeEach(() => {
    store = createTestStore({ name: 'John', age: 25 });
  });

  it('should create adapter and actuator', () => {
    const setup = createZustandBridgeSetup(store, {
      dataSelector: (s) => ({ name: s.name, age: s.age }),
      setData: (path, value, s) => {
        const field = path.startsWith('data.') ? path.slice(5) : path;
        s.setState({ [field]: value } as Partial<TestStoreState>);
      },
    });

    expect(setup.adapter).toBeDefined();
    expect(setup.actuator).toBeDefined();
  });

  it('should connect adapter to store', () => {
    const setup = createZustandBridgeSetup(store, {
      dataSelector: (s) => ({ name: s.name, age: s.age }),
      setData: () => {},
    });

    expect(setup.adapter.getData('data.name')).toBe('John');
  });

  it('should connect actuator to store', () => {
    const setup = createZustandBridgeSetup(store, {
      dataSelector: (s) => ({ name: s.name, age: s.age }),
      setData: (path, value, s) => {
        const field = path.startsWith('data.') ? path.slice(5) : path;
        s.setState({ [field]: value } as Partial<TestStoreState>);
      },
    });

    setup.actuator.setData('data.name', 'Jane');
    expect(store.getState().name).toBe('Jane');
  });
});

// =============================================================================
// Integration with Bridge Tests
// =============================================================================

describe('Integration with Bridge', () => {
  let store: StoreApi<TestStoreState>;
  let domain: ManifestoDomain<TestData, TestState>;
  let runtime: DomainRuntime<TestData, TestState>;

  beforeEach(() => {
    store = createTestStore();
    domain = createTestDomain();
    runtime = createRuntime({
      domain,
      initialData: { name: '', age: 0 },
    });
  });

  it('should create a working bridge', () => {
    const { adapter, actuator } = createZustandBridgeSetup(store, {
      dataSelector: (s) => ({ name: s.name, age: s.age, email: s.email }),
      stateSelector: (s) => ({ loading: s.loading, submitted: s.submitted }),
      setData: (path, value, s) => {
        const field = path.startsWith('data.') ? path.slice(5) : path;
        s.setState({ [field]: value } as Partial<TestStoreState>);
      },
      setState: (path, value, s) => {
        const field = path.startsWith('state.') ? path.slice(6) : path;
        s.setState({ [field]: value } as Partial<TestStoreState>);
      },
    });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
    });

    expect(bridge.runtime).toBe(runtime);
    bridge.dispose();
  });

  it('should capture store values into runtime', () => {
    store.setState({ name: 'John', age: 30 });

    const { adapter, actuator } = createZustandBridgeSetup(store, {
      dataSelector: (s) => ({ name: s.name, age: s.age, email: s.email }),
      setData: () => {},
    });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
    });

    bridge.capture();

    expect(runtime.get('data.name')).toBe('John');
    expect(runtime.get('data.age')).toBe(30);

    bridge.dispose();
  });

  it('should execute commands', async () => {
    store.setState({ name: 'John', age: 25 });

    const { adapter, actuator } = createZustandBridgeSetup(store, {
      dataSelector: (s) => ({ name: s.name, age: s.age }),
      stateSelector: (s) => ({ loading: s.loading, submitted: s.submitted }),
      setData: (path, value, s) => {
        const field = path.startsWith('data.') ? path.slice(5) : path;
        s.setState({ [field]: value } as Partial<TestStoreState>);
      },
      setState: (path, value, s) => {
        const field = path.startsWith('state.') ? path.slice(6) : path;
        s.setState({ [field]: value } as Partial<TestStoreState>);
      },
    });

    const bridge = createBridge({
      runtime,
      adapter,
      actuator,
    });

    // Capture store into runtime
    bridge.capture();

    // Execute action
    const result = await bridge.execute({
      type: 'EXECUTE_ACTION',
      actionId: 'action.submit',
    });

    expect(result.ok).toBe(true);
    expect(runtime.get('state.submitted')).toBe(true);

    bridge.dispose();
  });
});
