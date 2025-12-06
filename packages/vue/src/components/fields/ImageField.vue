<template>
  <FieldWrapper v-bind="props">
    <input type="file" accept="image/*" :disabled="props.disabled || props.readonly" @change="onChangeFile" />
    <img v-if="src" :src="src" :alt="props.field.label ?? props.field.id" class="mvs-image__preview" />
  </FieldWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FieldWrapper from './FieldWrapper.vue'
import type { FieldComponentProps } from '../../types'

const props = defineProps<FieldComponentProps>()
const src = computed(() => (typeof props.value === 'string' ? props.value : undefined))

const onChangeFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  props.onChange(file)
}
</script>
