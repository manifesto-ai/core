/**
 * RuntimeProvider - React Context for Manifesto Runtime
 */

import { createContext, useContext, createElement, type ReactNode } from 'react';
import type { DomainRuntime, ManifestoDomain } from '@manifesto-ai/core';
import type { RuntimeContextValue, DomainContextValue } from './types.js';

/**
 * RuntimeContext
 */
const RuntimeContext = createContext<RuntimeContextValue | null>(null);

/**
 * DomainContext - P0-2: 도메인 정의에 접근하기 위한 컨텍스트
 */
const DomainContext = createContext<DomainContextValue | null>(null);

/**
 * RuntimeProvider props
 */
export type RuntimeProviderProps<TData = unknown, TState = unknown> = {
  /** The domain runtime instance */
  runtime: DomainRuntime<TData, TState>;
  /** The domain definition - P0-2: 훅 최적화를 위해 필요 */
  domain: ManifestoDomain<TData, TState>;
  /** Children */
  children: ReactNode;
};

/**
 * RuntimeProvider - Provides runtime and domain context to children
 *
 * P0-2: domain prop 추가 - 훅에서 정책 의존성을 추출하여 선택적 구독이 가능하게 함
 *
 * @throws Warning in development if domain.id doesn't match runtime's domain ID
 */
export function RuntimeProvider<TData = unknown, TState = unknown>({
  runtime,
  domain,
  children,
}: RuntimeProviderProps<TData, TState>): ReactNode {
  // P0-2: Dev mode mismatch detection
  if (process.env.NODE_ENV !== 'production') {
    const runtimeDomainId = runtime.getDomainId();
    if (runtimeDomainId !== domain.id) {
      console.warn(
        `[manifesto] RuntimeProvider domain/runtime mismatch detected!\n` +
        `  - runtime.getDomainId(): "${runtimeDomainId}"\n` +
        `  - domain.id: "${domain.id}"\n` +
        `This may cause unexpected behavior. Ensure the same domain is used for both createRuntime() and RuntimeProvider.`
      );
    }
  }

  return createElement(
    RuntimeContext.Provider,
    { value: { runtime } },
    createElement(DomainContext.Provider, { value: { domain } }, children)
  );
}

/**
 * useRuntimeContext - Access the runtime from context
 *
 * @throws Error if used outside RuntimeProvider
 */
export function useRuntimeContext<
  TData = unknown,
  TState = unknown,
>(): RuntimeContextValue<TData, TState> {
  const context = useContext(RuntimeContext);
  if (!context) {
    throw new Error('useRuntimeContext must be used within a RuntimeProvider');
  }
  return context as RuntimeContextValue<TData, TState>;
}

/**
 * useRuntime - Convenience hook to get runtime directly
 */
export function useRuntime<TData = unknown, TState = unknown>(): DomainRuntime<TData, TState> {
  return useRuntimeContext<TData, TState>().runtime;
}

/**
 * useDomainContext - Access the domain from context
 *
 * P0-2: 도메인 정의에 접근하여 정책 의존성을 추출할 수 있게 함
 *
 * @throws Error if used outside RuntimeProvider
 */
export function useDomainContext<
  TData = unknown,
  TState = unknown,
>(): DomainContextValue<TData, TState> {
  const context = useContext(DomainContext);
  if (!context) {
    throw new Error('useDomainContext must be used within a RuntimeProvider');
  }
  return context as DomainContextValue<TData, TState>;
}

/**
 * useDomain - Convenience hook to get domain directly
 *
 * P0-2: 훅에서 정책 의존성을 추출하는 데 사용
 */
export function useDomain<TData = unknown, TState = unknown>(): ManifestoDomain<TData, TState> {
  return useDomainContext<TData, TState>().domain;
}
