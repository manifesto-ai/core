/**
 * Tests for BridgeProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { z } from 'zod';
import {
  BridgeProvider,
  useBridgeContext,
  useBridge,
  useBridgeRuntime,
  useBridgeDomain,
} from '../../src/provider.js';
import { createBridge } from '../../src/bridge.js';
import { createReactAdapter } from '../../src/adapter.js';
import { createReactActuator } from '../../src/actuator.js';
import {
  defineDomain,
  defineSource,
  createRuntime,
} from '@manifesto-ai/core';

// Test domain
function createTestDomain() {
  return defineDomain({
    id: 'test-provider-domain',
    name: 'Test Provider',
    description: 'Test domain for provider',
    dataSchema: z.object({
      value: z.number(),
    }),
    stateSchema: z.object({
      active: z.boolean(),
    }),
    initialState: { active: true },
    paths: {
      sources: {
        value: defineSource({
          schema: z.number(),
          defaultValue: 42,
          semantic: { type: 'number', description: 'Value' },
        }),
      },
    },
  });
}

describe('BridgeProvider', () => {
  let domain: ReturnType<typeof createTestDomain>;
  let runtime: ReturnType<typeof createRuntime>;
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    domain = createTestDomain();
    runtime = createRuntime({
      domain,
      initialData: { value: 42 },
    });

    const adapter = createReactAdapter({
      getData: () => ({ value: 42 }),
      getState: () => ({ active: true }),
    });

    const actuator = createReactActuator({
      setData: vi.fn(),
    });

    bridge = createBridge({
      runtime,
      adapter,
      actuator,
    });
  });

  afterEach(() => {
    bridge.dispose();
  });

  function createWrapper(br: typeof bridge, dom: typeof domain) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return createElement(BridgeProvider, { bridge: br, domain: dom }, children);
    };
  }

  describe('useBridgeContext', () => {
    it('should provide bridge context', () => {
      const { result } = renderHook(() => useBridgeContext(), {
        wrapper: createWrapper(bridge, domain),
      });

      expect(result.current.bridge).toBe(bridge);
      expect(result.current.runtime).toBe(runtime);
      expect(result.current.domain).toBe(domain);
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useBridgeContext());
      }).toThrow('useBridgeContext must be used within a BridgeProvider');
    });
  });

  describe('useBridge', () => {
    it('should return bridge instance', () => {
      const { result } = renderHook(() => useBridge(), {
        wrapper: createWrapper(bridge, domain),
      });

      expect(result.current).toBe(bridge);
    });
  });

  describe('useBridgeRuntime', () => {
    it('should return runtime instance', () => {
      const { result } = renderHook(() => useBridgeRuntime(), {
        wrapper: createWrapper(bridge, domain),
      });

      expect(result.current).toBe(runtime);
    });
  });

  describe('useBridgeDomain', () => {
    it('should return domain instance', () => {
      const { result } = renderHook(() => useBridgeDomain(), {
        wrapper: createWrapper(bridge, domain),
      });

      expect(result.current).toBe(domain);
    });
  });

  describe('domain mismatch warning', () => {
    it('should warn in dev mode when domain IDs mismatch', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a different domain
      const differentDomain = defineDomain({
        id: 'different-domain',
        name: 'Different',
        description: 'Different domain',
        dataSchema: z.object({ value: z.number() }),
        stateSchema: z.object({ active: z.boolean() }),
        initialState: { active: true },
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

      renderHook(() => useBridgeContext(), {
        wrapper: createWrapper(bridge, differentDomain),
      });

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('BridgeProvider domain/runtime mismatch')
      );

      consoleWarn.mockRestore();
    });
  });
});
