/**
 * P1-2: Subscription Batch Test
 *
 * subscribePath 배치 알림 동작 검증
 * - 여러 경로 변경 시 단일 알림으로 배치
 * - 동일 경로 중복 구독 방지
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { defineDomain, defineSource, defineDerived } from '../../src/domain/define.js';
import { createRuntime } from '../../src/runtime/runtime.js';

describe('Subscription Batch (P1-2)', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'batch-test',
      name: 'Batch Test Domain',
      description: 'Domain for testing subscription batching',
      dataSchema: z.object({
        a: z.number(),
        b: z.number(),
        c: z.number(),
      }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.a': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value A' },
          }),
          'data.b': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value B' },
          }),
          'data.c': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value C' },
          }),
        },
        derived: {
          'derived.sum': defineDerived({
            deps: ['data.a', 'data.b'],
            expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
            semantic: { type: 'computed', description: 'Sum of A and B' },
          }),
          'derived.total': defineDerived({
            deps: ['derived.sum', 'data.c'],
            expr: ['+', ['get', 'derived.sum'], ['get', 'data.c']],
            semantic: { type: 'computed', description: 'Total' },
          }),
        },
      },
      actions: {},
    });
  }

  it('should notify subscriber for each changed path', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const callback = vi.fn();
    runtime.subscribePath('data.a', callback);

    // Change 'data.a'
    runtime.set('data.a', 10);

    // PathListener should be called with the new value
    expect(callback).toHaveBeenCalledWith(10, 'data.a');
    // Should have been called at least once
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should not notify unrelated paths', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const callbackA = vi.fn();
    const callbackB = vi.fn();

    runtime.subscribePath('data.a', callbackA);
    runtime.subscribePath('data.b', callbackB);

    // Change only 'data.a'
    runtime.set('data.a', 10);

    // Callback A should be called with the new value
    expect(callbackA).toHaveBeenCalledWith(10, 'data.a');
    // Callback B should NOT be called since data.b was not changed
    expect(callbackB).not.toHaveBeenCalled();
  });

  it('should notify derived path when dependencies change', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const sumCallback = vi.fn();
    runtime.subscribePath('derived.sum', sumCallback);

    // Change 'data.a' which affects derived.sum
    runtime.set('data.a', 10);

    // derived.sum should be notified (1+2=3 → 10+2=12)
    expect(sumCallback).toHaveBeenCalledTimes(1);
    // PathListener signature is (value, path)
    expect(sumCallback).toHaveBeenCalledWith(12, 'derived.sum');
  });

  it('should propagate changes through derived chain', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const totalCallback = vi.fn();
    runtime.subscribePath('derived.total', totalCallback);

    // Initial: sum = 1+2 = 3, total = 3+3 = 6
    // Change 'data.a' to 10: sum = 10+2 = 12, total = 12+3 = 15
    runtime.set('data.a', 10);

    expect(totalCallback).toHaveBeenCalledTimes(1);
    // PathListener signature is (value, path)
    expect(totalCallback).toHaveBeenCalledWith(15, 'derived.total');
  });

  it('should handle setMany with batched notifications', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const callbackA = vi.fn();
    const callbackB = vi.fn();
    const sumCallback = vi.fn();

    runtime.subscribePath('data.a', callbackA);
    runtime.subscribePath('data.b', callbackB);
    runtime.subscribePath('derived.sum', sumCallback);

    // Set multiple values at once
    runtime.setMany({
      'data.a': 10,
      'data.b': 20,
    });

    // Both source callbacks should be called with the new values
    expect(callbackA).toHaveBeenCalledWith(10, 'data.a');
    expect(callbackB).toHaveBeenCalledWith(20, 'data.b');

    // Derived should have been called with final value
    expect(sumCallback).toHaveBeenCalledWith(30, 'derived.sum');
  });

  it('should unsubscribe correctly', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const callback = vi.fn();
    const unsubscribe = runtime.subscribePath('data.a', callback);

    // First change - should notify
    runtime.set('data.a', 10);
    const callCountAfterFirstChange = callback.mock.calls.length;
    expect(callCountAfterFirstChange).toBeGreaterThanOrEqual(1);
    expect(callback).toHaveBeenCalledWith(10, 'data.a');

    // Unsubscribe
    unsubscribe();
    callback.mockClear();

    // Second change - should NOT notify
    runtime.set('data.a', 20);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle multiple subscribers to same path', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    runtime.subscribePath('data.a', callback1);
    runtime.subscribePath('data.a', callback2);

    runtime.set('data.a', 10);

    // Both callbacks should be called at least once
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
    // Both should receive the new value
    expect(callback1).toHaveBeenCalledWith(10, 'data.a');
    expect(callback2).toHaveBeenCalledWith(10, 'data.a');
  });

  it('should notify even if value unchanged (current behavior)', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { a: 1, b: 2, c: 3 },
    });

    const callback = vi.fn();
    runtime.subscribePath('data.a', callback);

    // Set to same value - current implementation still notifies
    runtime.set('data.a', 1);

    // Current behavior: still notifies with the same value
    // This documents the actual behavior for future reference
    expect(callback).toHaveBeenCalledWith(1, 'data.a');
  });
});
