import { describe, it, expect, beforeEach } from 'vitest';

import {
  createGraphQLContext,
  createContextFactory,
  getRuntimeFromContext,
  getDomainFromContext,
  getPubSubFromContext,
  isAuthenticated,
  getUserFromContext,
  SimplePubSub,
  getDomainChangeTrigger,
  getFieldChangeTrigger,
  getActionTrigger,
  isValidRequestId,
} from '../../src/context/graphql-context.js';

// Mock runtime
const createMockRuntime = () => ({
  get: (path: string) => `value for ${path}`,
  set: (path: string, value: unknown) => {},
  getSnapshot: () => ({ data: {}, state: {} }),
  subscribe: (callback: (snapshot: any) => void) => () => {},
});

// Mock domain
const createMockDomain = () => ({
  id: 'test-domain',
  name: 'Test Domain',
  dataSchema: null,
  stateSchema: null,
  paths: {},
  actions: {},
});

describe('GraphQL Context', () => {
  describe('createGraphQLContext', () => {
    it('should create context with runtime and domain', () => {
      const runtime = createMockRuntime();
      const domain = createMockDomain();
      const context = createGraphQLContext(runtime as any, domain as any);

      expect(context.runtime).toBe(runtime);
      expect(context.domain).toBe(domain);
      expect(context.requestId).toBeDefined();
    });

    it('should include requestId', () => {
      const context = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any
      );

      expect(typeof context.requestId).toBe('string');
      expect(context.requestId.length).toBeGreaterThan(0);
    });

    it('should include user when provided', () => {
      const user = { id: 'user-1', name: 'Test User' };
      const context = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any,
        { user }
      );

      expect(context.user).toBe(user);
    });

    it('should include pubsub when provided', () => {
      const pubsub = new SimplePubSub();
      const context = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any,
        { pubsub }
      );

      expect(context.pubsub).toBe(pubsub);
    });

    it('should include extras', () => {
      const context = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any,
        { extras: { customKey: 'customValue' } }
      );

      expect(context.customKey).toBe('customValue');
    });
  });

  describe('createContextFactory', () => {
    it('should create a context factory', () => {
      const runtime = createMockRuntime();
      const domain = createMockDomain();
      const factory = createContextFactory(runtime as any, domain as any);

      const context = factory();
      expect(context.runtime).toBe(runtime);
      expect(context.domain).toBe(domain);
    });

    it('should merge base and request options', () => {
      const pubsub = new SimplePubSub();
      const factory = createContextFactory(
        createMockRuntime() as any,
        createMockDomain() as any,
        { pubsub }
      );

      const user = { id: 'user-1' };
      const context = factory({ user });

      expect(context.pubsub).toBe(pubsub);
      expect(context.user).toBe(user);
    });
  });

  describe('Context Utilities', () => {
    it('should get runtime from context', () => {
      const runtime = createMockRuntime();
      const context = createGraphQLContext(runtime as any, createMockDomain() as any);

      expect(getRuntimeFromContext(context)).toBe(runtime);
    });

    it('should get domain from context', () => {
      const domain = createMockDomain();
      const context = createGraphQLContext(createMockRuntime() as any, domain as any);

      expect(getDomainFromContext(context)).toBe(domain);
    });

    it('should get pubsub from context', () => {
      const pubsub = new SimplePubSub();
      const context = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any,
        { pubsub }
      );

      expect(getPubSubFromContext(context)).toBe(pubsub);
    });

    it('should check authentication', () => {
      const unauthContext = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any
      );
      expect(isAuthenticated(unauthContext)).toBe(false);

      const authContext = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any,
        { user: { id: 'user-1' } }
      );
      expect(isAuthenticated(authContext)).toBe(true);
    });

    it('should get user from context', () => {
      const user = { id: 'user-1', name: 'Test' };
      const context = createGraphQLContext(
        createMockRuntime() as any,
        createMockDomain() as any,
        { user }
      );

      expect(getUserFromContext(context)).toBe(user);
    });
  });

  describe('Trigger Names', () => {
    it('should generate domain change trigger', () => {
      const trigger = getDomainChangeTrigger('order');
      expect(trigger).toBe('order:changed');
    });

    it('should generate field change trigger', () => {
      const trigger = getFieldChangeTrigger('order', 'data.status');
      expect(trigger).toBe('order:field:data.status');
    });

    it('should generate action trigger', () => {
      const trigger = getActionTrigger('order', 'confirm');
      expect(trigger).toBe('order:action:confirm');
    });
  });

  describe('Request ID Validation', () => {
    it('should validate valid request IDs', () => {
      expect(isValidRequestId('abc123-xyz789')).toBe(true);
      expect(isValidRequestId('m1234-abcd')).toBe(true);
    });

    it('should reject invalid request IDs', () => {
      expect(isValidRequestId('invalid')).toBe(false);
      expect(isValidRequestId('')).toBe(false);
      expect(isValidRequestId('too-many-parts-here')).toBe(false);
    });
  });
});

describe('SimplePubSub', () => {
  let pubsub: SimplePubSub;

  beforeEach(() => {
    pubsub = new SimplePubSub();
  });

  it('should publish and receive messages', async () => {
    const messages: unknown[] = [];

    await pubsub.subscribe('test-event', (msg) => {
      messages.push(msg);
    });

    await pubsub.publish('test-event', { data: 'hello' });
    await pubsub.publish('test-event', { data: 'world' });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ data: 'hello' });
    expect(messages[1]).toEqual({ data: 'world' });
  });

  it('should support multiple subscribers', async () => {
    const messages1: unknown[] = [];
    const messages2: unknown[] = [];

    await pubsub.subscribe('test-event', (msg) => {
      messages1.push(msg);
    });
    await pubsub.subscribe('test-event', (msg) => {
      messages2.push(msg);
    });

    await pubsub.publish('test-event', { data: 'test' });

    expect(messages1).toHaveLength(1);
    expect(messages2).toHaveLength(1);
  });

  it('should unsubscribe correctly', async () => {
    const messages: unknown[] = [];

    const subId = await pubsub.subscribe('test-event', (msg) => {
      messages.push(msg);
    });

    await pubsub.publish('test-event', { data: 'before' });
    pubsub.unsubscribe(subId);
    await pubsub.publish('test-event', { data: 'after' });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ data: 'before' });
  });

  it('should create async iterator', async () => {
    const iterator = pubsub.asyncIterator<{ data: string }>(['test-event']);

    // Publish after a small delay
    setTimeout(async () => {
      await pubsub.publish('test-event', { data: 'async-message' });
    }, 10);

    const result = await iterator.next();
    expect(result.done).toBe(false);
    expect(result.value).toEqual({ data: 'async-message' });

    // Clean up
    await iterator.return?.();
  });

  it('should clear all subscriptions', async () => {
    const messages: unknown[] = [];

    await pubsub.subscribe('test-event', (msg) => {
      messages.push(msg);
    });

    pubsub.clear();
    await pubsub.publish('test-event', { data: 'cleared' });

    expect(messages).toHaveLength(0);
  });
});
