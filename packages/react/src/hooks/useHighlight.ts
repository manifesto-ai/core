/**
 * useHighlight Hook
 *
 * React hook for subscribing to highlight state changes on a specific field.
 * Used by FieldRenderer and SectionRenderer to apply highlight data attributes.
 */

import { useContext, useEffect, useState, useMemo } from 'react'
import type { HighlightState, HighlightDataAttributes } from '@manifesto-ai/ui'
import { HighlightContext } from '../components/HighlightProvider'

export interface UseHighlightResult {
  /** Current highlight state for this field, or null if not highlighted */
  highlightState: HighlightState | null
  /** Data attributes to spread on the element for CSS styling */
  dataAttributes: HighlightDataAttributes
  /** Whether the field is currently highlighted */
  isHighlighted: boolean
}

/**
 * Subscribe to highlight state for a specific field path
 *
 * @param fieldPath - The field path to monitor for highlights
 * @returns Highlight state and data attributes for the field
 *
 * @example
 * ```tsx
 * function FieldRenderer({ fieldId }) {
 *   const { dataAttributes } = useHighlight(fieldId)
 *   return <div {...dataAttributes}>...</div>
 * }
 * ```
 */
export function useHighlight(fieldPath: string): UseHighlightResult {
  const manager = useContext(HighlightContext)
  const [state, setState] = useState<HighlightState | null>(() =>
    manager?.getHighlightState(fieldPath) ?? null
  )

  useEffect(() => {
    if (!manager) return

    // Get initial state
    setState(manager.getHighlightState(fieldPath))

    // Subscribe to changes
    const unsubscribe = manager.subscribe((path, newState) => {
      if (path === fieldPath) {
        setState(newState)
      }
    })

    return unsubscribe
  }, [manager, fieldPath])

  const dataAttributes = useMemo<HighlightDataAttributes>(() => {
    if (!state || !state.active) {
      return {}
    }

    return {
      'data-highlight-type': state.type,
      'data-highlight-intensity': state.config.intensity ?? 'normal',
      'data-highlight-active': 'true',
    }
  }, [state])

  return {
    highlightState: state,
    dataAttributes,
    isHighlighted: !!state?.active,
  }
}

/**
 * Get the highlight context for programmatic control
 *
 * @returns The HighlightManager from context, or null if not provided
 *
 * @example
 * ```tsx
 * function DemoButton() {
 *   const highlightManager = useHighlightContext()
 *
 *   const handleDemo = () => {
 *     highlightManager?.highlight({
 *       type: 'value-change',
 *       fieldPath: 'email',
 *       duration: 2000
 *     })
 *   }
 *
 *   return <button onClick={handleDemo}>Demo</button>
 * }
 * ```
 */
export function useHighlightContext() {
  return useContext(HighlightContext)
}
