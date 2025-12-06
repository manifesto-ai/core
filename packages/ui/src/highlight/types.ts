/**
 * Highlight Action Types
 *
 * Types for the highlight system used by AI agents to guide users
 * through form interactions and demonstrate visibility changes.
 */

/**
 * Types of highlight effects available
 */
export type HighlightType = 'value-change' | 'visibility-change' | 'dependency-chain'

/**
 * Intensity levels for highlight effects
 */
export type HighlightIntensity = 'subtle' | 'normal' | 'strong'

/**
 * Configuration for a single highlight action
 */
export interface HighlightConfig {
  /** Type of highlight effect to apply */
  type: HighlightType
  /** Path to the field or section to highlight */
  fieldPath: string
  /** Duration in milliseconds before auto-clear (default: 2000) */
  duration?: number
  /** Intensity of the highlight effect (default: 'normal') */
  intensity?: HighlightIntensity
  /** Delay between items in a chain highlight (default: 150ms) */
  chainDelay?: number
}

/**
 * Current state of a highlight on a specific field
 */
export interface HighlightState {
  /** Whether the highlight is currently active */
  active: boolean
  /** Type of highlight effect */
  type: HighlightType
  /** Timestamp when the highlight started */
  startedAt: number
  /** Original configuration */
  config: HighlightConfig
}

/**
 * Listener callback for highlight state changes
 */
export type HighlightListener = (fieldPath: string, state: HighlightState | null) => void

/**
 * Context interface for components to interact with the highlight system
 */
export interface HighlightActionContext {
  /** Apply a highlight to a single field */
  highlight(config: HighlightConfig): void
  /** Apply highlights to multiple fields in sequence (cascade effect) */
  highlightChain(fieldPaths: string[], type?: HighlightType, options?: Partial<HighlightConfig>): void
  /** Clear highlight from a specific field or all fields */
  clearHighlight(fieldPath?: string): void
  /** Get current highlight state for a field */
  getHighlightState(fieldPath: string): HighlightState | null
  /** Subscribe to highlight state changes */
  subscribe(listener: HighlightListener): () => void
}

/**
 * Data attributes applied to highlighted elements
 */
export interface HighlightDataAttributes {
  'data-highlight-type'?: HighlightType
  'data-highlight-intensity'?: HighlightIntensity
  'data-highlight-active'?: 'true'
}
