/**
 * InkProvider
 *
 * ViewSnapshot Engine을 Ink 앱에 제공하는 Provider
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useStdout } from 'ink'
import type { IViewSnapshotEngine, PageSnapshot, ViewIntent } from '@manifesto-ai/view-snapshot'
import { InkContext, type InkContextValue } from './InkContext'
import type { InkRendererRegistry } from '../types/renderer'
import { createDefaultInkPrimitives, type InkPrimitiveSet } from '../primitives'
import { createDefaultInkRendererRegistry } from '../renderers'

// ============================================================================
// Props
// ============================================================================

export interface InkProviderProps {
  /** ViewSnapshot 엔진 */
  engine: IViewSnapshotEngine
  /** Primitive 컴포넌트 세트 (선택적) */
  primitives?: InkPrimitiveSet
  /** 렌더러 레지스트리 (선택적) */
  registry?: InkRendererRegistry
  /** 인터랙티브 모드 (기본: true) */
  isInteractive?: boolean
  /** 자식 컴포넌트 */
  children: React.ReactNode
}

// ============================================================================
// InkProvider Component
// ============================================================================

export const InkProvider: React.FC<InkProviderProps> = ({
  engine,
  primitives: customPrimitives,
  registry: customRegistry,
  isInteractive = true,
  children,
}) => {
  // 스냅샷 상태
  const [snapshot, setSnapshot] = useState<PageSnapshot>(() => engine.getViewSnapshot())

  // 터미널 크기
  const { stdout } = useStdout()
  const terminalWidth = stdout?.columns ?? 80
  const terminalHeight = stdout?.rows ?? 24

  // Primitives와 Registry
  const primitives = useMemo(
    () => customPrimitives ?? createDefaultInkPrimitives(),
    [customPrimitives]
  )

  const registry = useMemo(
    () => customRegistry ?? createDefaultInkRendererRegistry(primitives),
    [customRegistry, primitives]
  )

  // Engine 구독
  useEffect(() => {
    const unsubscribe = engine.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot)
    })

    // 초기 스냅샷 동기화
    setSnapshot(engine.getViewSnapshot())

    return () => {
      unsubscribe()
    }
  }, [engine])

  // Intent 디스패치
  const dispatch = useCallback(
    async (intent: ViewIntent): Promise<PageSnapshot> => {
      return engine.dispatchIntent(intent)
    },
    [engine]
  )

  // Context 값
  const contextValue: InkContextValue = useMemo(
    () => ({
      engine,
      snapshot,
      registry,
      primitives,
      dispatch,
      terminalWidth,
      terminalHeight,
      isInteractive,
    }),
    [engine, snapshot, registry, primitives, dispatch, terminalWidth, terminalHeight, isInteractive]
  )

  return <InkContext.Provider value={contextValue}>{children}</InkContext.Provider>
}

export default InkProvider
