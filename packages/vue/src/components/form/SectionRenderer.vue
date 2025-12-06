<template>
  <!-- Skip rendering if section is hidden -->
  <section
    v-if="!section.hidden"
    class="mvs-section"
    :data-section-id="section.id"
    v-bind="highlightAttrs"
  >
    <header v-if="section.title || section.description" class="mvs-section__header">
      <h3 v-if="section.title" class="mvs-section__title">{{ section.title }}</h3>
      <p v-if="section.description" class="mvs-section__description">{{ section.description }}</p>
    </header>
    <div class="mvs-section__fields">
      <template v-for="field in section.fields" :key="field.id">
        <slot name="field" :field="field">
          <FieldRenderer
            :node="field"
            :readonly="readonly"
            :live-validators="liveValidators"
            @change="(v) => onChange(field.fieldId, v)"
          />
        </slot>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import FieldRenderer from './FieldRenderer.vue'
import type { ResolvedSectionSemanticNode } from '@manifesto-ai/ui'
import type { FieldRendererComponent } from '../../types'
import { useHighlight } from '../../composables/useHighlight'

const props = defineProps<{
  section: ResolvedSectionSemanticNode<FieldRendererComponent>
  readonly?: boolean
  onChange: (fieldId: string, value: unknown) => void
  liveValidators?: ReadonlyMap<string, readonly import('@manifesto-ai/ui').LightweightValidator[]>
}>()

// Highlight support for sections
const { dataAttributes: highlightAttrs } = useHighlight(`section:${props.section.id}`)
</script>
