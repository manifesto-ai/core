/**
 * Ink Renderer Types
 *
 * Terminal UI 렌더링을 위한 타입 정의
 * React 패키지의 renderer.ts와 동일한 인터페이스 유지
 */

import type { ReactNode } from 'react'
import type {
  IViewSnapshotEngine,
  PageSnapshot,
  ViewSnapshotNode,
  ViewIntent,
  ViewNodeKind,
} from '@manifesto-ai/view-snapshot'
import type { InkPrimitiveSet } from '../primitives'

// ============================================================================
// InkRenderContext
// ============================================================================

/**
 * Ink 렌더링 과정에서 하위 노드로 전파되는 컨텍스트
 */
export interface InkRenderContext {
  /** ViewSnapshot 엔진 참조 */
  engine: IViewSnapshotEngine
  /** Primitive 컴포넌트 세트 */
  primitives: InkPrimitiveSet
  /** 렌더러 레지스트리 */
  registry: InkRendererRegistry
  /** 현재 노드까지의 경로 (nodeId 배열) */
  path: string[]
  /** 현재 트리 깊이 (0부터 시작) */
  depth: number
  /** Intent 디스패치 함수 */
  dispatch: (intent: ViewIntent) => Promise<PageSnapshot>
  /** 부모 노드 참조 (최상위에서는 undefined) */
  parent?: ViewSnapshotNode
  /** 자식 노드 렌더링 헬퍼 함수 */
  renderNode?: (node: ViewSnapshotNode) => ReactNode
  /** 터미널 너비 */
  terminalWidth: number
  /** 터미널 높이 */
  terminalHeight: number
  /** 인터랙티브 모드 여부 */
  isInteractive: boolean
}

// ============================================================================
// InkNodeRenderer
// ============================================================================

/**
 * 특정 ViewSnapshotNode 타입을 Ink로 렌더링하는 인터페이스
 */
export interface InkNodeRenderer<T extends ViewSnapshotNode = ViewSnapshotNode> {
  /** 이 렌더러가 처리하는 노드 종류 */
  kind: T['kind']
  /** 노드를 Ink 엘리먼트로 렌더링 */
  render: (node: T, context: InkRenderContext) => ReactNode
}

// ============================================================================
// InkRendererRegistry
// ============================================================================

/**
 * 노드 렌더러 등록소
 */
export interface InkRendererRegistry {
  /** 노드 종류별 렌더러 맵 */
  nodes: Map<ViewNodeKind, InkNodeRenderer>
  /** Primitive 컴포넌트 세트 */
  primitives: InkPrimitiveSet
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 빈 InkRendererRegistry 생성
 */
export const createInkRendererRegistry = (primitives: InkPrimitiveSet): InkRendererRegistry => ({
  nodes: new Map(),
  primitives,
})

/**
 * InkNodeRenderer를 Registry에 등록하는 헬퍼 함수
 */
export const registerInkNodeRenderer = <T extends ViewSnapshotNode>(
  registry: InkRendererRegistry,
  renderer: InkNodeRenderer<T>
): void => {
  registry.nodes.set(renderer.kind, renderer as unknown as InkNodeRenderer)
}

/**
 * InkNodeRenderer 정의 헬퍼 함수
 */
export const defineInkNodeRenderer = <T extends ViewSnapshotNode>(
  renderer: InkNodeRenderer<T>
): InkNodeRenderer<T> => renderer
