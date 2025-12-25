import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  createRuntime,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import { RuntimeProvider, useRuntimeContext, useRuntime } from '../src/context.js';

function createTestDomain() {
  return defineDomain({
    id: 'test',
    name: 'Test',
    description: 'Test domain',
    dataSchema: z.object({ value: z.number() }),
    stateSchema: z.object({}),
    initialState: {},
    paths: {
      sources: {
        value: defineSource({
          schema: z.number(),
          defaultValue: 0,
          semantic: { type: 'number', description: 'Value' },
        }),
      },
    },
  });
}

// P0-2: wrapper now accepts domain
function createWrapper(runtime: DomainRuntime, domain: ManifestoDomain<unknown, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(RuntimeProvider, { runtime, domain }, children);
  };
}

describe('RuntimeProvider', () => {
  it('should provide runtime context', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { value: 42 } });

    const { result } = renderHook(() => useRuntimeContext(), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.runtime).toBeDefined();
    expect(result.current.runtime.get('data.value')).toBe(42);
  });
});

describe('useRuntimeContext', () => {
  it('should throw when used outside provider', () => {
    expect(() => {
      renderHook(() => useRuntimeContext());
    }).toThrow('useRuntimeContext must be used within a RuntimeProvider');
  });

  it('should return context with runtime', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { value: 100 } });

    const { result } = renderHook(() => useRuntimeContext(), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.runtime).toBe(runtime);
  });
});

describe('useRuntime', () => {
  it('should return runtime directly', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { value: 50 } });

    const { result } = renderHook(() => useRuntime(), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current).toBe(runtime);
  });

  it('should throw when used outside provider', () => {
    expect(() => {
      renderHook(() => useRuntime());
    }).toThrow('useRuntimeContext must be used within a RuntimeProvider');
  });
});
