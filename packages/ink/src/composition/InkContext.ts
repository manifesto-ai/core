/**
 * InkContext
 *
 * Ink 렌더링에 필요한 Context 정의
 */

import { createContext, useContext } from 'react'
import type {
  IViewSnapshotEngine,
  PageSnapshot,
  ViewIntent,
} from '@manifesto-ai/view-snapshot'
import type { InkRendererRegistry } from '../types/renderer'
import type { InkPrimitiveSet } from '../primitives'

// ============================================================================
// Context Value Type
// ============================================================================

export interface InkContextValue {
  /** ViewSnapshot 엔진 */
  engine: IViewSnapshotEngine
  /** 현재 스냅샷 */
  snapshot: PageSnapshot
  /** 렌더러 레지스트리 */
  registry: InkRendererRegistry
  /** Primitive 컴포넌트 세트 */
  primitives: InkPrimitiveSet
  /** Intent 디스패치 함수 */
  dispatch: (intent: ViewIntent) => Promise<PageSnapshot>
  /** 터미널 너비 */
  terminalWidth: number
  /** 터미널 높이 */
  terminalHeight: number
  /** 인터랙티브 모드 여부 */
  isInteractive: boolean
}

// ============================================================================
// Context
// ============================================================================

export const InkContext = createContext<InkContextValue | null>(null)

// ============================================================================
// Hook
// ============================================================================

/**
 * InkContext 접근 훅
 *
 * InkProvider 내부에서만 사용 가능
 */
export const useInkContext = (): InkContextValue => {
  const context = useContext(InkContext)
  if (!context) {
    throw new Error('useInkContext must be used within an InkProvider')
  }
  return context
}

/**
 * Engine 접근 훅
 */
export const useEngine = (): IViewSnapshotEngine => {
  return useInkContext().engine
}

/**
 * Snapshot 접근 훅
 */
export const useSnapshot = (): PageSnapshot => {
  return useInkContext().snapshot
}

/**
 * Dispatch 접근 훅
 */
export const useDispatch = (): ((intent: ViewIntent) => Promise<PageSnapshot>) => {
  return useInkContext().dispatch
}
