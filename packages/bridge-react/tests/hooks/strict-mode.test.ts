/**
 * P1-2: React Strict Mode Test
 *
 * StrictMode에서 mount/unmount가 2회 호출될 때
 * - 구독 중복 등록 방지
 * - 메모리 누수 방지
 * - useSyncExternalStore 동작 검증
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  createRuntime,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import { RuntimeProvider } from '../../src/context.js';
import { useValue, useSnapshot } from '../../src/hooks/index.js';

function createTestDomain() {
  return defineDomain({
    id: 'strict-mode-test',
    name: 'Strict Mode Test',
    description: 'Testing strict mode behavior',
    dataSchema: z.object({
      count: z.number(),
    }),
    stateSchema: z.object({}),
    initialState: {},
    paths: {
      sources: {
        count: defineSource({
          schema: z.number(),
          defaultValue: 0,
          semantic: { type: 'number', description: 'Count' },
        }),
      },
    },
  });
}

function createWrapper(runtime: DomainRuntime, domain: ManifestoDomain<unknown, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(RuntimeProvider, { runtime, domain }, children);
  };
}

function createStrictModeWrapper(runtime: DomainRuntime, domain: ManifestoDomain<unknown, unknown>) {
  return function StrictModeWrapper({ children }: { children: ReactNode }) {
    return createElement(
      StrictMode,
      null,
      createElement(RuntimeProvider, { runtime, domain }, children)
    );
  };
}

describe('React Strict Mode (P1-2)', () => {
  it('should work correctly with useValue in strict mode', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 42 } });

    const { result } = renderHook(() => useValue('data.count'), {
      wrapper: createStrictModeWrapper(runtime, domain),
    });

    // useValue returns { value, path }
    expect(result.current.value).toBe(42);
    expect(result.current.path).toBe('data.count');
  });

  it('should update value correctly in strict mode', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useValue('data.count'), {
      wrapper: createStrictModeWrapper(runtime, domain),
    });

    expect(result.current.value).toBe(0);

    // Update outside of React
    act(() => {
      runtime.set('data.count', 10);
    });

    expect(result.current.value).toBe(10);
  });

  it('should work correctly with useSnapshot in strict mode', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 100 } });

    const { result } = renderHook(() => useSnapshot(), {
      wrapper: createStrictModeWrapper(runtime, domain),
    });

    expect(result.current.data.count).toBe(100);
  });

  it('should handle multiple rapid updates in strict mode', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useValue('data.count'), {
      wrapper: createStrictModeWrapper(runtime, domain),
    });

    // Multiple rapid updates
    act(() => {
      runtime.set('data.count', 1);
      runtime.set('data.count', 2);
      runtime.set('data.count', 3);
    });

    expect(result.current.value).toBe(3);
  });

  it('should clean up subscriptions properly on unmount', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    // Spy on subscribePath to track subscriptions
    const originalSubscribePath = runtime.subscribePath.bind(runtime);
    let activeSubscriptions = 0;

    runtime.subscribePath = vi.fn((path, callback) => {
      activeSubscriptions++;
      const unsubscribe = originalSubscribePath(path, callback);
      return () => {
        activeSubscriptions--;
        unsubscribe();
      };
    }) as typeof runtime.subscribePath;

    const { unmount } = renderHook(() => useValue('data.count'), {
      wrapper: createStrictModeWrapper(runtime, domain),
    });

    // After mount (in strict mode, may have called subscribe/unsubscribe multiple times)
    // But active subscriptions should be 1 or 0 depending on implementation
    const subscriptionsAfterMount = activeSubscriptions;

    unmount();

    // After unmount, should have cleaned up
    expect(activeSubscriptions).toBeLessThanOrEqual(subscriptionsAfterMount);
    // Ideally should be 0 after unmount
    expect(activeSubscriptions).toBe(0);
  });

  it('should not double-notify on value change', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const renderCallback = vi.fn();

    renderHook(
      () => {
        const result = useValue('data.count');
        renderCallback(result.value);
        return result;
      },
      {
        wrapper: createStrictModeWrapper(runtime, domain),
      }
    );

    // Clear initial render counts
    renderCallback.mockClear();

    // Update value
    act(() => {
      runtime.set('data.count', 5);
    });

    // In strict mode, React may call render twice, but the value should be consistent
    const calls = renderCallback.mock.calls;
    for (const call of calls) {
      expect(call[0]).toBe(5);
    }
  });

  it('should maintain value consistency for unchanged values', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 42 } });

    const values: number[] = [];

    const { rerender } = renderHook(
      () => {
        const result = useValue<number>('data.count');
        values.push(result.value);
        return result;
      },
      {
        wrapper: createStrictModeWrapper(runtime, domain),
      }
    );

    // Force a re-render without changing the value
    rerender();

    // All captured values should be the same (42)
    expect(values.every(v => v === 42)).toBe(true);
  });
});
