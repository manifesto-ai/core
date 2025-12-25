import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  createRuntime,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import { RuntimeProvider } from '../../src/context.js';
import { useValue } from '../../src/hooks/useValue.js';

function createTestDomain() {
  return defineDomain({
    id: 'test',
    name: 'Test',
    description: 'Test domain',
    dataSchema: z.object({ count: z.number(), name: z.string() }),
    stateSchema: z.object({}),
    initialState: {},
    paths: {
      sources: {
        count: defineSource({
          schema: z.number(),
          defaultValue: 0,
          semantic: { type: 'number', description: 'Count' },
        }),
        name: defineSource({
          schema: z.string(),
          defaultValue: '',
          semantic: { type: 'string', description: 'Name' },
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

describe('useValue', () => {
  it('should return current value', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 42, name: 'test' } });

    const { result } = renderHook(() => useValue<number>('data.count'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.value).toBe(42);
    expect(result.current.path).toBe('data.count');
  });

  it('should return string value', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0, name: 'Alice' } });

    const { result } = renderHook(() => useValue<string>('data.name'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.value).toBe('Alice');
  });

  it('should update when value changes', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 10, name: '' } });

    const { result } = renderHook(() => useValue<number>('data.count'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.value).toBe(10);

    act(() => {
      runtime.set('data.count', 20);
    });

    expect(result.current.value).toBe(20);
  });

  it('should handle undefined values', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0, name: '' } });

    const { result } = renderHook(() => useValue('data.nonexistent'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.value).toBeUndefined();
  });
});
