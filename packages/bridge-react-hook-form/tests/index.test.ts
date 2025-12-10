import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
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
import {
  createReactHookFormAdapter,
  createReactHookFormActuator,
  useManifestoBridge,
} from '../src/index.js';

// =============================================================================
// Test Setup
// =============================================================================

interface TestFormData {
  name: string;
  age: number;
  email?: string;
}

interface TestState {
  loading: boolean;
  submitted: boolean;
}

function createTestDomain(): ManifestoDomain<TestFormData, TestState> {
  return defineDomain({
    id: 'test-form-domain',
    name: 'Test Form Domain',
    description: 'A test domain for RHF bridge testing',
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

// Mock form factory
function createMockForm(
  defaultValues: Partial<TestFormData> = {}
): UseFormReturn<TestFormData> {
  const values: TestFormData = {
    name: '',
    age: 0,
    ...defaultValues,
  };

  const errors: Record<string, { message: string; type: string }> = {};
  const watchCallbacks = new Set<(value: unknown, info: { name?: string }) => void>();

  const form: UseFormReturn<TestFormData> = {
    getValues: vi.fn((field?: string) => {
      if (!field) return values;
      return (values as Record<string, unknown>)[field];
    }) as UseFormReturn<TestFormData>['getValues'],

    setValue: vi.fn((name: string, value: unknown, options?: unknown) => {
      (values as Record<string, unknown>)[name] = value;
      // Trigger watch callbacks
      for (const cb of watchCallbacks) {
        cb(values, { name });
      }
    }) as UseFormReturn<TestFormData>['setValue'],

    setFocus: vi.fn() as UseFormReturn<TestFormData>['setFocus'],

    watch: vi.fn((callback?: (value: unknown, info: { name?: string }) => void) => {
      if (callback) {
        watchCallbacks.add(callback);
        return { unsubscribe: () => watchCallbacks.delete(callback) };
      }
      return values;
    }) as UseFormReturn<TestFormData>['watch'],

    formState: {
      errors,
      isDirty: false,
      isValid: true,
      isSubmitting: false,
      isSubmitted: false,
      isSubmitSuccessful: false,
      isLoading: false,
      isValidating: false,
      submitCount: 0,
      defaultValues: defaultValues as TestFormData,
      dirtyFields: {},
      touchedFields: {},
      validatingFields: {},
      disabled: false,
    },

    // Add minimal required methods (mocked)
    register: vi.fn() as UseFormReturn<TestFormData>['register'],
    handleSubmit: vi.fn() as UseFormReturn<TestFormData>['handleSubmit'],
    reset: vi.fn() as UseFormReturn<TestFormData>['reset'],
    resetField: vi.fn() as UseFormReturn<TestFormData>['resetField'],
    setError: vi.fn() as UseFormReturn<TestFormData>['setError'],
    clearErrors: vi.fn() as UseFormReturn<TestFormData>['clearErrors'],
    trigger: vi.fn() as UseFormReturn<TestFormData>['trigger'],
    unregister: vi.fn() as UseFormReturn<TestFormData>['unregister'],
    control: {} as UseFormReturn<TestFormData>['control'],
    getFieldState: vi.fn() as UseFormReturn<TestFormData>['getFieldState'],
  };

  // Helper to set errors for testing
  (form as Record<string, unknown>)._setError = (field: string, error: { message: string; type: string } | null) => {
    if (error) {
      errors[field] = error;
    } else {
      delete errors[field];
    }
  };

  return form;
}

// =============================================================================
// createReactHookFormAdapter Tests
// =============================================================================

describe('createReactHookFormAdapter', () => {
  let form: UseFormReturn<TestFormData>;

  beforeEach(() => {
    form = createMockForm({ name: 'John', age: 25 });
  });

  describe('getData', () => {
    it('should get data value with data. prefix', () => {
      const adapter = createReactHookFormAdapter(form);

      expect(adapter.getData('data.name')).toBe('John');
      expect(adapter.getData('data.age')).toBe(25);
    });

    it('should get data value without prefix', () => {
      const adapter = createReactHookFormAdapter(form);

      expect(adapter.getData('name')).toBe('John');
    });
  });

  describe('getState', () => {
    it('should return undefined (RHF does not manage state)', () => {
      const adapter = createReactHookFormAdapter(form);

      expect(adapter.getState('state.loading')).toBeUndefined();
    });
  });

  describe('getValidity', () => {
    it('should return valid for fields without errors', () => {
      const adapter = createReactHookFormAdapter(form);

      const validity = adapter.getValidity!('data.name');

      expect(validity).toEqual({ valid: true, issues: [] });
    });

    it('should return invalid for fields with errors', () => {
      (form as Record<string, unknown>)._setError('name', {
        message: 'Name is required',
        type: 'required',
      });

      const adapter = createReactHookFormAdapter(form);
      const validity = adapter.getValidity!('data.name');

      expect(validity?.valid).toBe(false);
      expect(validity?.issues).toHaveLength(1);
      expect(validity?.issues[0]?.message).toBe('Name is required');
      expect(validity?.issues[0]?.code).toBe('required');
    });
  });

  describe('subscribe', () => {
    it('should call listener when form value changes', () => {
      const adapter = createReactHookFormAdapter(form);
      const listener = vi.fn();

      adapter.subscribe!(listener);

      // Trigger a change
      form.setValue('name', 'Jane');

      expect(listener).toHaveBeenCalledWith(['data.name']);
    });

    it('should unsubscribe correctly', () => {
      const adapter = createReactHookFormAdapter(form);
      const listener = vi.fn();

      const unsubscribe = adapter.subscribe!(listener);
      unsubscribe();

      form.setValue('name', 'Jane');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('captureData', () => {
    it('should capture all form values', () => {
      const adapter = createReactHookFormAdapter(form);

      const data = adapter.captureData();

      expect(data).toEqual({
        'data.name': 'John',
        'data.age': 25,
      });
    });
  });

  describe('captureState', () => {
    it('should return empty object (RHF does not manage state)', () => {
      const adapter = createReactHookFormAdapter(form);

      const state = adapter.captureState();

      expect(state).toEqual({});
    });
  });
});

// =============================================================================
// createReactHookFormActuator Tests
// =============================================================================

describe('createReactHookFormActuator', () => {
  let form: UseFormReturn<TestFormData>;

  beforeEach(() => {
    form = createMockForm();
  });

  describe('setData', () => {
    it('should set form value with data. prefix', () => {
      const actuator = createReactHookFormActuator(form);

      actuator.setData('data.name', 'John');

      expect(form.setValue).toHaveBeenCalledWith('name', 'John', {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    });

    it('should set form value without prefix', () => {
      const actuator = createReactHookFormActuator(form);

      actuator.setData('age', 30);

      expect(form.setValue).toHaveBeenCalledWith('age', 30, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    });
  });

  describe('setState', () => {
    it('should be a no-op (RHF does not manage state)', () => {
      const actuator = createReactHookFormActuator(form);

      actuator.setState('state.loading', true);

      // No error thrown, just a no-op
    });
  });

  describe('setManyData', () => {
    it('should set multiple form values', () => {
      const actuator = createReactHookFormActuator(form);

      actuator.setManyData!({
        'data.name': 'John',
        'data.age': 30,
      });

      expect(form.setValue).toHaveBeenCalledTimes(2);
    });
  });

  describe('focus', () => {
    it('should focus the field', () => {
      const actuator = createReactHookFormActuator(form);

      actuator.focus!('data.name');

      expect(form.setFocus).toHaveBeenCalledWith('name');
    });
  });
});

// =============================================================================
// useManifestoBridge Hook Tests
// =============================================================================

describe('useManifestoBridge', () => {
  let domain: ManifestoDomain<TestFormData, TestState>;
  let runtime: DomainRuntime<TestFormData, TestState>;

  beforeEach(() => {
    domain = createTestDomain();
    runtime = createRuntime({
      domain,
      initialData: { name: '', age: 0 },
    });
  });

  it('should create a bridge', () => {
    const { result } = renderHook(() => {
      const form = useForm<TestFormData>({
        defaultValues: { name: '', age: 0 },
      });
      return useManifestoBridge(form, runtime);
    });

    expect(result.current).toBeDefined();
    expect(result.current.runtime).toBe(runtime);
  });

  it('should expose bridge methods', () => {
    const { result } = renderHook(() => {
      const form = useForm<TestFormData>({
        defaultValues: { name: '', age: 0 },
      });
      return useManifestoBridge(form, runtime);
    });

    expect(typeof result.current.get).toBe('function');
    expect(typeof result.current.execute).toBe('function');
    expect(typeof result.current.capture).toBe('function');
    expect(typeof result.current.sync).toBe('function');
    expect(typeof result.current.dispose).toBe('function');
    expect(typeof result.current.getFieldPolicy).toBe('function');
    expect(typeof result.current.isActionAvailable).toBe('function');
    expect(typeof result.current.subscribe).toBe('function');
  });

  it('should check action availability', async () => {
    const { result } = renderHook(() => {
      const form = useForm<TestFormData>({
        defaultValues: { name: '', age: 0 },
      });
      return useManifestoBridge(form, runtime);
    });

    // Initially, canSubmit should be false (name is empty)
    expect(result.current.isActionAvailable('action.submit')).toBe(false);

    // Set valid data
    await act(async () => {
      runtime.set('data.name', 'John');
      runtime.set('data.age', 25);
    });

    expect(result.current.isActionAvailable('action.submit')).toBe(true);
  });

  it('should execute commands', async () => {
    const { result } = renderHook(() => {
      const form = useForm<TestFormData>({
        defaultValues: { name: 'John', age: 25 },
      });
      return useManifestoBridge(form, runtime);
    });

    // Capture form values into runtime
    act(() => {
      result.current.capture();
    });

    // Execute action
    let executeResult;
    await act(async () => {
      executeResult = await result.current.execute({
        type: 'EXECUTE_ACTION',
        actionId: 'action.submit',
      });
    });

    expect(executeResult).toEqual({ ok: true, value: undefined });
    expect(runtime.get('state.submitted')).toBe(true);
  });

  it('should dispose on unmount', () => {
    const { result, unmount } = renderHook(() => {
      const form = useForm<TestFormData>({
        defaultValues: { name: '', age: 0 },
      });
      return useManifestoBridge(form, runtime);
    });

    const bridge = result.current;

    unmount();

    // After unmount, bridge should be disposed
    expect(() => bridge.get('data.name')).toThrow('Bridge is disposed');
  });
});
