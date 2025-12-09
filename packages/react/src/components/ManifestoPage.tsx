/**
 * ManifestoPage
 *
 * 최상위 페이지 컴포넌트 (High-Level DX)
 *
 * ManifestoProvider + PageRenderer를 하나의 컴포넌트로 결합
 * 대부분의 개발자가 사용하는 Level 0 API
 */

import React, { useMemo } from 'react'
import { createViewSnapshotEngine, type ViewSnapshotEngineOptions } from '@manifesto-ai/view-snapshot'
import type { PrimitiveSet } from '../types/primitives'
import type { RendererRegistry } from '../types/renderer'
import { ManifestoProvider } from '../composition/ManifestoProvider'
import { PageRenderer } from '../composition/PageRenderer'

// ============================================================================
// Props
// ============================================================================

export interface ManifestoPageProps {
  /** 페이지 ID */
  pageId: string
  /** 페이지 타이틀 */
  title?: string
  /** Engine 옵션 (선택적) */
  engineOptions?: Omit<ViewSnapshotEngineOptions, 'pageId' | 'pageLabel'>
  /** 커스텀 Primitive 세트 (선택적) */
  primitives?: PrimitiveSet
  /** 커스텀 렌더러 레지스트리 (선택적) */
  registry?: RendererRegistry
  /** 자식 컴포넌트 (선언적 노드 등록용) */
  children?: React.ReactNode
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// ManifestoPage Component
// ============================================================================

/**
 * ManifestoPage
 *
 * Manifesto 애플리케이션의 최상위 페이지 컴포넌트입니다.
 * 내부적으로 ViewSnapshotEngine을 생성하고, 자식 컴포넌트를 통해
 * Form, Table 등의 노드를 선언적으로 등록할 수 있습니다.
 *
 * @example
 * ```tsx
 * function OrderManagementPage() {
 *   return (
 *     <ManifestoPage pageId="orders" title="주문 관리">
 *       <ManifestoForm
 *         nodeId="order-filter"
 *         schema={filterSchema}
 *         affects={['order-table']}
 *       />
 *       <ManifestoTable
 *         nodeId="order-table"
 *         schema={tableSchema}
 *         queryFn={fetchOrders}
 *       />
 *     </ManifestoPage>
 *   )
 * }
 * ```
 */
export const ManifestoPage: React.FC<ManifestoPageProps> = ({
  pageId,
  title,
  engineOptions,
  primitives,
  registry,
  children,
  className,
}) => {
  // Engine은 pageId가 변경될 때만 재생성
  const engine = useMemo(
    () =>
      createViewSnapshotEngine({
        ...engineOptions,
        pageId,
        pageLabel: title,
      }),
    [pageId, title, engineOptions]
  )

  return (
    <ManifestoProvider engine={engine} primitives={primitives} registry={registry}>
      {/* 선언적 노드 등록 (ManifestoForm, ManifestoTable 등) */}
      {children}
      {/* 실제 렌더링 */}
      <PageRenderer className={className} />
    </ManifestoProvider>
  )
}

export default ManifestoPage
