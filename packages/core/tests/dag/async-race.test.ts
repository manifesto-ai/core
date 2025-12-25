/**
 * P1-2: Async Race Condition Test
 *
 * 비동기 요청이 순서대로 도착하지 않을 때,
 * 오래된 응답이 최신 상태를 덮어쓰지 않도록 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { defineDomain, defineSource, defineDerived } from '../../src/domain/define.js';
import { createRuntime } from '../../src/runtime/runtime.js';

describe('Async Race Condition (P1-2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createSearchDomain() {
    return defineDomain({
      id: 'search-domain',
      name: 'Search Domain',
      description: 'Domain for testing async race conditions',
      dataSchema: z.object({
        query: z.string(),
      }),
      stateSchema: z.object({
        results: z.array(z.string()).optional(),
        requestId: z.number().optional(),
      }),
      initialState: {
        results: [],
        requestId: 0,
      },
      paths: {
        sources: {
          'data.query': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'Search query' },
          }),
        },
        derived: {
          'derived.hasResults': defineDerived({
            deps: ['state.results'],
            expr: ['>', ['length', ['coalesce', ['get', 'state.results'], []]], 0],
            semantic: { type: 'condition', description: 'Has search results' },
          }),
        },
      },
      actions: {},
    });
  }

  it('should handle request tracking with requestId pattern', () => {
    const domain = createSearchDomain();
    const runtime = createRuntime({
      domain,
      initialData: { query: '' },
    });

    // Simulate first request
    const firstRequestId = 1;
    runtime.set('state.requestId', firstRequestId);

    // Simulate second request (user types faster)
    const secondRequestId = 2;
    runtime.set('state.requestId', secondRequestId);

    // Second request completes first (fast response)
    const secondResults = ['result2a', 'result2b'];
    const currentRequestId = runtime.get('state.requestId');

    if (currentRequestId === secondRequestId) {
      runtime.set('state.results', secondResults);
    }

    expect(runtime.get('state.results')).toEqual(secondResults);

    // First request completes later (slow response) - should be ignored
    const firstResults = ['result1a'];
    const stillCurrentRequestId = runtime.get('state.requestId');

    if (stillCurrentRequestId === firstRequestId) {
      // This should NOT execute because requestId is 2, not 1
      runtime.set('state.results', firstResults);
    }

    // State should still have second results (not overwritten by stale first response)
    expect(runtime.get('state.results')).toEqual(secondResults);
  });

  it('should maintain state consistency during async updates', () => {
    const domain = createSearchDomain();
    const runtime = createRuntime({
      domain,
      initialData: { query: '' },
    });

    // Initial state: empty results
    expect(runtime.get('state.results')).toEqual([]);

    // Set results
    runtime.set('state.results', ['item1', 'item2']);

    // State should update
    expect(runtime.get('state.results')).toEqual(['item1', 'item2']);

    // Clear results
    runtime.set('state.results', []);

    // State should update again
    expect(runtime.get('state.results')).toEqual([]);

    // Verify requestId tracking works independently
    runtime.set('state.requestId', 5);
    expect(runtime.get('state.requestId')).toBe(5);
  });

  it('should track multiple concurrent async operations independently', () => {
    const domain = defineDomain({
      id: 'multi-async',
      name: 'Multi Async',
      description: 'Multiple async operations',
      dataSchema: z.object({
        userId: z.string(),
        productId: z.string(),
      }),
      stateSchema: z.object({
        userRequestId: z.number().optional(),
        productRequestId: z.number().optional(),
        userData: z.unknown().optional(),
        productData: z.unknown().optional(),
      }),
      initialState: {
        userRequestId: 0,
        productRequestId: 0,
        userData: null,
        productData: null,
      },
      paths: {
        sources: {
          'data.userId': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'User ID' },
          }),
          'data.productId': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'Product ID' },
          }),
        },
        derived: {},
      },
      actions: {},
    });

    const runtime = createRuntime({
      domain,
      initialData: { userId: 'user1', productId: 'product1' },
    });

    // Start user fetch (request 1)
    runtime.set('state.userRequestId', 1);

    // Start product fetch (request 1)
    runtime.set('state.productRequestId', 1);

    // User changes, new user fetch (request 2)
    runtime.set('state.userRequestId', 2);

    // Product fetch completes (should update)
    if (runtime.get('state.productRequestId') === 1) {
      runtime.set('state.productData', { id: 'product1', name: 'Product' });
    }
    expect(runtime.get('state.productData')).toEqual({ id: 'product1', name: 'Product' });

    // Old user fetch completes (should be ignored)
    if (runtime.get('state.userRequestId') === 1) {
      runtime.set('state.userData', { id: 'user1', name: 'Old User' });
    }
    expect(runtime.get('state.userData')).toBeNull();

    // New user fetch completes (should update)
    if (runtime.get('state.userRequestId') === 2) {
      runtime.set('state.userData', { id: 'user2', name: 'New User' });
    }
    expect(runtime.get('state.userData')).toEqual({ id: 'user2', name: 'New User' });
  });
});
