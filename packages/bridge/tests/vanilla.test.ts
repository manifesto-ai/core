import { describe, it, expect, vi } from 'vitest';
import {
  parsePath,
  getNestedValue,
  setNestedValue,
  getValueByPath,
  setValueByPath,
  flattenObject,
  createVanillaAdapter,
  createVanillaActuator,
  createVanillaBridgeSetup,
  type VanillaStore,
} from '../src/index.js';

// =============================================================================
// Path Utilities
// =============================================================================

describe('parsePath', () => {
  it('should parse simple dot notation', () => {
    expect(parsePath('data.name')).toEqual(['data', 'name']);
    expect(parsePath('state.loading')).toEqual(['state', 'loading']);
  });

  it('should parse nested dot notation', () => {
    expect(parsePath('data.user.profile.name')).toEqual([
      'data',
      'user',
      'profile',
      'name',
    ]);
  });

  it('should parse bracket notation with numbers', () => {
    expect(parsePath('data.items[0]')).toEqual(['data', 'items', '0']);
    expect(parsePath('data.items[0].name')).toEqual(['data', 'items', '0', 'name']);
  });

  it('should parse bracket notation with quotes', () => {
    expect(parsePath("data.user['name']")).toEqual(['data', 'user', 'name']);
    expect(parsePath('data.user["name"]')).toEqual(['data', 'user', 'name']);
  });

  it('should parse mixed notation', () => {
    expect(parsePath('data.users[0].profile["email"]')).toEqual([
      'data',
      'users',
      '0',
      'profile',
      'email',
    ]);
  });

  it('should handle empty path', () => {
    expect(parsePath('')).toEqual([]);
  });

  it('should handle single segment', () => {
    expect(parsePath('data')).toEqual(['data']);
  });

  it('should handle consecutive brackets', () => {
    expect(parsePath('data[0][1]')).toEqual(['data', '0', '1']);
  });
});

describe('getNestedValue', () => {
  it('should get value from nested object', () => {
    const obj = { user: { name: 'John', age: 30 } };
    expect(getNestedValue(obj, ['user', 'name'])).toBe('John');
    expect(getNestedValue(obj, ['user', 'age'])).toBe(30);
  });

  it('should get value from array', () => {
    const obj = { items: [1, 2, 3] };
    expect(getNestedValue(obj, ['items', '0'])).toBe(1);
    expect(getNestedValue(obj, ['items', '2'])).toBe(3);
  });

  it('should return undefined for missing path', () => {
    const obj = { user: { name: 'John' } };
    expect(getNestedValue(obj, ['user', 'age'])).toBeUndefined();
    expect(getNestedValue(obj, ['missing', 'path'])).toBeUndefined();
  });

  it('should return undefined for null in path', () => {
    const obj = { user: null };
    expect(getNestedValue(obj, ['user', 'name'])).toBeUndefined();
  });

  it('should return the object itself for empty segments', () => {
    const obj = { name: 'John' };
    expect(getNestedValue(obj, [])).toEqual(obj);
  });
});

describe('setNestedValue', () => {
  it('should set value in nested object', () => {
    const obj: Record<string, unknown> = { user: { name: 'John' } };
    setNestedValue(obj, ['user', 'age'], 30);
    expect((obj.user as Record<string, unknown>).age).toBe(30);
  });

  it('should create intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, ['user', 'profile', 'name'], 'John');
    expect(obj).toEqual({ user: { profile: { name: 'John' } } });
  });

  it('should create intermediate arrays for numeric keys', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, ['items', '0', 'name'], 'Item 1');
    expect(obj).toEqual({ items: [{ name: 'Item 1' }] });
  });

  it('should do nothing for empty segments', () => {
    const obj = { name: 'John' };
    setNestedValue(obj, [], 'New Value');
    expect(obj).toEqual({ name: 'John' });
  });

  it('should overwrite existing values', () => {
    const obj: Record<string, unknown> = { name: 'John' };
    setNestedValue(obj, ['name'], 'Jane');
    expect(obj.name).toBe('Jane');
  });
});

describe('getValueByPath', () => {
  it('should get data value', () => {
    const store: VanillaStore = {
      data: { name: 'John', age: 30 },
      state: {},
    };
    expect(getValueByPath(store, 'data.name')).toBe('John');
    expect(getValueByPath(store, 'data.age')).toBe(30);
  });

  it('should get state value', () => {
    const store: VanillaStore = {
      data: {},
      state: { loading: true },
    };
    expect(getValueByPath(store, 'state.loading')).toBe(true);
  });

  it('should get nested values', () => {
    const store: VanillaStore = {
      data: { user: { profile: { email: 'john@example.com' } } },
      state: {},
    };
    expect(getValueByPath(store, 'data.user.profile.email')).toBe('john@example.com');
  });

  it('should return undefined for unknown namespace', () => {
    const store: VanillaStore = { data: { name: 'John' }, state: {} };
    expect(getValueByPath(store, 'derived.something')).toBeUndefined();
  });
});

