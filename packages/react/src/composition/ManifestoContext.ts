/**
 * ManifestoContext
 *
 * Manifesto 렌더링 컨텍스트 정의
 * Engine, Registry, Dispatch 등을 전역으로 제공합니다.
 */

import { createContext, useContext } from 'react'
import type {
  IViewSnapshotEngine,
  PageSnapshot,
  ViewIntent,
} from '@manifesto-ai/view-snapshot'
import type { RendererRegistry } from '../types/renderer'
import type { PrimitiveSet } from '../types/primitives'

// ============================================================================
// Context Types
// ============================================================================

/**
 * Manifesto Context Value
 */
export interface ManifestoContextValue {
  /** ViewSnapshot 엔진 */
  engine: IViewSnapshotEngine
  /** 현재 페이지 스냅샷 */
  snapshot: PageSnapshot
  /** 렌더러 레지스트리 */
  registry: RendererRegistry
  /** Primitive 컴포넌트 세트 (registry.primitives의 별칭) */
  primitives: PrimitiveSet
  /** Intent 디스패치 함수 */
  dispatch: (intent: ViewIntent) => Promise<PageSnapshot>
}

// ============================================================================
// Context Definition
// ============================================================================

/**
 * ManifestoContext
 *
 * ManifestoProvider 내에서만 사용 가능합니다.
 */
export const ManifestoContext = createContext<ManifestoContextValue | null>(null)

ManifestoContext.displayName = 'ManifestoContext'

// ============================================================================
// Hook
// ============================================================================

/**
 * useManifestoContext
 *
 * ManifestoContext를 가져옵니다.
 * ManifestoProvider 내에서만 사용해야 합니다.
 *
 * @throws {Error} ManifestoProvider 외부에서 사용 시
 *
 * @example
 * ```typescript
 * const { engine, snapshot, dispatch } = useManifestoContext()
 * ```
 */
export const useManifestoContext = (): ManifestoContextValue => {
  const context = useContext(ManifestoContext)

  if (!context) {
    throw new Error(
      'useManifestoContext must be used within a ManifestoProvider. ' +
      'Wrap your component tree with <ManifestoProvider>.'
    )
  }

  return context
}

// ============================================================================
// Selective Hooks
// ============================================================================

/**
 * useSnapshot
 *
 * 현재 PageSnapshot을 가져옵니다.
 */
export const useSnapshot = (): PageSnapshot => {
  const { snapshot } = useManifestoContext()
  return snapshot
}

/**
 * useEngine
 *
 * ViewSnapshotEngine을 가져옵니다.
 */
export const useEngine = (): IViewSnapshotEngine => {
  const { engine } = useManifestoContext()
  return engine
}

/**
 * useDispatch
 *
 * Intent dispatch 함수를 가져옵니다.
 */
export const useDispatch = (): ((intent: ViewIntent) => Promise<PageSnapshot>) => {
  const { dispatch } = useManifestoContext()
  return dispatch
}

/**
 * usePrimitives
 *
 * PrimitiveSet을 가져옵니다.
 */
export const usePrimitives = (): PrimitiveSet => {
  const { primitives } = useManifestoContext()
  return primitives
}

/**
 * useRegistry
 *
 * RendererRegistry를 가져옵니다.
 */
export const useRegistry = (): RendererRegistry => {
  const { registry } = useManifestoContext()
  return registry
}
