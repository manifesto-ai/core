/**
 * PageSnapshotBuilder
 *
 * PageSnapshot 생성 - 여러 자식 노드와 오버레이 통합
 */

import type {
  PageSnapshot,
  ViewSnapshotNode,
  ViewAction,
  OverlayInstance,
} from '../types'

// ============================================================================
// Builder Options
// ============================================================================

export interface PageSnapshotBuilderOptions {
  /** 페이지 ID */
  pageId: string
  /** 페이지 라벨 */
  label?: string
  /** 자식 노드들 */
  children?: readonly ViewSnapshotNode[]
  /** 오버레이 인스턴스들 */
  overlays?: readonly OverlayInstance[]
  /** 페이지 레벨 액션들 */
  actions?: readonly ViewAction[]
}

// ============================================================================
// Builder
// ============================================================================

/**
 * PageSnapshot 빌더
 */
export const buildPageSnapshot = (options: PageSnapshotBuilderOptions): PageSnapshot => {
  return {
    nodeId: options.pageId,
    kind: 'page',
    label: options.label,
    children: options.children ? [...options.children] : [],
    overlays: options.overlays ? [...options.overlays] : [],
    actions: options.actions ? [...options.actions] : [],
  }
}

/**
 * PageSnapshot에 자식 노드 추가
 */
export const addChildToPage = (
  page: PageSnapshot,
  child: ViewSnapshotNode
): PageSnapshot => {
  return {
    ...page,
    children: [...page.children, child],
  }
}

/**
 * PageSnapshot에 오버레이 추가
 */
export const addOverlayToPage = (
  page: PageSnapshot,
  overlay: OverlayInstance
): PageSnapshot => {
  return {
    ...page,
    overlays: [...page.overlays, overlay],
  }
}

/**
 * PageSnapshot에서 오버레이 제거
 */
export const removeOverlayFromPage = (
  page: PageSnapshot,
  instanceId: string
): PageSnapshot => {
  return {
    ...page,
    overlays: page.overlays.filter(o => o.instanceId !== instanceId),
  }
}

/**
 * PageSnapshot에서 노드 찾기
 */
export const findNodeInPage = (
  page: PageSnapshot,
  nodeId: string
): ViewSnapshotNode | undefined => {
  if (page.nodeId === nodeId) return page

  for (const child of page.children) {
    if (child.nodeId === nodeId) return child
  }

  // 오버레이 내부 컨텐츠도 검색
  for (const overlay of page.overlays) {
    if (overlay.content?.nodeId === nodeId) return overlay.content
  }

  return undefined
}

/**
 * PageSnapshot 자식 노드 업데이트
 */
export const updateChildInPage = (
  page: PageSnapshot,
  nodeId: string,
  updater: (node: ViewSnapshotNode) => ViewSnapshotNode
): PageSnapshot => {
  const updatedChildren = page.children.map(child =>
    child.nodeId === nodeId ? updater(child) : child
  )

  return {
    ...page,
    children: updatedChildren,
  }
}
