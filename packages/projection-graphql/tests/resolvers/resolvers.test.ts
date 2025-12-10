import { describe, it, expect, beforeEach } from 'vitest';

import { createQueryResolvers } from '../../src/resolvers/query-resolvers.js';
import { createMutationResolvers } from '../../src/resolvers/mutation-resolvers.js';
import { createSubscriptionResolvers, setupRuntimeSubscriptions, withFilter, withTransform } from '../../src/resolvers/subscription-resolvers.js';
import { createFieldResolvers, createComputedResolver, createLazyResolver, createMappedResolver, createFormattedResolver, createValidatedResolver, composeResolvers, chainResolvers, withErrorHandling, withCache } from '../../src/resolvers/field-resolvers.js';
import { createResolvers } from '../../src/resolvers/index.js';
import { SimplePubSub } from '../../src/context/graphql-context.js';

// Mock runtime
const createMockRuntime = (data: Record<string, unknown> = {}, state: Record<string, unknown> = {}) => {
  const store: Record<string, unknown> = { ...data, ...state };
  const subscribers: Array<(snapshot: any) => void> = [];

  return {
    get: (path: string) => store[path],
    set: (path: string, value: unknown) => {
      store[path] = value;
      const snapshot = { data, state };
      subscribers.forEach(cb => cb(snapshot));
    },
    getSnapshot: () => ({ data, state }),
    subscribe: (callback: (snapshot: any) => void) => {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    evaluateCondition: (ref: string) => true,
    evaluatePrecondition: (precondition: any) => ({ satisfied: true }),
  };
};

// Mock domain
const createMockDomain = () => ({
  id: 'test',
  name: 'Test Domain',
  dataSchema: null,
  stateSchema: null,
  paths: {
    sources: {
      'data.email': {
        semantic: { type: 'input', description: 'User email' },
      },
    },
    derived: {
      'derived.total': {
        expression: 'SUM(data.items)',
        semantic: { type: 'computed', description: 'Total amount' },
      },
    },
    async: {
      'async.profile': {
        loader: 'loadProfile',
        semantic: { type: 'async', description: 'User profile' },
      },
    },
  },
  actions: {
    submit: {
      verb: 'Submit',
      description: 'Submit the form',
      preconditions: [],
      effect: { _tag: 'SetValue', path: 'state.submitted', value: true },
    },
    cancel: {
      description: 'Cancel the form',
      effect: { _tag: 'SetValue', path: 'state.cancelled', value: true },
    },
  },
});

// Mock context
const createMockContext = (runtime: any, domain: any, pubsub?: SimplePubSub) => ({
  runtime,
  domain,
  requestId: 'test-123',
  pubsub,
});

describe('Query Resolvers', () => {
  it('should create query resolvers', () => {
    const domain = createMockDomain() as any;
    const resolvers = createQueryResolvers(domain, 'Test');

    expect(resolvers.test).toBeDefined();
    expect(resolvers.testField).toBeDefined();
    expect(resolvers.testPolicies).toBeDefined();
    expect(resolvers.testActions).toBeDefined();
  });

  it('should resolve domain state', () => {
    const runtime = createMockRuntime({ email: 'test@example.com' }, { loading: false });
    const domain = createMockDomain() as any;
    const resolvers = createQueryResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.test({}, {}, context as any, {} as any);
    expect(result).toBeDefined();
  });

  it('should resolve field value', () => {
    const runtime = createMockRuntime({ 'data.email': 'test@example.com' });
    const domain = createMockDomain() as any;
    const resolvers = createQueryResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.testField({}, { path: 'data.email' }, context as any, {} as any);
    expect(result).toBeDefined();
    expect((result as any).path).toBe('data.email');
    expect((result as any).value).toBe('test@example.com');
  });

  it('should return null for non-existent field', () => {
    const runtime = createMockRuntime();
    (runtime as any).get = () => { throw new Error('Not found'); };
    const domain = createMockDomain() as any;
    const resolvers = createQueryResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.testField({}, { path: 'data.unknown' }, context as any, {} as any);
    expect(result).toBeNull();
  });

  it('should resolve policies', () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const resolvers = createQueryResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.testPolicies({}, {}, context as any, {} as any);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should resolve actions', () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const resolvers = createQueryResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.testActions({}, {}, context as any, {} as any) as any[];
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]!.id).toBe('submit');
    expect(result[0]!.verb).toBe('Submit');
    expect(result[1]!.id).toBe('cancel');
  });
});

