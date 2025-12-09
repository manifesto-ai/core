/**
 * @manifesto-ai/react
 *
 * Manifesto AI React Renderer
 *
 * ViewSnapshot 기반의 React 렌더링 시스템
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Composition Layer                        │
 * │  ManifestoProvider → PageRenderer → OverlayStack            │
 * ├─────────────────────────────────────────────────────────────┤
 * │                    Node Renderer Layer                      │
 * │  FormRenderer | TableRenderer | TabsRenderer | OverlayRenderer│
 * ├─────────────────────────────────────────────────────────────┤
 * │                    Primitive Layer                          │
 * │  Field | Button | Table | Modal | Dialog | Toast            │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * import {
 *   ManifestoPage,
 *   ManifestoForm,
 *   ManifestoTable,
 *   useOverlay,
 *   useToast,
 * } from '@manifesto-ai/react'
 *
 * function OrderManagementPage() {
 *   const overlay = useOverlay()
 *
 *   return (
 *     <ManifestoPage pageId="orders" title="주문 관리">
 *       <ManifestoForm nodeId="filter" schema={filterSchema} />
 *       <ManifestoTable nodeId="table" schema={tableSchema} />
 *     </ManifestoPage>
 *   )
 * }
 * ```
 */

// ============================================================================
// Composition Layer (NEW)
// ============================================================================

export {
  // Provider
  ManifestoProvider,
  type ManifestoProviderProps,
  // Context
  ManifestoContext,
  useManifestoContext,
  type ManifestoContextValue,
  // Renderers
  PageRenderer,
  type PageRendererProps,
  OverlayStack,
  type OverlayStackProps,
} from './composition'

// ============================================================================
// Primitive Layer (NEW)
// ============================================================================

export {
  // Primitives
  Field,
  Button,
  ActionBar,
  Table,
  DetailTable,
  TableSkeleton,
  TableEmpty,
  TableError,
  Pagination,
  Card,
  Stack,
  Modal,
  Dialog,
  Toast,
  Tabs,
  // Factory
  createDefaultPrimitiveSet,
  getDefaultPrimitiveSet,
} from './primitives'

// ============================================================================
// Node Renderer Layer (NEW)
// ============================================================================

export {
  // Renderers
  FormRenderer,
  TableRenderer,
  TabsRenderer,
  DetailTableRenderer,
  ModalRenderer,
  DialogRenderer,
  ToastRenderer,
  // Factory
  createDefaultRendererRegistry,
} from './renderers'

// ============================================================================
// High-Level Components (NEW - DX)
// ============================================================================

export { ManifestoPage, type ManifestoPageProps } from './components/ManifestoPage'
export { ManifestoForm, type ManifestoFormProps } from './components/ManifestoForm'
export { ManifestoTable, type ManifestoTableProps, type QueryParams, type QueryResult } from './components/ManifestoTable'
export { ManifestoTabs, type ManifestoTabsProps, type TabConfig } from './components/ManifestoTabs'

// ============================================================================
// Hooks (NEW & Legacy)
// ============================================================================

export * from './hooks'

// ============================================================================
// Types (NEW & Legacy)
// ============================================================================

export * from './types'

