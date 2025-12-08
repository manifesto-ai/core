/**
 * ViewSnapshot Node Type Guards
 *
 * 노드 타입 판별을 위한 타입 가드 함수
 */

import type {
  ViewSnapshotNode,
  PageSnapshot,
  TabsSnapshot,
  FormSnapshot,
  TableSnapshot,
  DetailTableSnapshot,
} from '../types'

/**
 * PageSnapshot 타입 가드
 */
export const isPageSnapshot = (node: ViewSnapshotNode): node is PageSnapshot =>
  node.kind === 'page'

/**
 * TabsSnapshot 타입 가드
 */
export const isTabsSnapshot = (node: ViewSnapshotNode): node is TabsSnapshot =>
  node.kind === 'tabs'

/**
 * FormSnapshot 타입 가드
 */
export const isFormSnapshot = (node: ViewSnapshotNode): node is FormSnapshot =>
  node.kind === 'form'

/**
 * TableSnapshot 타입 가드
 */
export const isTableSnapshot = (node: ViewSnapshotNode): node is TableSnapshot =>
  node.kind === 'table'

/**
 * DetailTableSnapshot 타입 가드
 */
export const isDetailTableSnapshot = (node: ViewSnapshotNode): node is DetailTableSnapshot =>
  node.kind === 'detailTable'

/**
 * 노드가 자식을 가질 수 있는지 확인
 */
export const hasChildren = (node: ViewSnapshotNode): node is PageSnapshot =>
  isPageSnapshot(node)

/**
 * 노드가 오버레이를 가질 수 있는지 확인
 */
export const hasOverlays = (node: ViewSnapshotNode): node is PageSnapshot =>
  isPageSnapshot(node)

/**
 * 노드 ID로 자식 노드 찾기
 */
export const findNodeById = (
  root: ViewSnapshotNode,
  nodeId: string
): ViewSnapshotNode | undefined => {
  if (root.nodeId === nodeId) {
    return root
  }

  if (isPageSnapshot(root)) {
    for (const child of root.children) {
      const found = findNodeById(child, nodeId)
      if (found) return found
    }

    // 오버레이 내부 컨텐츠도 검색
    for (const overlay of root.overlays) {
      if (overlay.content) {
        const found = findNodeById(overlay.content, nodeId)
        if (found) return found
      }
    }
  }

  return undefined
}

/**
 * 노드 트리를 순회하며 콜백 실행
 */
export const traverseNodes = (
  root: ViewSnapshotNode,
  callback: (node: ViewSnapshotNode, depth: number) => void,
  depth = 0
): void => {
  callback(root, depth)

  if (isPageSnapshot(root)) {
    for (const child of root.children) {
      traverseNodes(child, callback, depth + 1)
    }

    for (const overlay of root.overlays) {
      if (overlay.content) {
        traverseNodes(overlay.content, callback, depth + 1)
      }
    }
  }
}
