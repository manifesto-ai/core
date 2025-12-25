import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAsync,
  defineAction,
  condition,
  createRuntime,
  setValue,
  apiCall,
} from '../../src/index.js';
import {
  analyzeValueImpact,
  analyzeActionImpact,
  getImpactMap,
} from '../../src/projection/impact.js';

describe('analyzeValueImpact', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'calc',
      name: 'Calculator',
      description: 'Test calculator',
      dataSchema: z.object({ a: z.number(), b: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          a: defineSource({
            schema: z.number(),
            defaultValue: 10,
            semantic: { type: 'number', description: 'First number' },
          }),
          b: defineSource({
            schema: z.number(),
            defaultValue: 5,
            semantic: { type: 'number', description: 'Second number' },
          }),
        },
        derived: {
          sum: defineDerived({
            deps: ['data.a', 'data.b'],
            expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
            semantic: { type: 'number', description: 'Sum' },
          }),
          doubled: defineDerived({
            deps: ['derived.sum'],
            expr: ['*', ['get', 'derived.sum'], 2],
            semantic: { type: 'number', description: 'Sum doubled' },
          }),
        },
      },
      actions: {
        reset: defineAction({
          deps: ['data.a'],
          effect: setValue('data.a', 0),
          preconditions: [
            condition('derived.sum', { expect: 'true', reason: 'Sum must be positive' }),
          ],
          semantic: { type: 'action', description: 'Reset', risk: 'low' },
        }),
      },
    });
  }

  it('should analyze direct impact', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const impact = analyzeValueImpact(runtime, domain, 'data.a');

    expect(impact.changedPath).toBe('data.a');
    expect(impact.directImpact).toContain('derived.sum');
  });

  it('should analyze transitive impact', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const impact = analyzeValueImpact(runtime, domain, 'data.a');

    expect(impact.transitiveImpact).toContain('derived.doubled');
  });

  it('should identify affected actions', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const impact = analyzeValueImpact(runtime, domain, 'data.a');

    expect(impact.affectedActions).toContain('reset');
  });

  it('should identify async triggers', () => {
    const domain = defineDomain({
      id: 'async-test',
      name: 'Async Test',
      description: 'Test with async',
      dataSchema: z.object({ query: z.string() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          query: defineSource({
            schema: z.string(),
            defaultValue: '',
            semantic: { type: 'string', description: 'Search query' },
          }),
        },
        async: {
          // Use 'search' - it will be prefixed to 'async.search' by defineDomain
          search: defineAsync('search', {
            deps: ['data.query'],
            effect: apiCall({ url: '/api/search', method: 'GET' }),
            semantic: { type: 'async', description: 'Search results' },
          }),
        },
      },
    });

    const runtime = createRuntime({ domain, initialData: { query: 'test' } });
    const impact = analyzeValueImpact(runtime, domain, 'data.query');

    expect(impact.asyncTriggers).toContain('async.search');
  });
});

