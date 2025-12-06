<script setup lang="ts">
// HighlightProvider - Vue component provider for the highlight system.
// Wrap your form with this provider to enable highlight functionality.

import { provide, onUnmounted, computed } from 'vue'
import { createHighlightManager, type HighlightManager } from '@manifesto-ai/ui'
import { HighlightSymbol } from '../composables/useHighlight'

interface Props {
  // Optional external HighlightManager instance.
  // If not provided, a new instance will be created.
  manager?: HighlightManager
}

const props = defineProps<Props>()

// Create internal manager if not provided
const internalManager = props.manager ? null : createHighlightManager()
const highlightManager = computed(() => props.manager ?? internalManager!)

// Provide the manager to child components
provide(HighlightSymbol, highlightManager.value)

// Cleanup on unmount (only for internally created manager)
onUnmounted(() => {
  if (internalManager) {
    internalManager.dispose()
  }
})
</script>

<template>
  <slot />
</template>
