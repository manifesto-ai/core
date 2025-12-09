/**
 * Ink Renderers
 *
 * ViewSnapshot 노드를 Ink UI로 렌더링하는 렌더러들
 */

export { FormRenderer } from './FormRenderer'
export { TableRenderer } from './TableRenderer'

import { FormRenderer } from './FormRenderer'
import { TableRenderer } from './TableRenderer'
import type { InkRendererRegistry } from '../types/renderer'
import type { InkPrimitiveSet } from '../primitives'

// ============================================================================
// Default Renderer Registry
// ============================================================================

import type { InkNodeRenderer } from '../types/renderer'

/**
 * 기본 InkRendererRegistry 생성
 *
 * FormRenderer와 TableRenderer가 등록된 레지스트리 반환
 */
export const createDefaultInkRendererRegistry = (
  primitives: InkPrimitiveSet
): InkRendererRegistry => {
  const registry: InkRendererRegistry = {
    nodes: new Map(),
    primitives,
  }

  // 기본 렌더러 등록 (타입 캐스팅 필요)
  registry.nodes.set('form', FormRenderer as unknown as InkNodeRenderer)
  registry.nodes.set('table', TableRenderer as unknown as InkNodeRenderer)

  return registry
}
