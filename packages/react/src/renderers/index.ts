/**
 * Node Renderer Layer
 *
 * ViewSnapshot 노드를 React UI로 변환하는 렌더러들
 */

// Node Renderers
export { FormRenderer } from './FormRenderer'
export { TableRenderer } from './TableRenderer'
export { TabsRenderer } from './TabsRenderer'
export { DetailTableRenderer } from './DetailTableRenderer'

// Overlay Renderers
export { ModalRenderer, DialogRenderer, ToastRenderer } from './overlays'

// Types
export type { NodeRenderer, OverlayRenderer, RenderContext, RendererRegistry } from '../types/renderer'

// ============================================================================
// Default Renderer Registration
// ============================================================================

import type { RendererRegistry } from '../types/renderer'
import type { PrimitiveSet } from '../types/primitives'
import { FormRenderer } from './FormRenderer'
import { TableRenderer } from './TableRenderer'
import { TabsRenderer } from './TabsRenderer'
import { DetailTableRenderer } from './DetailTableRenderer'
import { ModalRenderer, DialogRenderer, ToastRenderer } from './overlays'
import { createRendererRegistry, registerNodeRenderer, registerOverlayRenderer } from '../types/renderer'

/**
 * 기본 렌더러들을 등록한 RendererRegistry 생성
 *
 * @param primitives - Primitive 컴포넌트 세트
 * @returns 기본 렌더러가 등록된 RendererRegistry
 *
 * @example
 * ```typescript
 * const primitives = createDefaultPrimitiveSet()
 * const registry = createDefaultRendererRegistry(primitives)
 *
 * <ManifestoProvider registry={registry}>
 *   ...
 * </ManifestoProvider>
 * ```
 */
export const createDefaultRendererRegistry = (primitives: PrimitiveSet): RendererRegistry => {
  const registry = createRendererRegistry(primitives)

  // Node Renderers
  registerNodeRenderer(registry, FormRenderer)
  registerNodeRenderer(registry, TableRenderer)
  registerNodeRenderer(registry, TabsRenderer)
  registerNodeRenderer(registry, DetailTableRenderer)

  // Overlay Renderers
  registerOverlayRenderer(registry, ModalRenderer)
  registerOverlayRenderer(registry, DialogRenderer)
  registerOverlayRenderer(registry, ToastRenderer)

  return registry
}
