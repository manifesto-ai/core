/**
 * ManifestoProvider
 *
 * Manifesto 렌더링 시스템의 최상위 Provider
 *
 * 책임:
 * - ViewSnapshotEngine 연결
 * - 스냅샷 변경 구독 및 React 상태 동기화
 * - RendererRegistry 제공
 * - Context를 통한 하위 컴포넌트 전파
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { IViewSnapshotEngine, PageSnapshot, ViewIntent, FormSnapshot } from '@manifesto-ai/view-snapshot'
import type { RendererRegistry } from '../types/renderer'
import type { PrimitiveSet } from '../types/primitives'
import { ManifestoContext, type ManifestoContextValue } from './ManifestoContext'
import { createDefaultPrimitiveSet } from '../primitives'
import { createDefaultRendererRegistry } from '../renderers'

// ============================================================================
// Provider Props
// ============================================================================

export interface ManifestoProviderProps {
  /** ViewSnapshot 엔진 */
  engine: IViewSnapshotEngine
  /** 커스텀 Primitive 컴포넌트 세트 (선택적) */
  primitives?: PrimitiveSet
  /** 커스텀 렌더러 레지스트리 (선택적) */
  registry?: RendererRegistry
  /** 자식 컴포넌트 */
  children: React.ReactNode
}

// ============================================================================
// ManifestoProvider Component
// ============================================================================

/**
 * ManifestoProvider
 *
 * Manifesto 렌더링 시스템의 최상위 Provider입니다.
 * ViewSnapshotEngine을 연결하고, 스냅샷 변경을 구독합니다.
 *
 * @example
 * ```tsx
 * const engine = createViewSnapshotEngine({ pageId: 'orders' })
 *
 * function App() {
 *   return (
 *     <ManifestoProvider engine={engine}>
 *       <PageRenderer />
 *     </ManifestoProvider>
 *   )
 * }
 * ```
 */
export const ManifestoProvider: React.FC<ManifestoProviderProps> = ({
  engine,
  primitives: customPrimitives,
  registry: customRegistry,
  children,
}) => {
  // ========================================================================
  // State
  // ========================================================================

  const [snapshot, setSnapshot] = useState<PageSnapshot>(() => engine.getViewSnapshot())

  // ========================================================================
  // Registry & Primitives
  // ========================================================================

  const primitives = useMemo(() => {
    return customPrimitives ?? createDefaultPrimitiveSet()
  }, [customPrimitives])

  const registry = useMemo(() => {
    if (customRegistry) return customRegistry
    return createDefaultRendererRegistry(primitives)
  }, [customRegistry, primitives])

  // ========================================================================
  // Engine Subscription
  // ========================================================================

  useEffect(() => {
    // 초기 스냅샷 동기화
    const initialSnapshot = engine.getViewSnapshot()
    console.log('[ManifestoProvider] Initial snapshot', initialSnapshot.children.length, 'children')
    setSnapshot(initialSnapshot)

    // 스냅샷 변경 구독
    const unsubscribe = engine.subscribe((newSnapshot) => {
      console.log('[ManifestoProvider] Snapshot updated', newSnapshot.children.map(c => {
        if (c.kind === 'form') {
          const formNode = c as FormSnapshot
          return { kind: c.kind, nodeId: c.nodeId, fields: formNode.fields.map(f => ({ id: f.id, value: f.value })) }
        }
        return { kind: c.kind, nodeId: c.nodeId }
      }))
      setSnapshot(newSnapshot)
    })

    return () => {
      unsubscribe()
    }
  }, [engine])

  // ========================================================================
  // Dispatch
  // ========================================================================

  /**
   * Intent를 Engine에 디스패치
   */
  const dispatch = useCallback(
    async (intent: ViewIntent): Promise<PageSnapshot> => {
      return engine.dispatchIntent(intent)
    },
    [engine]
  )

  // ========================================================================
  // Context Value
  // ========================================================================

  const contextValue = useMemo<ManifestoContextValue>(
    () => ({
      engine,
      snapshot,
      registry,
      primitives,
      dispatch,
    }),
    [engine, snapshot, registry, primitives, dispatch]
  )

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <ManifestoContext.Provider value={contextValue}>
      {children}
    </ManifestoContext.Provider>
  )
}

export default ManifestoProvider
