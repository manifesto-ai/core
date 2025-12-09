/**
 * Primitive Layer
 *
 * UI 컴포넌트의 기본 빌딩 블록
 * Molecular 수준 (Label + Input + Error 조합) 으로 캡슐화됩니다.
 */

// Field
export { Field } from './Field'

// Button & Actions
export { Button } from './Button'
export { ActionBar } from './ActionBar'

// Table
export { Table, DetailTable, TableSkeleton, TableEmpty, TableError } from './Table'

// Pagination
export { Pagination } from './Pagination'

// Layout
export { Card, Stack } from './Layout'

// Overlay
export { Modal, Dialog, Toast } from './Overlay'

// Tabs
export { Tabs } from './Tabs'

// Types
export type { PrimitiveSet } from '../types/primitives'

// ============================================================================
// Default PrimitiveSet
// ============================================================================

import type { PrimitiveSet } from '../types/primitives'
import { Field } from './Field'
import { Button } from './Button'
import { ActionBar } from './ActionBar'
import { Table, DetailTable, TableSkeleton, TableEmpty, TableError } from './Table'
import { Pagination } from './Pagination'
import { Card, Stack } from './Layout'
import { Modal, Dialog, Toast } from './Overlay'
import { Tabs } from './Tabs'

/**
 * 기본 PrimitiveSet 생성
 *
 * 기본 HTML 기반 Primitive 컴포넌트 세트를 반환합니다.
 * 다른 UI 라이브러리 (Shadcn, Material-UI 등)를 사용하려면
 * 커스텀 PrimitiveSet을 생성하세요.
 *
 * @example
 * ```typescript
 * const primitives = createDefaultPrimitiveSet()
 *
 * <ManifestoProvider primitives={primitives}>
 *   ...
 * </ManifestoProvider>
 * ```
 */
export const createDefaultPrimitiveSet = (): PrimitiveSet => ({
  // Field (Molecular)
  Field,

  // Actions
  Button,
  ActionBar,

  // Table
  Table,
  DetailTable,
  Pagination,
  TableSkeleton,
  TableEmpty,
  TableError,

  // Layout
  Card,
  Stack,

  // Overlay
  Modal,
  Dialog,
  Toast,

  // Tabs
  Tabs,
})

/**
 * 싱글톤 기본 PrimitiveSet
 */
let defaultPrimitiveSet: PrimitiveSet | null = null

/**
 * 기본 PrimitiveSet 가져오기 (싱글톤)
 */
export const getDefaultPrimitiveSet = (): PrimitiveSet => {
  if (!defaultPrimitiveSet) {
    defaultPrimitiveSet = createDefaultPrimitiveSet()
  }
  return defaultPrimitiveSet
}
