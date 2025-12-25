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
import { useSetValue } from '../../src/hooks/useSetValue.js';
import { useValue } from '../../src/hooks/useValue.js';

function createTestDomain() {
  return defineDomain({
    id: 'test',
    name: 'Test',
    description: 'Test domain',
    dataSchema: z.object({ count: z.number() }),
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

describe('useSetValue', () => {
  it('should set a value', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useSetValue(), {
      wrapper: createWrapper(runtime, domain),
    });

    act(() => {
      result.current.setValue('data.count', 42);
    });

    expect(runtime.get('data.count')).toBe(42);
  });

  it('should set multiple values', () => {
    const domain = defineDomain({
      id: 'test',
      name: 'Test',
      description: 'Test',
      dataSchema: z.object({ a: z.number(), b: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          a: defineSource({
            schema: z.number(),
            defaultValue: 0,
            semantic: { type: 'number', description: 'A' },
          }),
          b: defineSource({
            schema: z.number(),
            defaultValue: 0,
            semantic: { type: 'number', description: 'B' },
          }),
        },
      },
    });
    const runtime = createRuntime({ domain, initialData: { a: 0, b: 0 } });

    const { result } = renderHook(() => useSetValue(), {
      wrapper: createWrapper(runtime, domain),
    });

    act(() => {
      result.current.setValues({ 'data.a': 10, 'data.b': 20 });
    });

    expect(runtime.get('data.a')).toBe(10);
    expect(runtime.get('data.b')).toBe(20);
  });

  it('should track validation errors', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useSetValue(), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.error).toBeNull();

    act(() => {
      // Try to set invalid value (string instead of number)
      result.current.setValue('data.count', 'invalid' as unknown as number);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?._tag).toBe('ValidationError');
  });

  it('should clear error', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useSetValue(), {
      wrapper: createWrapper(runtime, domain),
    });

    act(() => {
      result.current.setValue('data.count', 'invalid' as unknown as number);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should clear error on successful set', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useSetValue(), {
      wrapper: createWrapper(runtime, domain),
    });

    act(() => {
      result.current.setValue('data.count', 'invalid' as unknown as number);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.setValue('data.count', 50);
    });

    expect(result.current.error).toBeNull();
  });
});
