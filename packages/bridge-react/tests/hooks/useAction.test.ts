import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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
import { useAction } from '../../src/hooks/useAction.js';

function createTestDomain() {
  return defineDomain({
    id: 'test',
    name: 'Test',
    description: 'Test domain',
    dataSchema: z.object({ count: z.number() }),
    stateSchema: z.object({ submitted: z.boolean() }),
    initialState: { submitted: false },
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
      },
    },
    actions: {
      increment: defineAction({
        deps: ['data.count'],
        effect: setValue('data.count', 1),
        semantic: { type: 'action', description: 'Increment', risk: 'low' },
      }),
      submit: defineAction({
        deps: ['data.count'],
        effect: setValue('state.submitted', true),
        preconditions: [
          condition('derived.isPositive', { expect: 'true', reason: 'Count must be positive' }),
        ],
        semantic: { type: 'action', description: 'Submit', risk: 'medium' },
      }),
    },
  });
}

function createWrapper(runtime: DomainRuntime, domain: ManifestoDomain<unknown, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(RuntimeProvider, { runtime, domain }, children);
  };
}

describe('useAction', () => {
  it('should return action state', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 5 } });

    const { result } = renderHook(() => useAction('increment'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isExecuting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isAvailable).toBe(true);
  });

  it('should execute action', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 5 } });

    const { result } = renderHook(() => useAction('submit'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(runtime.get('state.submitted')).toBe(false);

    await act(async () => {
      await result.current.execute();
    });

    expect(runtime.get('state.submitted')).toBe(true);
  });

  it('should track executing state', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 5 } });

    const { result } = renderHook(() => useAction('submit'), {
      wrapper: createWrapper(runtime, domain),
    });

    let wasExecuting = false;

    await act(async () => {
      const promise = result.current.execute();
      // Check if isExecuting was set during execution
      wasExecuting = result.current.isExecuting;
      await promise;
    });

    // After execution, should not be executing
    expect(result.current.isExecuting).toBe(false);
  });

  it('should show action unavailable when preconditions not met', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useAction('submit'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.preconditions.length).toBe(1);
    expect(result.current.preconditions[0]?.satisfied).toBe(false);
  });

  it('should track error on failure', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useAction('submit'), {
      wrapper: createWrapper(runtime, domain),
    });

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).not.toBeNull();
  });

  it('should clear error', async () => {
    const domain = createTestDomain();
    const runtime = createRuntime({ domain, initialData: { count: 0 } });

    const { result } = renderHook(() => useAction('submit'), {
      wrapper: createWrapper(runtime, domain),
    });

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
