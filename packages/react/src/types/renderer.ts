/**
 * React Renderer Types
 *
 * ViewSnapshot 기반 렌더링을 위한 핵심 타입 정의
 * - RenderContext: 렌더링 과정에서 전파되는 컨텍스트
 * - NodeRenderer: 특정 노드 타입을 렌더링하는 인터페이스
 * - RendererRegistry: 노드/오버레이 렌더러 등록소
 */

import type { ReactNode } from 'react'
import type {
  IViewSnapshotEngine,
  PageSnapshot,
  ViewSnapshotNode,
  ViewIntent,
  ViewNodeKind,
  OverlayKind,
  OverlayInstance,
} from '@manifesto-ai/view-snapshot'
import type { PrimitiveSet } from './primitives'

// ============================================================================
// RenderContext
// ============================================================================

/**
 * 렌더링 과정에서 하위 노드로 전파되는 컨텍스트
 *
 * 모든 NodeRenderer는 이 컨텍스트를 받아 렌더링을 수행합니다.
 */
export interface RenderContext {
  /** ViewSnapshot 엔진 참조 */
  engine: IViewSnapshotEngine
  /** Primitive 컴포넌트 세트 */
  primitives: PrimitiveSet
  /** 렌더러 레지스트리 */
  registry: RendererRegistry
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
}

// ============================================================================
// NodeRenderer
// ============================================================================

/**
 * 특정 ViewSnapshotNode 타입을 렌더링하는 인터페이스
 *
 * @example
 * ```typescript
 * const FormRenderer: NodeRenderer<FormSnapshot> = {
 *   kind: 'form',
 *   render: (node, context) => {
 *     const { primitives, dispatch } = context
 *     return (
 *       <form>
 *         {node.fields.map(field => (
 *           <primitives.Field key={field.id} field={field} />
 *         ))}
 *       </form>
 *     )
 *   }
 * }
 * ```
 */
export interface NodeRenderer<T extends ViewSnapshotNode = ViewSnapshotNode> {
  /** 이 렌더러가 처리하는 노드 종류 */
  kind: T['kind']
  /** 노드를 React 엘리먼트로 렌더링 */
  render: (node: T, context: RenderContext) => ReactNode
}

// ============================================================================
// OverlayRenderer
// ============================================================================

/**
 * Overlay 인스턴스를 렌더링하는 인터페이스
 *
 * Modal, Dialog, Toast 등 오버레이 타입별로 렌더러를 정의합니다.
 */
export interface OverlayRenderer {
  /** 이 렌더러가 처리하는 오버레이 종류 */
  kind: OverlayKind
  /** 오버레이 인스턴스를 React 엘리먼트로 렌더링 */
  render: (instance: OverlayInstance, context: RenderContext) => ReactNode
}

// ============================================================================
// RendererRegistry
// ============================================================================

/**
 * 노드 및 오버레이 렌더러 등록소
 *
 * Registry 기반 조회를 통해 새로운 노드 타입 추가 시
 * 기존 코드 수정 없이 확장이 가능합니다. (Open-Closed Principle)
 */
export interface RendererRegistry {
  /** 노드 종류별 렌더러 맵 */
  nodes: Map<ViewNodeKind, NodeRenderer>
  /** 오버레이 종류별 렌더러 맵 */
  overlays: Map<OverlayKind, OverlayRenderer>
  /** Primitive 컴포넌트 세트 */
  primitives: PrimitiveSet
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 빈 RendererRegistry 생성
 */
export const createRendererRegistry = (primitives: PrimitiveSet): RendererRegistry => ({
  nodes: new Map(),
  overlays: new Map(),
  primitives,
})

/**
 * NodeRenderer를 Registry에 등록하는 헬퍼 함수
 */
export const registerNodeRenderer = <T extends ViewSnapshotNode>(
  registry: RendererRegistry,
  renderer: NodeRenderer<T>
): void => {
  registry.nodes.set(renderer.kind, renderer as unknown as NodeRenderer)
}

/**
 * OverlayRenderer를 Registry에 등록하는 헬퍼 함수
 */
export const registerOverlayRenderer = (
  registry: RendererRegistry,
  renderer: OverlayRenderer
): void => {
  registry.overlays.set(renderer.kind, renderer)
}

// ============================================================================
// Helper Type
// ============================================================================

/**
 * NodeRenderer 정의 헬퍼 함수
 *
 * @example
 * ```typescript
 * const FormRenderer = defineNodeRenderer<FormSnapshot>({
 *   kind: 'form',
 *   render: (node, context) => { ... }
 * })
 * ```
 */
export const defineNodeRenderer = <T extends ViewSnapshotNode>(
  renderer: NodeRenderer<T>
): NodeRenderer<T> => renderer

/**
 * OverlayRenderer 정의 헬퍼 함수
 */
export const defineOverlayRenderer = (
  renderer: OverlayRenderer
): OverlayRenderer => renderer