describe('setValueByPath', () => {
  it('should set data value', () => {
    const store: VanillaStore = { data: { name: '' }, state: {} };
    setValueByPath(store, 'data.name', 'John');
    expect((store.data as Record<string, unknown>).name).toBe('John');
  });

  it('should set state value', () => {
    const store: VanillaStore = { data: {}, state: { loading: false } };
    setValueByPath(store, 'state.loading', true);
    expect((store.state as Record<string, unknown>).loading).toBe(true);
  });

  it('should create nested structure', () => {
    const store: VanillaStore = { data: {}, state: {} };
    setValueByPath(store, 'data.user.profile.name', 'John');
    expect(store.data).toEqual({ user: { profile: { name: 'John' } } });
  });
});

describe('flattenObject', () => {
  it('should flatten simple object', () => {
    const obj = { name: 'John', age: 30 };
    expect(flattenObject(obj, 'data')).toEqual({
      'data.name': 'John',
      'data.age': 30,
    });
  });

  it('should flatten nested object', () => {
    const obj = { user: { name: 'John', profile: { email: 'john@example.com' } } };
    expect(flattenObject(obj, 'data')).toEqual({
      'data.user.name': 'John',
      'data.user.profile.email': 'john@example.com',
    });
  });

  it('should not flatten arrays', () => {
    const obj = { items: [1, 2, 3] };
    expect(flattenObject(obj, 'data')).toEqual({
      'data.items': [1, 2, 3],
    });
  });

  it('should handle null and undefined', () => {
    expect(flattenObject(null, 'data')).toEqual({});
    expect(flattenObject(undefined, 'data')).toEqual({});
  });

  it('should handle primitives', () => {
    expect(flattenObject('hello', 'data')).toEqual({ data: 'hello' });
    expect(flattenObject(42, 'data')).toEqual({ data: 42 });
  });
});

// =============================================================================
// Vanilla Adapter
// =============================================================================

