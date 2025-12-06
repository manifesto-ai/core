/**
 * useDependencyTracker - 의존성 추적 컴포저블
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { FormViewSchema } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import {
  createReactiveTracker,
  type CycleError,
  type DependencyGraph,
} from '@manifesto-ai/engine'

// ============================================================================
// Types
// ============================================================================

export interface UseDependencyTrackerReturn {
  /** 영향받는 필드 목록 */
  affectedFields: Ref<string[]>
  /** 의존성 그래프 */
  graph: ComputedRef<DependencyGraph | null>
  /** 순환 참조 에러 */
  cycleError: Ref<CycleError | null>
  /** 초기화 상태 */
  isInitialized: Ref<boolean>
  /** 특정 필드 변경 시 영향받는 필드 계산 */
  getAffectedFields: (fieldId: string) => string[]
  /** 필드의 모든 의존성 반환 */
  getDependencies: (fieldId: string) => string[]
  /** 평가 순서 계산 */
  getEvaluationOrder: (fieldIds: string[]) => string[] | null
  /** 그래프 초기화 */
  clear: () => void
}

// ============================================================================
// Composable
// ============================================================================

export function useDependencyTracker(
  schema?: FormViewSchema | Ref<FormViewSchema | null>
): UseDependencyTrackerReturn {
  const tracker = createReactiveTracker()

  const affectedFields = ref<string[]>([])
  const cycleError = ref<CycleError | null>(null)
  const isInitialized = ref(false)

  // Initialize from schema
  const initializeFromSchema = (viewSchema: FormViewSchema): void => {
    const result = tracker.buildFromViewSchema(viewSchema)

    if (isOk(result)) {
      isInitialized.value = true
      cycleError.value = null
    } else {
      cycleError.value = result.error
      isInitialized.value = false
    }
  }

  // Handle schema input
  if (schema) {
    if ('value' in schema) {
      // Ref
      if (schema.value) {
        initializeFromSchema(schema.value)
      }
    } else {
      // Direct value
      initializeFromSchema(schema)
    }
  }

  // Computed graph
  const graph = computed<DependencyGraph | null>(() => {
    if (!isInitialized.value) return null
    return tracker.exportGraph()
  })

  // Get affected fields
  const getAffectedFields = (fieldId: string): string[] => {
    if (!isInitialized.value) return []
    const affected = tracker.getAffectedFields(fieldId)
    affectedFields.value = affected
    return affected
  }

  // Get dependencies
  const getDependencies = (fieldId: string): string[] => {
    if (!isInitialized.value) return []
    const exportedGraph = tracker.exportGraph()
    const node = exportedGraph.nodes.get(fieldId)
    return node ? Array.from(node.dependencies) : []
  }

  // Get evaluation order
  const getEvaluationOrder = (fieldIds: string[]): string[] | null => {
    if (!isInitialized.value) return null

    // Note: Need to access internal tracker for this
    // For now, return affected fields in order
    const allAffected = new Set<string>()
    for (const fieldId of fieldIds) {
      const affected = tracker.getAffectedFields(fieldId)
      for (const f of affected) {
        allAffected.add(f)
      }
    }

    return Array.from(allAffected)
  }

  // Clear graph
  const clear = (): void => {
    isInitialized.value = false
    cycleError.value = null
    affectedFields.value = []
  }

  return {
    affectedFields,
    graph,
    cycleError,
    isInitialized,
    getAffectedFields,
    getDependencies,
    getEvaluationOrder,
    clear,
  }
}

/**
 * 디버깅용: 의존성 그래프 시각화 데이터 생성
 */
export function useGraphVisualization(
  graph: ComputedRef<DependencyGraph | null>
): ComputedRef<{ nodes: Array<{ id: string }>; edges: Array<{ from: string; to: string }> }> {
  return computed(() => {
    if (!graph.value) {
      return { nodes: [], edges: [] }
    }

    const nodes: Array<{ id: string }> = []
    const edges: Array<{ from: string; to: string }> = []

    for (const [id, node] of graph.value.nodes) {
      nodes.push({ id })

      for (const dep of node.dependencies) {
        edges.push({ from: id, to: dep })
      }
    }

    return { nodes, edges }
  })
}
