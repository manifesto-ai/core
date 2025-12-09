/**
 * PageRenderer
 *
 * PageSnapshot을 순회하며 자식 노드들을 렌더링
 */

import React, { useCallback } from 'react'
import { Box, Text } from 'ink'
import type { ViewSnapshotNode } from '@manifesto-ai/view-snapshot'
import { useInkContext } from './InkContext'
import type { InkRenderContext } from '../types/renderer'

// ============================================================================
// PageRenderer Component
// ============================================================================

export const PageRenderer: React.FC = () => {
  const {
    engine,
    snapshot,
    registry,
    primitives,
    dispatch,
    terminalWidth,
    terminalHeight,
    isInteractive,
  } = useInkContext()

  // 노드 렌더링 함수
  const renderNode = useCallback(
    (node: ViewSnapshotNode, path: string[] = [], depth: number = 0): React.ReactNode => {
      const renderer = registry.nodes.get(node.kind)

      if (!renderer) {
        return (
          <Box key={node.nodeId}>
            <Text color="red">Unknown node kind: {node.kind}</Text>
          </Box>
        )
      }

      const context: InkRenderContext = {
        engine,
        primitives,
        registry,
        path: [...path, node.nodeId],
        depth: depth + 1,
        dispatch,
        terminalWidth,
        terminalHeight,
        isInteractive,
        renderNode: (childNode) => renderNode(childNode, [...path, node.nodeId], depth + 1),
      }

      return (
        <Box key={node.nodeId} flexDirection="column" marginBottom={1}>
          {renderer.render(node, context)}
        </Box>
      )
    },
    [engine, primitives, registry, dispatch, terminalWidth, terminalHeight, isInteractive]
  )

  return (
    <Box flexDirection="column" padding={1}>
      {/* 페이지 헤더 */}
      {snapshot.label && (
        <Box marginBottom={1} borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text bold color="white">
            {snapshot.label}
          </Text>
        </Box>
      )}

      {/* 자식 노드들 렌더링 */}
      {snapshot.children.map((child) => renderNode(child))}

      {/* 액션바 (페이지 레벨) */}
      {snapshot.actions.length > 0 && (
        <Box marginTop={1}>
          <primitives.ActionBar
            actions={snapshot.actions}
            onAction={(action) =>
              dispatch({
                type: 'triggerAction',
                nodeId: snapshot.nodeId,
                actionType: action.type,
              })
            }
            isFocused={isInteractive}
          />
        </Box>
      )}

      {/* 푸터: 조작 힌트 */}
      {isInteractive && (
        <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Text color="gray">
            ↑↓ 이동 | Tab 다음 | Space/Enter 선택 | Ctrl+C 종료
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default PageRenderer
