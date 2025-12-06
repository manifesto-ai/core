<template>
  <FieldWrapper v-bind="props">
    <input type="file" :disabled="props.disabled || props.readonly" @change="onChangeFile" />
    <div v-if="typeof props.value === 'string'" class="mvs-file__name">{{ props.value }}</div>
  </FieldWrapper>
</template>

<script setup lang="ts">
import FieldWrapper from './FieldWrapper.vue'
import type { FieldComponentProps } from '../../types'

const props = defineProps<FieldComponentProps>()

const onChangeFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  props.onChange(file)
}
</script>
