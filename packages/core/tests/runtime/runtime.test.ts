import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createRuntime, type DomainRuntime } from '../../src/runtime/runtime.js';
import { defineDomain, defineSource, defineDerived, defineAction, condition } from '../../src/domain/define.js';
import type { ManifestoDomain } from '../../src/domain/types.js';
import { setValue, sequence } from '../../src/effect/runner.js';

describe('Domain Runtime', () => {
  // Helper to create a test domain
  function createTestDomain(): ManifestoDomain<any, any> {
    return defineDomain({
      id: 'test-domain',
      name: 'Test Domain',
      description: 'Domain for testing runtime',
      dataSchema: z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
        discount: z.number().optional(),
      }),
      stateSchema: z.object({
        isValid: z.boolean().optional(),
      }),
      initialState: {
        isValid: false,
      },
      paths: {
        sources: {
          'data.name': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'Product name' },
          }),
          'data.quantity': defineSource({
            schema: z.number(), // Allow any number including 0
            semantic: { type: 'input', description: 'Quantity' },
          }),
          'data.price': defineSource({
            schema: z.number().min(0),
            semantic: { type: 'input', description: 'Unit price' },
          }),
          'data.discount': defineSource({
            schema: z.number().min(0).max(100).optional(),
            semantic: { type: 'input', description: 'Discount percentage' },
            policy: {
              relevantWhen: [condition('derived.hasQuantity', { expect: 'true', reason: 'Discount only available with quantity' })],
              requiredWhen: [],
            },
          }),
        },
        derived: {
          'derived.subtotal': defineDerived({
            deps: ['data.quantity', 'data.price'],
            expr: ['*', ['get', 'data.quantity'], ['get', 'data.price']],
            semantic: { type: 'computed', description: 'Subtotal before discount' },
          }),
          'derived.discountAmount': defineDerived({
            deps: ['derived.subtotal', 'data.discount'],
            expr: ['*', ['get', 'derived.subtotal'], ['/', ['coalesce', ['get', 'data.discount'], 0], 100]],
            semantic: { type: 'computed', description: 'Discount amount' },
          }),
          'derived.total': defineDerived({
            deps: ['derived.subtotal', 'derived.discountAmount'],
            expr: ['-', ['get', 'derived.subtotal'], ['get', 'derived.discountAmount']],
            semantic: { type: 'computed', description: 'Total after discount' },
          }),
          'derived.hasQuantity': defineDerived({
            deps: ['data.quantity'],
            expr: ['>', ['get', 'data.quantity'], 0],
            semantic: { type: 'condition', description: 'Has quantity' },
          }),
        },
      },
      actions: {
        'action.reset': defineAction({
          verb: 'reset',
          label: 'Reset Order',
          description: 'Reset all values to defaults',
          deps: ['data.quantity', 'data.price'],
          effect: sequence([
            setValue('data.quantity', 1, 'Reset quantity'),
            setValue('data.price', 0, 'Reset price'),
          ]),
          preconditions: [
            condition('derived.hasQuantity', { expect: 'true', reason: 'Must have quantity to reset' }),
          ],
        }),
        'action.double': defineAction({
          verb: 'double',
          label: 'Double Quantity',
          description: 'Double the current quantity',
          deps: ['data.quantity'],
          effect: setValue('data.quantity', ['*', ['get', 'data.quantity'], 2], 'Double quantity'),
        }),
      },
    });
  }

  describe('createRuntime', () => {
    it('should create a runtime with initial state', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({ domain });

      expect(runtime).toBeDefined();
      expect(runtime.getSnapshot()).toBeDefined();
    });

    it('should initialize with provided initial data', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test Product', quantity: 5, price: 100 },
      });

      expect(runtime.get('data.name')).toBe('Test Product');
      expect(runtime.get('data.quantity')).toBe(5);
      expect(runtime.get('data.price')).toBe(100);
    });

    it('should compute initial derived values', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test', quantity: 2, price: 50 },
      });

      expect(runtime.get('derived.subtotal')).toBe(100);
      expect(runtime.get('derived.total')).toBe(100);
      expect(runtime.get('derived.hasQuantity')).toBe(true);
    });
  });

  describe('get and getMany', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 3, price: 20, discount: 10 },
      });
    });

    it('should get single value', () => {
      expect(runtime.get('data.name')).toBe('Product');
      expect(runtime.get('data.quantity')).toBe(3);
    });

    it('should get derived values', () => {
      expect(runtime.get('derived.subtotal')).toBe(60);
      expect(runtime.get('derived.discountAmount')).toBe(6);
      expect(runtime.get('derived.total')).toBe(54);
    });

    it('should get multiple values', () => {
      const values = runtime.getMany(['data.name', 'data.quantity', 'derived.subtotal']);

      expect(values['data.name']).toBe('Product');
      expect(values['data.quantity']).toBe(3);
      expect(values['derived.subtotal']).toBe(60);
    });
  });

  describe('set and setMany', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 1, price: 10 },
      });
    });

    it('should set single value and propagate', () => {
      const result = runtime.set('data.quantity', 5);

      expect(result.ok).toBe(true);
      expect(runtime.get('data.quantity')).toBe(5);
      expect(runtime.get('derived.subtotal')).toBe(50);
    });

    it('should return validation error for invalid value', () => {
      // price has min(0), so negative value is invalid
      const result = runtime.set('data.price', -10);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('ValidationError');
        expect(result.error.path).toBe('data.price');
      }
    });

    it('should set multiple values', () => {
      const result = runtime.setMany({
        'data.quantity': 10,
        'data.price': 5,
      });

      expect(result.ok).toBe(true);
      expect(runtime.get('data.quantity')).toBe(10);
      expect(runtime.get('data.price')).toBe(5);
      expect(runtime.get('derived.subtotal')).toBe(50);
    });

    it('should return validation error if any value is invalid', () => {
      const result = runtime.setMany({
        'data.quantity': 10,
        'data.price': -5, // Invalid
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('execute', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 5, price: 10 },
      });
    });

    it('should execute action successfully', async () => {
      const result = await runtime.execute('action.double');

      expect(result.ok).toBe(true);
      expect(runtime.get('data.quantity')).toBe(10);
    });

    it('should return error for non-existent action', async () => {
      const result = await runtime.execute('action.nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.cause.message).toContain('Action not found');
      }
    });

    it('should check preconditions before executing', async () => {
      // Set quantity to 0 to fail precondition
      runtime.set('data.quantity', 0);

      const result = await runtime.execute('action.reset');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PRECONDITION_FAILED');
      }
    });

    it('should execute action when preconditions are met', async () => {
      // quantity > 0, so precondition is met
      const result = await runtime.execute('action.reset');

      expect(result.ok).toBe(true);
      expect(runtime.get('data.quantity')).toBe(1);
      expect(runtime.get('data.price')).toBe(0);
    });
  });

  describe('getPreconditions', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 5, price: 10 },
      });
    });

    it('should return precondition status', () => {
      const preconditions = runtime.getPreconditions('action.reset');

      expect(preconditions).toHaveLength(1);
      expect(preconditions[0]?.path).toBe('derived.hasQuantity');
      expect(preconditions[0]?.satisfied).toBe(true);
    });

    it('should show unsatisfied precondition', () => {
      runtime.set('data.quantity', 0);

      const preconditions = runtime.getPreconditions('action.reset');

      expect(preconditions[0]?.satisfied).toBe(false);
      expect(preconditions[0]?.actual).toBe(false);
    });

    it('should return empty array for action without preconditions', () => {
      const preconditions = runtime.getPreconditions('action.double');

      expect(preconditions).toHaveLength(0);
    });

    it('should return empty array for non-existent action', () => {
      const preconditions = runtime.getPreconditions('action.nonexistent');

      expect(preconditions).toHaveLength(0);
    });
  });

  describe('getFieldPolicy', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 5, price: 10 },
      });
    });

    it('should return default policy for field without policy', () => {
      const policy = runtime.getFieldPolicy('data.name');

      expect(policy.relevant).toBe(true);
      expect(policy.editable).toBe(true);
      expect(policy.required).toBe(false);
    });

    it('should evaluate relevant condition', () => {
      // With quantity > 0, discount is relevant
      let policy = runtime.getFieldPolicy('data.discount');
      expect(policy.relevant).toBe(true);

      // Set quantity to 0
      runtime.set('data.quantity', 0);

      policy = runtime.getFieldPolicy('data.discount');
      expect(policy.relevant).toBe(false);
      // relevantReason is set when condition fails
      expect(policy.relevantReason).toBeDefined();
    });

    it('should return default for non-existent field', () => {
      const policy = runtime.getFieldPolicy('nonexistent.path');

      expect(policy.relevant).toBe(true);
      expect(policy.editable).toBe(true);
      expect(policy.required).toBe(false);
    });
  });

  describe('getSemantic', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({ domain });
    });

    it('should get semantic for source path', () => {
      const semantic = runtime.getSemantic('data.name');

      expect(semantic).toBeDefined();
      expect(semantic?.type).toBe('input');
      expect(semantic?.description).toBe('Product name');
    });

    it('should get semantic for derived path', () => {
      const semantic = runtime.getSemantic('derived.subtotal');

      expect(semantic).toBeDefined();
      expect(semantic?.type).toBe('computed');
      expect(semantic?.description).toBe('Subtotal before discount');
    });

    it('should return undefined for non-existent path', () => {
      const semantic = runtime.getSemantic('nonexistent.path');

      expect(semantic).toBeUndefined();
    });
  });

  describe('explain', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 2, price: 50 },
      });
    });

    it('should explain source path', () => {
      const tree = runtime.explain('data.quantity');

      expect(tree.path).toBe('data.quantity');
      expect(tree.value).toBe(2);
      expect(tree.dependencies).toHaveLength(0);
    });

    it('should explain derived path with dependencies', () => {
      const tree = runtime.explain('derived.subtotal');

      expect(tree.path).toBe('derived.subtotal');
      expect(tree.value).toBe(100);
      expect(tree.dependencies).toHaveLength(2);
      expect(tree.dependencies.map((d) => d.path)).toContain('data.quantity');
      expect(tree.dependencies.map((d) => d.path)).toContain('data.price');
    });

    it('should provide explanation text', () => {
      const tree = runtime.explain('derived.subtotal');

      expect(tree.explanation).toBeDefined();
      expect(tree.explanation).toContain('derived.subtotal');
      expect(tree.explanation).toContain('100');
    });

    it('should recursively explain dependencies', () => {
      const tree = runtime.explain('derived.total');

      expect(tree.dependencies.length).toBeGreaterThan(0);
      // derived.total depends on derived.subtotal and derived.discountAmount
      const subtotalDep = tree.dependencies.find((d) => d.path === 'derived.subtotal');
      expect(subtotalDep).toBeDefined();
      // derived.subtotal has its own dependencies
      expect(subtotalDep?.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('getImpact', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({ domain });
    });

    it('should return affected paths for source change', () => {
      const impact = runtime.getImpact('data.quantity');

      expect(impact).toContain('derived.subtotal');
      expect(impact).toContain('derived.hasQuantity');
    });

    it('should return empty for leaf path', () => {
      const impact = runtime.getImpact('derived.total');

      // derived.total is a leaf, nothing depends on it
      expect(impact).toHaveLength(0);
    });
  });

  describe('subscriptions', () => {
    let runtime: DomainRuntime<any, any>;

    beforeEach(() => {
      const domain = createTestDomain();
      runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 1, price: 10 },
      });
    });

    it('should subscribe to snapshot changes', () => {
      const listener = vi.fn();
      const unsubscribe = runtime.subscribe(listener);

      runtime.set('data.quantity', 5);

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should subscribe to path changes', () => {
      const listener = vi.fn();
      const unsubscribe = runtime.subscribePath('data.quantity', listener);

      runtime.set('data.quantity', 5);

      expect(listener).toHaveBeenCalledWith(5, expect.anything());

      unsubscribe();
    });

    it('should unsubscribe correctly', () => {
      const listener = vi.fn();
      const unsubscribe = runtime.subscribe(listener);

      unsubscribe();
      runtime.set('data.quantity', 5);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should subscribe to events', () => {
      const domain = createTestDomain();
      const eventListener = vi.fn();

      // Need to customize the runtime to emit events
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Product', quantity: 1, price: 10 },
      });

      runtime.subscribeEvents('ui', eventListener);

      // Events are emitted via effectHandler.emitEvent
      // In this test, we're testing the subscription mechanism works
      expect(eventListener).not.toHaveBeenCalled(); // No events emitted yet
    });
  });

  describe('getSnapshot', () => {
    it('should return current snapshot', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test', quantity: 1, price: 10 },
      });

      const snapshot = runtime.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.data).toBeDefined();
      expect(snapshot.state).toBeDefined();
      expect(snapshot.derived).toBeDefined();
    });

    it('should reflect changes after set', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test', quantity: 1, price: 10 },
      });

      runtime.set('data.quantity', 5);

      const snapshot = runtime.getSnapshot();
      expect(snapshot.data.quantity).toBe(5);
    });
  });

  /**
   * P0-1 Contract Tests: Effect 실행 계약
   *
   * 핵심 계약:
   * - set()/setMany()가 propagation 에러를 Result로 반환해야 함
   * - Effect 실패가 침묵(silent)되지 않아야 함
   */
  describe('P0-1 Contract: Propagation Error Handling', () => {
    // Domain with an expression that can fail during propagation
    function createDomainWithFailableExpression(): ManifestoDomain<any, any> {
      return defineDomain({
        id: 'failable-domain',
        name: 'Failable Domain',
        description: 'Domain that can fail during propagation',
        dataSchema: z.object({
          numerator: z.number(),
          denominator: z.number(),
        }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.numerator': defineSource({
              schema: z.number(),
              semantic: { type: 'input', description: 'Numerator' },
            }),
            'data.denominator': defineSource({
              schema: z.number(),
              semantic: { type: 'input', description: 'Denominator' },
            }),
          },
          derived: {
            // This expression can fail when denominator is 0 or when invalid operation happens
            'derived.ratio': defineDerived({
              deps: ['data.numerator', 'data.denominator'],
              // Use a valid expression - division
              expr: ['/', ['get', 'data.numerator'], ['get', 'data.denominator']],
              semantic: { type: 'computed', description: 'Ratio' },
            }),
            // Chain another derived to test error propagation through the DAG
            'derived.doubleRatio': defineDerived({
              deps: ['derived.ratio'],
              expr: ['*', ['get', 'derived.ratio'], 2],
              semantic: { type: 'computed', description: 'Double ratio' },
            }),
          },
        },
        actions: {},
      });
    }

    it('should return Result<void, SetError> from set() - ValidationError case', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test', quantity: 1, price: 10 },
      });

      // Invalid value should return ValidationError
      const result = runtime.set('data.price', -10);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('ValidationError');
      }
    });

    it('should return Result<void, SetError> from setMany() - ValidationError case', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test', quantity: 1, price: 10 },
      });

      // Invalid value should return ValidationError
      const result = runtime.setMany({
        'data.quantity': 5,
        'data.price': -10, // Invalid
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('ValidationError');
      }
    });

    it('should successfully propagate when expression evaluation succeeds', () => {
      const domain = createDomainWithFailableExpression();
      const runtime = createRuntime({
        domain,
        initialData: { numerator: 10, denominator: 2 },
      });

      // Valid operation
      const result = runtime.set('data.numerator', 20);

      expect(result.ok).toBe(true);
      expect(runtime.get('derived.ratio')).toBe(10); // 20 / 2 = 10
      expect(runtime.get('derived.doubleRatio')).toBe(20); // 10 * 2 = 20
    });

    it('should propagate through DAG chain successfully', () => {
      const domain = createDomainWithFailableExpression();
      const runtime = createRuntime({
        domain,
        initialData: { numerator: 10, denominator: 5 },
      });

      // Change denominator and verify entire DAG propagates
      const result = runtime.set('data.denominator', 2);

      expect(result.ok).toBe(true);
      expect(runtime.get('derived.ratio')).toBe(5); // 10 / 2 = 5
      expect(runtime.get('derived.doubleRatio')).toBe(10); // 5 * 2 = 10
    });

    it('should handle setMany with multiple paths affecting same derived', () => {
      const domain = createDomainWithFailableExpression();
      const runtime = createRuntime({
        domain,
        initialData: { numerator: 10, denominator: 2 },
      });

      const result = runtime.setMany({
        'data.numerator': 20,
        'data.denominator': 4,
      });

      expect(result.ok).toBe(true);
      expect(runtime.get('derived.ratio')).toBe(5); // 20 / 4 = 5
      expect(runtime.get('derived.doubleRatio')).toBe(10); // 5 * 2 = 10
    });

    it('should return SetError type which is ValidationError | PropagationError union', () => {
      const domain = createTestDomain();
      const runtime = createRuntime({
        domain,
        initialData: { name: 'Test', quantity: 1, price: 10 },
      });

      // Get a validation error
      const result = runtime.set('data.price', -10);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // SetError should have _tag property to distinguish error types
        expect(result.error).toHaveProperty('_tag');
        expect(['ValidationError', 'PropagationError']).toContain(result.error._tag);
      }
    });
  });

  // ===========================================
  // P1-1: Async Path Guard
  // ===========================================
  describe('async path guard (P1-1)', () => {
    function createAsyncDomain(): ManifestoDomain<any, any> {
      return defineDomain({
        id: 'async-test',
        name: 'Async Test Domain',
        description: 'Domain for testing async path guard',
        dataSchema: z.object({
          query: z.string(),
        }),
        stateSchema: z.object({
          async: z.object({
            search: z.object({
              result: z.array(z.string()).optional(),
              loading: z.boolean().optional(),
              error: z.string().nullable().optional(),
            }).optional(),
          }).optional(),
        }),
        initialState: {
          async: {
            search: {
              result: ['item1', 'item2'],
              loading: false,
              error: null,
            },
          },
        },
        paths: {
          sources: {
            'data.query': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Search query' },
            }),
          },
          derived: {},
          async: {
            'async.search': {
              deps: ['data.query'],
              effect: {
                _tag: 'ApiCall',
                endpoint: '/api/search',
                method: 'GET',
                description: 'Search',
              },
              resultPath: 'state.async.search.result',
              loadingPath: 'state.async.search.loading',
              errorPath: 'state.async.search.error',
              semantic: { type: 'async', description: 'Search API' },
            },
          },
        },
        actions: {},
      });
    }

    it('should warn when accessing async base path directly', () => {
      const domain = createAsyncDomain();
      const runtime = createRuntime({
        domain,
        initialData: { query: 'test' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Access async base path directly (should warn)
      runtime.get('async.search');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"async.search" is an async process path, not a value path')
      );
      // Should suggest the actual resultPath from the domain definition
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Use "state.async.search.result"')
      );

      warnSpy.mockRestore();
    });

    it('should fall back to .result when accessing async base path', () => {
      const domain = createAsyncDomain();
      const runtime = createRuntime({
        domain,
        initialData: { query: 'test' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Access async base path - should return .result value
      const result = runtime.get('async.search');

      // Should fall back to .result value
      expect(result).toEqual(['item1', 'item2']);

      warnSpy.mockRestore();
    });

    it('should not warn when accessing async value paths (.result, .loading, .error)', () => {
      const domain = createAsyncDomain();
      const runtime = createRuntime({
        domain,
        initialData: { query: 'test' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Access specific value paths (should NOT warn)
      runtime.get('async.search.result');
      runtime.get('async.search.loading');
      runtime.get('async.search.error');

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should not warn for non-async paths', () => {
      const domain = createAsyncDomain();
      const runtime = createRuntime({
        domain,
        initialData: { query: 'test' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Access regular paths (should NOT warn)
      runtime.get('data.query');

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
