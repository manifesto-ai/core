<template>
  <!-- Hidden filtering is done at SemanticTree level via includeHidden option.
       If the node reaches here, it should be rendered (possibly with hidden styling). -->
  <div
    class="mvs-field-row"
    :data-field-id="node.fieldId"
    :data-hidden="node.state.hidden ? 'true' : undefined"
    :style="node.state.hidden ? { display: 'none' } : undefined"
    v-bind="highlightAttrs"
  >
    <component
      :is="renderer"
      :field="node"
      :value="node.state.value"
      :disabled="node.state.disabled"
      :readonly="readonly"
      :errors="combinedErrors"
      :live-errors="liveErrors"
      :onChange="(value: unknown) => emitChange(value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ResolvedFieldSemanticNode, LightweightValidator } from '@manifesto-ai/ui'
import type { FieldRendererComponent } from '../../types'
import CustomField from '../fields/CustomField.vue'
import { useHighlight } from '../../composables/useHighlight'

const props = defineProps<{
  node: ResolvedFieldSemanticNode<FieldRendererComponent>
  readonly?: boolean
  liveValidators?: ReadonlyMap<string, readonly LightweightValidator[]>
}>()

const emit = defineEmits<{
  (e: 'change', value: unknown): void
}>()

const renderer = computed(() => props.node.renderer ?? CustomField)

// Highlight support
const { dataAttributes: highlightAttrs } = useHighlight(props.node.fieldId)

const liveErrors = computed(() => {
  const validators = props.liveValidators?.get(props.node.fieldId) ?? props.node.state.liveValidators
  if (!validators) return []
  return validators
    .map((v) => (v.test(props.node.state.value) ? null : v.message))
    .filter((msg): msg is string => Boolean(msg))
})

const combinedErrors = computed(() => [...(props.node.state.errors ?? []), ...liveErrors.value])

const emitChange = (value: unknown) => {
  emit('change', value)
}
</script>
