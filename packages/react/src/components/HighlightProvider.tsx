/**
 * HighlightProvider
 *
 * React context provider for the highlight system.
 * Wrap your form with this provider to enable highlight functionality.
 */

import React, { createContext, useMemo, useEffect } from 'react'
import { HighlightManager, createHighlightManager } from '@manifesto-ai/ui'

/**
 * Context for accessing the HighlightManager
 */
export const HighlightContext = createContext<HighlightManager | null>(null)

export interface HighlightProviderProps {
  /** Child components */
  children: React.ReactNode
  /**
   * Optional external HighlightManager instance.
   * If not provided, a new instance will be created.
   */
  manager?: HighlightManager
}

/**
 * Provider component for highlight functionality
 *
 * @example
 * ```tsx
 * // Basic usage - creates internal manager
 * <HighlightProvider>
 *   <FormRenderer ... />
 * </HighlightProvider>
 *
 * // With external manager for programmatic control
 * const manager = createHighlightManager()
 * <HighlightProvider manager={manager}>
 *   <FormRenderer ... />
 * </HighlightProvider>
 * ```
 */
export const HighlightProvider: React.FC<HighlightProviderProps> = ({ children, manager }) => {
  // Create internal manager if not provided
  const highlightManager = useMemo(() => manager ?? createHighlightManager(), [manager])

  // Cleanup on unmount (only for internally created manager)
  useEffect(() => {
    if (!manager) {
      return () => {
        highlightManager.dispose()
      }
    }
  }, [manager, highlightManager])

  return <HighlightContext.Provider value={highlightManager}>{children}</HighlightContext.Provider>
}

export default HighlightProvider