describe('analyzeActionImpact', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'order',
      name: 'Order',
      description: 'Test order',
      dataSchema: z.object({ quantity: z.number(), price: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          quantity: defineSource({
            schema: z.number(),
            defaultValue: 1,
            semantic: { type: 'number', description: 'Quantity' },
          }),
          price: defineSource({
            schema: z.number(),
            defaultValue: 10,
            semantic: { type: 'number', description: 'Price' },
          }),
        },
        derived: {
          total: defineDerived({
            deps: ['data.quantity', 'data.price'],
            expr: ['*', ['get', 'data.quantity'], ['get', 'data.price']],
            semantic: { type: 'number', description: 'Total' },
          }),
          canOrder: defineDerived({
            deps: ['derived.total'],
            expr: ['>', ['get', 'derived.total'], 0],
            semantic: { type: 'boolean', description: 'Can order' },
          }),
        },
      },
      actions: {
        clearQuantity: defineAction({
          deps: ['data.quantity'],
          effect: setValue('data.quantity', 0),
          semantic: { type: 'action', description: 'Clear quantity', risk: 'low' },
        }),
        order: defineAction({
          deps: ['derived.total'],
          effect: setValue('data.quantity', 0),
          preconditions: [condition('derived.canOrder', { expect: 'true' })],
          semantic: { type: 'action', description: 'Place order', risk: 'high' },
        }),
      },
    });
  }

  it('should analyze action direct modifications', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5, price: 10 } });

    const impact = analyzeActionImpact(runtime, domain, 'clearQuantity');

    expect(impact.actionId).toBe('clearQuantity');
    expect(impact.directModifications).toContain('data.quantity');
  });

  it('should analyze propagated changes', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5, price: 10 } });

    const impact = analyzeActionImpact(runtime, domain, 'clearQuantity');

    expect(impact.propagatedChanges).toContain('derived.total');
    expect(impact.propagatedChanges).toContain('derived.canOrder');
  });

  it('should identify affected other actions', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5, price: 10 } });

    const impact = analyzeActionImpact(runtime, domain, 'clearQuantity');

    // clearQuantity affects canOrder which is a precondition for 'order'
    expect(impact.affectedActions).toContain('order');
  });

  it('should include risk level', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5, price: 10 } });

    const lowRiskImpact = analyzeActionImpact(runtime, domain, 'clearQuantity');
    expect(lowRiskImpact.riskLevel).toBe('low');

    const highRiskImpact = analyzeActionImpact(runtime, domain, 'order');
    expect(highRiskImpact.riskLevel).toBe('high');
  });

  it('should throw for unknown action', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5, price: 10 } });

    expect(() => analyzeActionImpact(runtime, domain, 'unknown')).toThrow('Action not found');
  });
});

describe('getImpactMap', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'impact-map-test',
      name: 'Impact Map Test',
      description: 'Test impact map',
      dataSchema: z.object({ root: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          root: defineSource({
            schema: z.number(),
            defaultValue: 1,
            semantic: { type: 'number', description: 'Root' },
          }),
        },
        derived: {
          level1a: defineDerived({
            deps: ['data.root'],
            expr: ['*', ['get', 'data.root'], 2],
            semantic: { type: 'number', description: 'Level 1a' },
          }),
          level1b: defineDerived({
            deps: ['data.root'],
            expr: ['*', ['get', 'data.root'], 3],
            semantic: { type: 'number', description: 'Level 1b' },
          }),
          level2: defineDerived({
            deps: ['derived.level1a', 'derived.level1b'],
            expr: ['+', ['get', 'derived.level1a'], ['get', 'derived.level1b']],
            semantic: { type: 'number', description: 'Level 2' },
          }),
        },
      },
    });
  }

  it('should create an impact map for all paths', () => {
    const domain = createTestDomain();
    const impactMap = getImpactMap(domain);

    expect(impactMap.has('data.root')).toBe(true);
    expect(impactMap.has('derived.level1a')).toBe(true);
    expect(impactMap.has('derived.level1b')).toBe(true);
    expect(impactMap.has('derived.level2')).toBe(true);
  });

  it('should identify high impact paths', () => {
    const domain = createTestDomain();
    const impactMap = getImpactMap(domain);

    const rootImpact = impactMap.get('data.root');
    expect(rootImpact).toBeDefined();
    expect(rootImpact?.dependentCount).toBeGreaterThan(0);
  });

  it('should count dependents correctly', () => {
    const domain = createTestDomain();
    const impactMap = getImpactMap(domain);

    // root affects level1a, level1b, and level2 (3 dependents)
    const rootImpact = impactMap.get('data.root');
    expect(rootImpact?.dependentCount).toBe(3);

    // level2 has no dependents
    const level2Impact = impactMap.get('derived.level2');
    expect(level2Impact?.dependentCount).toBe(0);
  });
});