describe('createVanillaAdapter', () => {
  it('should create an adapter', () => {
    const store: VanillaStore = { data: { name: 'John' }, state: {} };
    const adapter = createVanillaAdapter({ store });

    expect(adapter.getData).toBeDefined();
    expect(adapter.getState).toBeDefined();
    expect(adapter.captureData).toBeDefined();
    expect(adapter.captureState).toBeDefined();
  });

  it('should get data values', () => {
    const store: VanillaStore = { data: { name: 'John', age: 30 }, state: {} };
    const adapter = createVanillaAdapter({ store });

    expect(adapter.getData('data.name')).toBe('John');
    expect(adapter.getData('data.age')).toBe(30);
  });

  it('should get state values', () => {
    const store: VanillaStore = { data: {}, state: { loading: true } };
    const adapter = createVanillaAdapter({ store });

    expect(adapter.getState('state.loading')).toBe(true);
  });

  it('should capture all data', () => {
    const store: VanillaStore = {
      data: { name: 'John', age: 30 },
      state: { loading: false },
    };
    const adapter = createVanillaAdapter({ store });

    expect(adapter.captureData()).toEqual({
      'data.name': 'John',
      'data.age': 30,
    });
  });

  it('should capture all state', () => {
    const store: VanillaStore = {
      data: {},
      state: { loading: false, error: null },
    };
    const adapter = createVanillaAdapter({ store });

    expect(adapter.captureState()).toEqual({
      'state.loading': false,
      'state.error': null,
    });
  });

  it('should support subscribe/unsubscribe', () => {
    const store: VanillaStore = { data: {}, state: {} };
    const adapter = createVanillaAdapter({ store });

    const listener = vi.fn();
    const unsubscribe = adapter.subscribe!(listener);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('should get validity when provided', () => {
    const store: VanillaStore = { data: {}, state: {} };
    const validity = new Map([
      ['data.name', { valid: false, issues: [{ code: 'required', message: 'Required', path: 'data.name', severity: 'error' as const }] }],
    ]);
    const adapter = createVanillaAdapter({ store, validity });

    expect(adapter.getValidity!('data.name')).toEqual({
      valid: false,
      issues: [{ code: 'required', message: 'Required', path: 'data.name', severity: 'error' }],
    });
  });

  it('should return undefined validity for unknown path', () => {
    const store: VanillaStore = { data: {}, state: {} };
    const validity = new Map();
    const adapter = createVanillaAdapter({ store, validity });

    expect(adapter.getValidity!('data.unknown')).toBeUndefined();
  });
});

// =============================================================================
// Vanilla Actuator
// =============================================================================

describe('createVanillaActuator', () => {
  it('should create an actuator', () => {
    const store: VanillaStore = { data: {}, state: {} };
    const actuator = createVanillaActuator({ store });

    expect(actuator.setData).toBeDefined();
    expect(actuator.setState).toBeDefined();
  });

  it('should set data values', () => {
    const store: VanillaStore = { data: { name: '' }, state: {} };
    const actuator = createVanillaActuator({ store });

    actuator.setData('data.name', 'John');
    expect((store.data as Record<string, unknown>).name).toBe('John');
  });

  it('should set state values', () => {
    const store: VanillaStore = { data: {}, state: { loading: false } };
    const actuator = createVanillaActuator({ store });

    actuator.setState('state.loading', true);
    expect((store.state as Record<string, unknown>).loading).toBe(true);
  });

  it('should call onChange when value changes', () => {
    const store: VanillaStore = { data: { name: '' }, state: {} };
    const onChange = vi.fn();
    const actuator = createVanillaActuator({ store, onChange });

    actuator.setData('data.name', 'John');
    expect(onChange).toHaveBeenCalledWith('data.name', 'John');
  });

  it('should set many data values', () => {
    const store: VanillaStore = { data: { name: '', age: 0 }, state: {} };
    const actuator = createVanillaActuator({ store });

    actuator.setManyData!({
      'data.name': 'John',
      'data.age': 30,
    });

    expect(store.data).toEqual({ name: 'John', age: 30 });
  });

  it('should set many state values', () => {
    const store: VanillaStore = { data: {}, state: { loading: false, error: null } };
    const actuator = createVanillaActuator({ store });

    actuator.setManyState!({
      'state.loading': true,
      'state.error': 'Error',
    });

    expect(store.state).toEqual({ loading: true, error: 'Error' });
  });

  it('should call onNavigate', () => {
    const store: VanillaStore = { data: {}, state: {} };
    const onNavigate = vi.fn();
    const actuator = createVanillaActuator({ store, onNavigate });

    actuator.navigate!('/dashboard', 'push');
    expect(onNavigate).toHaveBeenCalledWith('/dashboard', 'push');
  });

  it('should call onFocus', () => {
    const store: VanillaStore = { data: {}, state: {} };
    const onFocus = vi.fn();
    const actuator = createVanillaActuator({ store, onFocus });

    actuator.focus!('data.name');
    expect(onFocus).toHaveBeenCalledWith('data.name');
  });

  it('should call onApiCall', async () => {
    const store: VanillaStore = { data: {}, state: {} };
    const onApiCall = vi.fn().mockResolvedValue({ success: true });
    const actuator = createVanillaActuator({ store, onApiCall });

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

  it('should reject apiCall when not configured', async () => {
    const store: VanillaStore = { data: {}, state: {} };
    const actuator = createVanillaActuator({ store });

    await expect(
      actuator.apiCall!({ endpoint: '/api', method: 'GET' })
    ).rejects.toThrow('API call handler not configured');
  });
});

// =============================================================================
// Bridge Setup
// =============================================================================

describe('createVanillaBridgeSetup', () => {
  it('should create store, adapter, and actuator', () => {
    const setup = createVanillaBridgeSetup({
      initialData: { name: 'John' },
      initialState: { loading: false },
    });

    expect(setup.store).toBeDefined();
    expect(setup.adapter).toBeDefined();
    expect(setup.actuator).toBeDefined();
  });

  it('should initialize store with provided data', () => {
    const setup = createVanillaBridgeSetup({
      initialData: { name: 'John', age: 30 },
      initialState: { loading: false },
    });

    expect(setup.store.data).toEqual({ name: 'John', age: 30 });
    expect(setup.store.state).toEqual({ loading: false });
  });

  it('should connect adapter to store', () => {
    const setup = createVanillaBridgeSetup({
      initialData: { name: 'John' },
      initialState: {},
    });

    expect(setup.adapter.getData('data.name')).toBe('John');
  });

  it('should connect actuator to store', () => {
    const setup = createVanillaBridgeSetup({
      initialData: { name: '' },
      initialState: {},
    });

    setup.actuator.setData('data.name', 'Jane');
    expect(setup.store.data).toEqual({ name: 'Jane' });
  });

  it('should wire onChange callback', () => {
    const onChange = vi.fn();
    const setup = createVanillaBridgeSetup({
      initialData: { name: '' },
      initialState: {},
      onChange,
    });

    setup.actuator.setData('data.name', 'John');
    expect(onChange).toHaveBeenCalledWith('data.name', 'John');
  });

  it('should wire all handlers', () => {
    const onNavigate = vi.fn();
    const onFocus = vi.fn();
    const onApiCall = vi.fn().mockResolvedValue({});

    const setup = createVanillaBridgeSetup({
      initialData: {},
      initialState: {},
      onNavigate,
      onFocus,
      onApiCall,
    });

    setup.actuator.navigate!('/home');
    expect(onNavigate).toHaveBeenCalledWith('/home', undefined);

    setup.actuator.focus!('data.field');
    expect(onFocus).toHaveBeenCalledWith('data.field');
  });
});
