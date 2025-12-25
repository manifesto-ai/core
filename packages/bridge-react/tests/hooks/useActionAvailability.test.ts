import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAction,
  condition,
  createRuntime,
  setValue,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import { RuntimeProvider } from '../../src/context.js';
import { useActionAvailability } from '../../src/hooks/useActionAvailability.js';

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
      derived: {
        isPositive: defineDerived({
          deps: ['data.count'],
          expr: ['>', ['get', 'data.count'], 0],
          semantic: { type: 'boolean', description: 'Is positive' },
        }),
        isLarge: defineDerived({
          deps: ['data.count'],
          expr: ['>', ['get', 'data.count'], 100],
          semantic: { type: 'boolean', description: 'Is large' },
        }),
      },
    },
    actions: {
      simpleAction: defineAction({
        deps: ['data.count'],
        effect: setValue('data.count', 0),
        semantic: { type: 'action', description: 'Simple', risk: 'low' },
      }),
      guardedAction: defineAction({
        deps: ['data.count'],
        effect: setValue('data.count', 0),
        preconditions: [
          condition('derived.isPositive', { expect: 'true', reason: 'Count must be positive' }),
        ],
        semantic: { type: 'action', description: 'Guarded', risk: 'medium' },
      }),
      multiGuardAction: defineAction({
        deps: ['data.count'],
        effect: setValue('data.count', 0),
        preconditions: [
          condition('derived.isPositive', { expect: 'true', reason: 'Count must be positive' }),
          condition('derived.isLarge', { expect: 'true', reason: 'Count must be large' }),
        ],
        semantic: { type: 'action', description: 'Multi-guard', risk: 'high' },
      }),
    },
  });
}

// P0-2: wrapper now accepts domain
function createWrapper(runtime: DomainRuntime, domain: ManifestoDomain<unknown, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(RuntimeProvider, { runtime, domain }, children);
  };
}

describe('useActionAvailability', () => {
  it('should show action available when no preconditions', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useActionAvailability('simpleAction'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.preconditions.length).toBe(0);
    expect(result.current.blockedReasons.length).toBe(0);
  });

  it('should show action available when preconditions met', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 10 } });

    const { result } = renderHook(() => useActionAvailability('guardedAction'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.preconditions.length).toBe(1);
    expect(result.current.preconditions[0]?.satisfied).toBe(true);
    expect(result.current.blockedReasons.length).toBe(0);
  });

  it('should show action blocked with reasons', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useActionAvailability('guardedAction'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.blockedReasons.length).toBe(1);
    expect(result.current.blockedReasons[0]?.path).toBe('derived.isPositive');
    expect(result.current.blockedReasons[0]?.reason).toBe('Count must be positive');
  });

  it('should show multiple blocked reasons', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useActionAvailability('multiGuardAction'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.blockedReasons.length).toBe(2);
  });

  it('should show partial blocked reasons', () => {
    const domain = createTestDomain();
    // count=50 satisfies isPositive but not isLarge
    const runtime = createRuntime({ domain, initialData: { count: 50 } });

    const { result } = renderHook(() => useActionAvailability('multiGuardAction'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.blockedReasons.length).toBe(1);
    expect(result.current.blockedReasons[0]?.path).toBe('derived.isLarge');
  });

  it('should show all preconditions satisfied', () => {
    const domain = createTestDomain();
    // count=150 satisfies both isPositive and isLarge
    const runtime = createRuntime({ domain, initialData: { count: 150 } });

    const { result } = renderHook(() => useActionAvailability('multiGuardAction'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.preconditions.length).toBe(2);
    expect(result.current.preconditions.every((p) => p.satisfied)).toBe(true);
    expect(result.current.blockedReasons.length).toBe(0);
  });
});
