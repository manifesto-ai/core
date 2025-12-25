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
  projectSnapshot,
  projectAgentContext,
} from '../../src/projection/agent-context.js';

describe('projectSnapshot', () => {
  it('should project a simple snapshot', () => {
    const domain = defineDomain({
      id: 'test',
      name: 'Test Domain',
      description: 'Test',
      dataSchema: z.object({ name: z.string(), age: z.number() }),
      stateSchema: z.object({ loading: z.boolean() }),
      initialState: { loading: false },
      paths: {
        sources: {
          name: defineSource({
            schema: z.string(),
            defaultValue: 'John',
            semantic: { type: 'string', description: 'Name' },
          }),
          age: defineSource({
            schema: z.number(),
            defaultValue: 25,
            semantic: { type: 'number', description: 'Age' },
          }),
        },
      },
    });

    const runtime = createRuntime({ domain, initialData: { name: 'John', age: 25 } });
    const snapshot = runtime.getSnapshot();
    const projected = projectSnapshot(snapshot);

    expect(projected.data).toHaveProperty('name', 'John');
    expect(projected.data).toHaveProperty('age', 25);
  });

  it('should handle nested objects', () => {
    const domain = defineDomain({
      id: 'test',
      name: 'Test',
      description: 'Test',
      dataSchema: z.object({ user: z.object({ name: z.string() }) }),
      stateSchema: z.object({}),
      initialState: {},
    });

    const runtime = createRuntime({
      domain,
      initialData: { user: { name: 'Alice' } },
    });
    const snapshot = runtime.getSnapshot();
    const projected = projectSnapshot(snapshot);

    expect(projected.data).toHaveProperty('user.name', 'Alice');
  });
});

describe('projectAgentContext', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'order',
      name: 'Order Domain',
      description: 'Test order domain',
      dataSchema: z.object({
        quantity: z.number(),
        unitPrice: z.number(),
        discountPercent: z.number(),
      }),
      stateSchema: z.object({
        cartHasItems: z.boolean(),
      }),
      initialState: { cartHasItems: true },
      paths: {
        sources: {
          quantity: defineSource({
            schema: z.number(),
            defaultValue: 1,
            semantic: { type: 'number', description: 'Quantity' },
          }),
          unitPrice: defineSource({
            schema: z.number(),
            defaultValue: 50,
            semantic: { type: 'number', description: 'Unit price' },
          }),
          discountPercent: defineSource({
            schema: z.number(),
            defaultValue: 0,
            semantic: { type: 'number', description: 'Discount percent' },
          }),
        },
        derived: {
          subtotal: defineDerived({
            deps: ['data.quantity', 'data.unitPrice'],
            expr: ['*', ['get', 'data.quantity'], ['get', 'data.unitPrice']],
            semantic: { type: 'number', description: 'Subtotal' },
          }),
          total: defineDerived({
            deps: ['derived.subtotal', 'data.discountPercent'],
            expr: [
              '*',
              ['get', 'derived.subtotal'],
              ['-', 1, ['/', ['get', 'data.discountPercent'], 100]],
            ],
            semantic: { type: 'number', description: 'Total' },
          }),
          canCheckout: defineDerived({
            deps: ['derived.total'],
            expr: ['>', ['get', 'derived.total'], 0],
            semantic: { type: 'boolean', description: 'Can checkout' },
          }),
        },
      },
      actions: {
        checkout: defineAction({
          deps: ['derived.total'],
          effect: setValue('state.cartHasItems', false),
          preconditions: [
            condition('derived.canCheckout', { expect: 'true', reason: 'Cart must have positive total' }),
          ],
          semantic: {
            type: 'action',
            description: 'Checkout order',
            risk: 'medium',
          },
        }),
        clearCart: defineAction({
          deps: ['data.quantity'],
          effect: setValue('data.quantity', 0),
          semantic: {
            type: 'action',
            description: 'Clear cart',
            risk: 'low',
          },
        }),
      },
    });
  }

  it('should create agent context with available actions', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain);

    expect(context.availableActions.length).toBeGreaterThan(0);
    expect(context.availableActions.find((a) => a.actionId === 'checkout')).toBeDefined();
    expect(context.availableActions.find((a) => a.actionId === 'clearCart')).toBeDefined();
  });

  it('should show unavailable actions with reasons', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 0, unitPrice: 50, discountPercent: 0 },
    });

    const context = projectAgentContext(runtime, domain);

    // With quantity=0, total=0, canCheckout=false
    const checkoutAction = context.unavailableActions.find((a) => a.actionId === 'checkout');
    expect(checkoutAction).toBeDefined();
    expect(checkoutAction?.blockedReasons.length).toBeGreaterThan(0);
    expect(checkoutAction?.blockedReasons[0]?.reason).toBe('Cart must have positive total');
  });

  it('should include derived values in snapshot', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain);

    expect(context.snapshot.derived).toHaveProperty('subtotal', 100);
    expect(context.snapshot.derived).toHaveProperty('total', 90);
    expect(context.snapshot.derived).toHaveProperty('canCheckout', true);
  });

  it('should include field policies when requested', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain, { includeFieldPolicies: true });

    expect(Object.keys(context.fieldPolicies).length).toBeGreaterThan(0);
  });

  it('should include metadata', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain);

    expect(context.metadata.projectedAt).toBeGreaterThan(0);
    expect(context.metadata.pathCount).toBeGreaterThan(0);
    // Snapshot version increments with each propagation during initialization
    expect(context.metadata.snapshotVersion).toBeGreaterThan(0);
  });

  it('should estimate tokens when requested', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain, { estimateTokens: true });

    expect(context.metadata.estimatedTokens).toBeDefined();
    expect(context.metadata.estimatedTokens).toBeGreaterThan(0);
  });

  it('should include field info when requested', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain, { includeFields: true });

    expect(context.fields.length).toBeGreaterThan(0);
    const quantityField = context.fields.find((f) => f.path === 'data.quantity');
    expect(quantityField).toBeDefined();
    expect(quantityField?.value).toBe(2);
  });

  it('should exclude field info when requested', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { quantity: 2, unitPrice: 50, discountPercent: 10 },
    });

    const context = projectAgentContext(runtime, domain, { includeFields: false });

    expect(context.fields.length).toBe(0);
  });
});
