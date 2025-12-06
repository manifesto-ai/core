/**
 * useHighlight Composable
 *
 * Vue composable for subscribing to highlight state changes on a specific field.
 * Used by FieldRenderer and SectionRenderer to apply highlight data attributes.
 */

import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import type { Ref, ComputedRef, InjectionKey } from 'vue'
import type { HighlightState, HighlightDataAttributes, HighlightManager } from '@manifesto-ai/ui'

/**
 * Injection key for the HighlightManager
 */
export const HighlightSymbol: InjectionKey<HighlightManager> = Symbol('HighlightManager')

export interface UseHighlightResult {
  /** Current highlight state for this field, or null if not highlighted */
  highlightState: Ref<HighlightState | null>
  /** Data attributes to bind on the element for CSS styling */
  dataAttributes: ComputedRef<HighlightDataAttributes>
  /** Whether the field is currently highlighted */
  isHighlighted: ComputedRef<boolean>
}

/**
 * Subscribe to highlight state for a specific field path
 *
 * @param fieldPath - The field path to monitor for highlights
 * @returns Highlight state and data attributes for the field
 *
 * @example
 * ```vue
 * <script setup>
 * const { dataAttributes } = useHighlight(props.fieldId)
 * </script>
 *
 * <template>
 *   <div v-bind="dataAttributes">...</div>
 * </template>
 * ```
 */
export function useHighlight(fieldPath: string): UseHighlightResult {
  const manager = inject(HighlightSymbol, null)
  const highlightState = ref<HighlightState | null>(null)

  const dataAttributes = computed<HighlightDataAttributes>(() => {
    const state = highlightState.value
    if (!state || !state.active) {
      return {}
    }

    return {
      'data-highlight-type': state.type,
      'data-highlight-intensity': state.config.intensity ?? 'normal',
      'data-highlight-active': 'true',
    }
  })

  const isHighlighted = computed(() => !!highlightState.value?.active)

  onMounted(() => {
    if (!manager) return

    // Get initial state
    highlightState.value = manager.getHighlightState(fieldPath)

    // Subscribe to changes
    const unsubscribe = manager.subscribe((path, newState) => {
      if (path === fieldPath) {
        highlightState.value = newState
      }
    })

    onUnmounted(unsubscribe)
  })

  return {
    highlightState,
    dataAttributes,
    isHighlighted,
  }
}

/**
 * Get the highlight manager from context for programmatic control
 *
 * @returns The HighlightManager from context, or null if not provided
 *
 * @example
 * ```vue
 * <script setup>
 * const highlightManager = useHighlightContext()
 *
 * const handleDemo = () => {
 *   highlightManager?.highlight({
 *     type: 'value-change',
 *     fieldPath: 'email',
 *     duration: 2000
 *   })
 * }
 * </script>
 * ```
 */
export function useHighlightContext(): HighlightManager | null {
  return inject(HighlightSymbol, null)
}
