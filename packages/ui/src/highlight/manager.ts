/**
 * HighlightManager
 *
 * Central manager for highlight states across the form.
 * Handles timing, cascading, and state notifications.
 */

import type {
  HighlightConfig,
  HighlightState,
  HighlightListener,
  HighlightType,
  HighlightActionContext,
} from './types'

const DEFAULT_DURATION = 2000
const DEFAULT_CHAIN_DELAY = 150

export class HighlightManager implements HighlightActionContext {
  private highlights: Map<string, HighlightState> = new Map()
  private listeners: Set<HighlightListener> = new Set()
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  /**
   * Apply a highlight to a single field
   */
  highlight(config: HighlightConfig): void {
    const { fieldPath, duration = DEFAULT_DURATION } = config

    // Clear any existing highlight/timer on this field
    this.clearHighlight(fieldPath)

    const state: HighlightState = {
      active: true,
      type: config.type,
      startedAt: Date.now(),
      config,
    }

    this.highlights.set(fieldPath, state)
    this.notifyListeners(fieldPath, state)

    // Auto-clear after duration
    if (duration > 0) {
      const timer = setTimeout(() => {
        this.clearHighlight(fieldPath)
      }, duration)
      this.timers.set(fieldPath, timer)
    }
  }

  /**
   * Apply highlights to multiple fields in sequence (cascade effect)
   */
  highlightChain(
    fieldPaths: string[],
    type: HighlightType = 'dependency-chain',
    options: Partial<HighlightConfig> = {}
  ): void {
    const { chainDelay = DEFAULT_CHAIN_DELAY, duration = DEFAULT_DURATION, intensity } = options

    fieldPaths.forEach((fieldPath, index) => {
      setTimeout(() => {
        this.highlight({
          type,
          fieldPath,
          duration,
          intensity,
          chainDelay,
        })
      }, index * chainDelay)
    })
  }

  /**
   * Clear highlight from a specific field or all fields
   */
  clearHighlight(fieldPath?: string): void {
    if (fieldPath) {
      // Clear specific field
      const timer = this.timers.get(fieldPath)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(fieldPath)
      }

      if (this.highlights.has(fieldPath)) {
        this.highlights.delete(fieldPath)
        this.notifyListeners(fieldPath, null)
      }
    } else {
      // Clear all highlights
      for (const timer of this.timers.values()) {
        clearTimeout(timer)
      }
      this.timers.clear()

      const fieldPaths = Array.from(this.highlights.keys())
      this.highlights.clear()

      for (const path of fieldPaths) {
        this.notifyListeners(path, null)
      }
    }
  }

  /**
   * Get current highlight state for a field
   */
  getHighlightState(fieldPath: string): HighlightState | null {
    return this.highlights.get(fieldPath) ?? null
  }

  /**
   * Subscribe to highlight state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: HighlightListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of a state change
   */
  private notifyListeners(fieldPath: string, state: HighlightState | null): void {
    for (const listener of this.listeners) {
      try {
        listener(fieldPath, state)
      } catch (error) {
        console.error('[HighlightManager] Listener error:', error)
      }
    }
  }

  /**
   * Get all currently highlighted field paths
   */
  getActiveHighlights(): string[] {
    return Array.from(this.highlights.keys())
  }

  /**
   * Check if any highlights are active
   */
  hasActiveHighlights(): boolean {
    return this.highlights.size > 0
  }

  /**
   * Dispose of the manager and clear all state
   */
  dispose(): void {
    this.clearHighlight()
    this.listeners.clear()
  }
}

/**
 * Create a new HighlightManager instance
 */
export function createHighlightManager(): HighlightManager {
  return new HighlightManager()
}
