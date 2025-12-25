import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  fieldPolicy,
  condition,
  createRuntime,
  type DomainRuntime,
  type ManifestoDomain,
} from '@manifesto-ai/core';
import { RuntimeProvider } from '../../src/context.js';
import { useFieldPolicy } from '../../src/hooks/useFieldPolicy.js';

function createTestDomain() {
  return defineDomain({
    id: 'test',
    name: 'Test',
    description: 'Test domain',
    dataSchema: z.object({
      showDiscount: z.boolean(),
      discountCode: z.string(),
    }),
    stateSchema: z.object({}),
    initialState: {},
    paths: {
      sources: {
        showDiscount: defineSource({
          schema: z.boolean(),
          defaultValue: false,
          semantic: { type: 'boolean', description: 'Show discount' },
        }),
        discountCode: defineSource({
          schema: z.string(),
          defaultValue: '',
          policy: fieldPolicy({
            relevantWhen: [condition('data.showDiscount', { expect: 'true', reason: 'Discount must be enabled' })],
          }),
          semantic: { type: 'string', description: 'Discount code' },
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

describe('useFieldPolicy', () => {
  it('should return default policy for field without policy', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { showDiscount: false, discountCode: '' },
    });

    const { result } = renderHook(() => useFieldPolicy('data.showDiscount'), {
      wrapper: createWrapper(runtime, domain),
    });

    expect(result.current.relevant).toBe(true);
    expect(result.current.editable).toBe(true);
    expect(result.current.required).toBe(false);
  });

  it('should return resolved policy', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { showDiscount: false, discountCode: '' },
    });

    const { result } = renderHook(() => useFieldPolicy('data.discountCode'), {
      wrapper: createWrapper(runtime, domain),
    });

    // When showDiscount is false, discountCode is not relevant
    expect(result.current.relevant).toBe(false);
    expect(result.current.relevantReason).toBe('Discount must be enabled');
  });

  it('should update when conditions change', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { showDiscount: true, discountCode: '' },
    });

    const { result } = renderHook(() => useFieldPolicy('data.discountCode'), {
      wrapper: createWrapper(runtime, domain),
    });

    // When showDiscount is true, discountCode is relevant
    expect(result.current.relevant).toBe(true);
  });
});
