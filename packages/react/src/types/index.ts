/**
 * React Renderer Types
 *
 * ViewSnapshot 기반 렌더링을 위한 타입 정의
 */

// ============================================================================
// Renderer Types
// ============================================================================

export {
  type RenderContext,
  type NodeRenderer,
  type OverlayRenderer,
  type RendererRegistry,
  createRendererRegistry,
  registerNodeRenderer,
  registerOverlayRenderer,
  defineNodeRenderer,
  defineOverlayRenderer,
} from './renderer'

// ============================================================================
// Primitive Types
// ============================================================================

export {
  type PrimitiveSet,
  type FieldPrimitiveProps,
  type FieldLayout,
  type FieldSlots,
  type ButtonPrimitiveProps,
  type ButtonVariant,
  type ButtonSize,
  type ActionBarPrimitiveProps,
  type ActionHandler,
  type TablePrimitiveProps,
  type DetailTablePrimitiveProps,
  type TableSkeletonProps,
  type TableEmptyProps,
  type TableErrorProps,
  type PaginationPrimitiveProps,
  type CardPrimitiveProps,
  type StackPrimitiveProps,
  type StackDirection,
  type StackAlign,
  type StackGap,
  type ModalPrimitiveProps,
  type DialogPrimitiveProps,
  type ToastPrimitiveProps,
  type ToastVariant,
  type TabsPrimitiveProps,
  type TabItem,
  type RowSelectHandler,
  type SortHandler,
} from './primitives'
