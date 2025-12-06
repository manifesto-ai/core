/**
 * useDependencyTracker - Dependency tracking hook for React
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
  /** Affected fields list */
  affectedFields: string[]
  /** Dependency graph */
  graph: DependencyGraph | null
  /** Cycle error */
  cycleError: CycleError | null
  /** Initialization state */
  isInitialized: boolean
  /** Get affected fields for a field change */
  getAffectedFields: (fieldId: string) => string[]
  /** Get all dependencies for a field */
  getDependencies: (fieldId: string) => string[]
  /** Get evaluation order */
  getEvaluationOrder: (fieldIds: string[]) => string[] | null
  /** Clear graph */
  clear: () => void
}

// ============================================================================
// Hook
// ============================================================================

export function useDependencyTracker(
  schema?: FormViewSchema | null
): UseDependencyTrackerReturn {
  const trackerRef = useRef(createReactiveTracker())

  const [affectedFields, setAffectedFields] = useState<string[]>([])
  const [cycleError, setCycleError] = useState<CycleError | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize from schema
  useEffect(() => {
    if (!schema) {
      setIsInitialized(false)
      return
    }

    const result = trackerRef.current.buildFromViewSchema(schema)

    if (isOk(result)) {
      setIsInitialized(true)
      setCycleError(null)
    } else {
      setCycleError(result.error)
      setIsInitialized(false)
    }
  }, [schema])

  // Computed graph
  const graph = useMemo((): DependencyGraph | null => {
    if (!isInitialized) return null
    return trackerRef.current.exportGraph()
  }, [isInitialized])

  // Get affected fields
  const getAffectedFields = useCallback((fieldId: string): string[] => {
    if (!isInitialized) return []
    const affected = trackerRef.current.getAffectedFields(fieldId)
    setAffectedFields(affected)
    return affected
  }, [isInitialized])

  // Get dependencies
  const getDependencies = useCallback((fieldId: string): string[] => {
    if (!isInitialized) return []
    const exportedGraph = trackerRef.current.exportGraph()
    const node = exportedGraph.nodes.get(fieldId)
    return node ? Array.from(node.dependencies) : []
  }, [isInitialized])

  // Get evaluation order
  const getEvaluationOrder = useCallback((fieldIds: string[]): string[] | null => {
    if (!isInitialized) return null

    const allAffected = new Set<string>()
    for (const fieldId of fieldIds) {
      const affected = trackerRef.current.getAffectedFields(fieldId)
      for (const f of affected) {
        allAffected.add(f)
      }
    }

    return Array.from(allAffected)
  }, [isInitialized])

  // Clear graph
  const clear = useCallback((): void => {
    setIsInitialized(false)
    setCycleError(null)
    setAffectedFields([])
  }, [])

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
 * Debugging: Generate dependency graph visualization data
 */
export function useGraphVisualization(
  graph: DependencyGraph | null
): { nodes: Array<{ id: string }>; edges: Array<{ from: string; to: string }> } {
  return useMemo(() => {
    if (!graph) {
      return { nodes: [], edges: [] }
    }

    const nodes: Array<{ id: string }> = []
    const edges: Array<{ from: string; to: string }> = []

    for (const [id, node] of graph.nodes) {
      nodes.push({ id })

      for (const dep of node.dependencies) {
        edges.push({ from: id, to: dep })
      }
    }

    return { nodes, edges }
  }, [graph])
}