describe('Mutation Resolvers', () => {
  it('should create mutation resolvers', () => {
    const domain = createMockDomain() as any;
    const resolvers = createMutationResolvers(domain, 'Test');

    expect(resolvers.setTestField).toBeDefined();
    expect(resolvers.testSubmit).toBeDefined();
    expect(resolvers.testCancel).toBeDefined();
  });

  it('should set field value', async () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const resolvers = createMutationResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = await resolvers.setTestField(
      {},
      { path: 'data.email', value: 'new@example.com' },
      context as any,
      {} as any
    ) as any;

    expect(result.success).toBe(true);
    expect(result.path).toBe('data.email');
    expect(result.newValue).toBe('new@example.com');
  });

  it('should handle set field error', async () => {
    const runtime = createMockRuntime();
    (runtime as any).set = () => { throw new Error('Cannot set'); };
    const domain = createMockDomain() as any;
    const resolvers = createMutationResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = await resolvers.setTestField(
      {},
      { path: 'data.email', value: 'new@example.com' },
      context as any,
      {} as any
    ) as any;

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should execute action', async () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const resolvers = createMutationResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = await resolvers.testSubmit(
      {},
      { input: {} },
      context as any,
      {} as any
    ) as any;

    expect(result.success).toBe(true);
  });

  it('should publish events when pubsub provided', async () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const pubsub = new SimplePubSub();
    const resolvers = createMutationResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain, pubsub);

    const events: unknown[] = [];
    await pubsub.subscribe('test:changed', (e) => events.push(e));

    await resolvers.setTestField(
      {},
      { path: 'data.email', value: 'new@example.com' },
      context as any,
      {} as any
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Subscription Resolvers', () => {
  it('should create subscription resolvers', () => {
    const domain = createMockDomain() as any;
    const resolvers = createSubscriptionResolvers(domain, 'Test');

    expect(resolvers.testChanged).toBeDefined();
    expect(resolvers.testFieldChanged).toBeDefined();
  });

  it('should throw error without pubsub', () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const resolvers = createSubscriptionResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    expect(() => {
      resolvers.testChanged.subscribe({}, {}, context as any, {} as any);
    }).toThrow('PubSub not configured');
  });

  it('should create async iterator with pubsub', () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const pubsub = new SimplePubSub();
    const resolvers = createSubscriptionResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain, pubsub);

    const iterator = resolvers.testChanged.subscribe({}, {}, context as any, {} as any);
    expect(iterator).toBeDefined();
    expect(typeof iterator.next).toBe('function');
  });

  it('should resolve subscription payload', () => {
    const domain = createMockDomain() as any;
    const resolvers = createSubscriptionResolvers(domain, 'Test');

    const payload = { type: 'DATA_CHANGED', timestamp: Date.now(), paths: [], snapshot: {} };
    const result = resolvers.testChanged.resolve?.(payload);

    expect(result).toBe(payload);
  });
});

describe('Field Resolvers', () => {
  it('should create field resolvers', () => {
    const domain = createMockDomain() as any;
    const resolvers = createFieldResolvers(domain, 'Test');

    expect(resolvers.Test).toBeDefined();
    expect(resolvers.Test.total).toBeDefined();
  });

  it('should resolve derived field', () => {
    const runtime = createMockRuntime({ 'derived.total': 100 });
    const domain = createMockDomain() as any;
    const resolvers = createFieldResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.Test.total({}, {}, context as any, {} as any);
    expect(result).toBe(100);
  });

  it('should handle derived field error', () => {
    const runtime = createMockRuntime();
    (runtime as any).get = () => { throw new Error('Error'); };
    const domain = createMockDomain() as any;
    const resolvers = createFieldResolvers(domain, 'Test');
    const context = createMockContext(runtime, domain);

    const result = resolvers.Test.total({}, {}, context as any, {} as any);
    expect(result).toBeNull();
  });
});

