import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAction,
  condition,
  createRuntime,
  setValue,
} from '../../src/index.js';
import {
  explainValue,
  explainAction,
  explainField,
} from '../../src/projection/explain.js';

describe('explainValue', () => {
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
          product: defineDerived({
            deps: ['data.a', 'data.b'],
            expr: ['*', ['get', 'data.a'], ['get', 'data.b']],
            semantic: { type: 'number', description: 'Product' },
          }),
          combined: defineDerived({
            deps: ['derived.sum', 'derived.product'],
            expr: ['+', ['get', 'derived.sum'], ['get', 'derived.product']],
            semantic: { type: 'number', description: 'Sum + Product' },
          }),
        },
      },
    });
  }

  it('should explain a source value', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const explanation = explainValue(runtime, 'data.a');

    expect(explanation.path).toBe('data.a');
    expect(explanation.value).toBe(10);
    expect(explanation.summary).toContain('data.a');
    expect(explanation.summary).toContain('10');
  });

  it('should explain a derived value with dependencies', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const explanation = explainValue(runtime, 'derived.sum');

    expect(explanation.path).toBe('derived.sum');
    expect(explanation.value).toBe(15);
    expect(explanation.dependencies.length).toBe(2);
    expect(explanation.summary).toContain('derived.sum');
  });

  it('should explain nested derived values', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const explanation = explainValue(runtime, 'derived.combined');

    // combined = sum + product = 15 + 50 = 65
    expect(explanation.value).toBe(65);
    expect(explanation.dependencies.length).toBe(2);

    // Each dependency should have its own dependencies
    const sumDep = explanation.dependencies.find((d) => d.path === 'derived.sum');
    expect(sumDep).toBeDefined();
    expect(sumDep?.dependencies.length).toBe(2);
  });

  it('should include semantic metadata in explanation', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { a: 10, b: 5 } });

    const explanation = explainValue(runtime, 'data.a');

    expect(explanation.semantic).toBeDefined();
    expect(explanation.semantic?.description).toBe('First number');
  });
});

describe('explainAction', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'order',
      name: 'Order',
      description: 'Test order',
      dataSchema: z.object({ quantity: z.number() }),
      stateSchema: z.object({ submitted: z.boolean() }),
      initialState: { submitted: false },
      paths: {
        sources: {
          quantity: defineSource({
            schema: z.number(),
            defaultValue: 1,
            semantic: { type: 'number', description: 'Quantity' },
          }),
        },
        derived: {
          hasItems: defineDerived({
            deps: ['data.quantity'],
            expr: ['>', ['get', 'data.quantity'], 0],
            semantic: { type: 'boolean', description: 'Has items' },
          }),
        },
      },
      actions: {
        submit: defineAction({
          deps: ['data.quantity'],
          effect: setValue('state.submitted', true),
          preconditions: [
            condition('derived.hasItems', { expect: 'true', reason: 'Cart must have items' }),
          ],
          semantic: {
            type: 'action',
            description: 'Submit order',
            risk: 'high',
          },
        }),
      },
    });
  }

  it('should explain an available action', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5 } });

    const explanation = explainAction(runtime, domain, 'submit');

    expect(explanation.actionId).toBe('submit');
    expect(explanation.semantic.description).toBe('Submit order');
    expect(explanation.summary).toContain('available');
  });

  it('should explain preconditions', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5 } });

    const explanation = explainAction(runtime, domain, 'submit');

    expect(explanation.preconditions.length).toBe(1);
    expect(explanation.preconditions[0]?.path).toBe('derived.hasItems');
    expect(explanation.preconditions[0]?.satisfied).toBe(true);
    expect(explanation.preconditions[0]?.explanation).toContain('satisfied');
  });

  it('should explain blocked action', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 0 } });

    const explanation = explainAction(runtime, domain, 'submit');

    expect(explanation.summary).toContain('blocked');
    expect(explanation.preconditions[0]?.satisfied).toBe(false);
    expect(explanation.preconditions[0]?.explanation).toContain('NOT satisfied');
  });

  it('should throw for unknown action', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { quantity: 5 } });

    expect(() => explainAction(runtime, domain, 'unknown')).toThrow('Action not found');
  });
});

describe('explainField', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'form',
      name: 'Form',
      description: 'Test form',
      dataSchema: z.object({ name: z.string() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          name: defineSource({
            schema: z.string(),
            defaultValue: '',
            semantic: { type: 'string', description: 'User name' },
          }),
        },
      },
    });
  }

  it('should explain a field', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: 'Alice' } });

    const explanation = explainField(runtime, domain, 'data.name');

    expect(explanation.path).toBe('data.name');
    expect(explanation.value).toBe('Alice');
    expect(explanation.semantic?.description).toBe('User name');
  });

  it('should include policy explanation', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: 'Alice' } });

    const explanation = explainField(runtime, domain, 'data.name');

    expect(explanation.policyExplanation.relevant).toContain('visible');
    expect(explanation.policyExplanation.editable).toContain('editable');
    expect(explanation.policyExplanation.required).toContain('optional');
  });

  it('should generate a summary', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { name: 'Alice' } });

    const explanation = explainField(runtime, domain, 'data.name');

    expect(explanation.summary).toContain('data.name');
    expect(explanation.summary).toContain('visible');
    expect(explanation.summary).toContain('editable');
  });
});
