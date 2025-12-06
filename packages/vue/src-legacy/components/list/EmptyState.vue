<script setup lang="ts">
/**
 * EmptyState - 빈 상태 표시 컴포넌트
 */
import type { EmptyStateConfig } from '@manifesto-ai/schema'

const props = withDefaults(
  defineProps<{
    config?: EmptyStateConfig
  }>(),
  {
    config: undefined,
  }
)

const emit = defineEmits<{
  action: []
}>()

const title = computed(() => props.config?.title ?? 'No data')
const description = computed(() => props.config?.description)
const icon = computed(() => props.config?.icon)
const actionLabel = computed(() => props.config?.action?.label)
</script>

<script lang="ts">
import { computed } from 'vue'
</script>

<template>
  <div class="list-empty-state">
    <div v-if="icon" class="list-empty-state__icon">
      <span>{{ icon }}</span>
    </div>
    <div class="list-empty-state__content">
      <h3 class="list-empty-state__title">{{ title }}</h3>
      <p v-if="description" class="list-empty-state__description">{{ description }}</p>
    </div>
    <button
      v-if="actionLabel"
      type="button"
      class="list-empty-state__action"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