describe('Field Resolver Helpers', () => {
  it('should create computed resolver', () => {
    const resolver = createComputedResolver((parent, context) => 'computed');
    const result = resolver({}, {}, {} as any, {} as any);
    expect(result).toBe('computed');
  });

  it('should create lazy resolver', async () => {
    const resolver = createLazyResolver(async () => 'loaded');
    const result = await resolver({}, {}, {} as any, {} as any);
    expect(result).toBe('loaded');
  });

  it('should create mapped resolver', () => {
    const resolver = createMappedResolver('nested.value');
    const result = resolver({ nested: { value: 42 } }, {}, {} as any, {} as any);
    expect(result).toBe(42);
  });

  it('should handle null parent in mapped resolver', () => {
    const resolver = createMappedResolver('value');
    expect(resolver(null, {}, {} as any, {} as any)).toBeNull();
  });

  it('should create formatted resolver', () => {
    const resolver = createFormattedResolver('amount', (val) => `$${val}`);
    const result = resolver({ amount: 100 }, {}, {} as any, {} as any);
    expect(result).toBe('$100');
  });

  it('should create validated resolver', () => {
    const resolver = createValidatedResolver(
      'age',
      (val) => typeof val === 'number' && val >= 0,
      (val) => val
    );

    expect(resolver({ age: 25 }, {}, {} as any, {} as any)).toBe(25);
    expect(resolver({ age: -1 }, {}, {} as any, {} as any)).toBeNull();
    expect(resolver({ age: 'invalid' }, {}, {} as any, {} as any)).toBeNull();
  });

  it('should compose resolvers', async () => {
    const resolver = composeResolvers(
      () => null,
      () => undefined,
      () => 'found'
    );
    const result = await resolver({}, {}, {} as any, {} as any);
    expect(result).toBe('found');
  });

  it('should chain resolvers', async () => {
    const resolver = chainResolvers(
      (parent: any) => parent + 1,
      (parent: any) => parent * 2
    );
    const result = await resolver(5 as any, {}, {} as any, {} as any);
    expect(result).toBe(12);
  });

  it('should wrap with error handling', async () => {
    const resolver = withErrorHandling(
      () => { throw new Error('error'); },
      'default'
    );
    const result = await resolver({}, {}, {} as any, {} as any);
    expect(result).toBe('default');
  });

  it('should cache resolver results', async () => {
    let callCount = 0;
    const resolver = withCache(
      () => { callCount++; return 'result'; },
      () => 'cache-key'
    );

    await resolver({}, {}, {} as any, {} as any);
    await resolver({}, {}, {} as any, {} as any);
    expect(callCount).toBe(1);
  });
});

describe('createResolvers', () => {
  it('should create all resolvers', () => {
    const domain = createMockDomain() as any;
    const resolvers = createResolvers(domain, 'Test');

    expect(resolvers.Query).toBeDefined();
    expect(resolvers.Mutation).toBeDefined();
    expect(resolvers.Subscription).toBeDefined();
    expect(resolvers.Test).toBeDefined();
  });
});

describe('setupRuntimeSubscriptions', () => {
  it('should setup runtime subscriptions', () => {
    const runtime = createMockRuntime();
    const domain = createMockDomain() as any;
    const pubsub = new SimplePubSub();

    const cleanup = setupRuntimeSubscriptions(runtime, domain, pubsub);
    expect(typeof cleanup).toBe('function');

    cleanup();
  });
});

describe('withFilter and withTransform', () => {
  it('should create filtered subscription', async () => {
    const domain = createMockDomain() as any;
    const pubsub = new SimplePubSub();
    const context = createMockContext(createMockRuntime(), domain, pubsub);

    const baseSubscribe = (_p: any, _a: any, ctx: any) =>
      ctx.pubsub.asyncIterator(['test']);

    const filteredSubscribe = withFilter(
      baseSubscribe as any,
      (payload: any) => payload.type === 'DATA_CHANGED'
    );

    expect(filteredSubscribe).toBeDefined();
  });

  it('should create transformed subscription', () => {
    const baseSub = { subscribe: () => ({} as any) };
    const transformed = withTransform(
      baseSub.subscribe,
      (payload: any) => ({ ...payload, transformed: true })
    );

    expect(transformed.subscribe).toBeDefined();
    expect(transformed.resolve).toBeDefined();
  });
});
