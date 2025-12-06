<template>
  <FieldWrapper v-bind="props">
    <select
      class="mvs-select"
      :value="current"
      :disabled="props.disabled"
      :aria-readonly="props.readonly"
      @change="onChange"
    >
      <option value="">{{ props.field.placeholder ?? '선택하세요' }}</option>
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.label }}
      </option>
    </select>
  </FieldWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FieldWrapper from './FieldWrapper.vue'
import type { FieldComponentProps } from '../../types'

const props = defineProps<FieldComponentProps>()

const options = computed(() => props.field.state.options ?? [])
const current = computed(() => {
  const v = props.value
  if (v === undefined || v === null) return ''
  return v
})

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  props.onChange(target.value === '' ? null : target.value)
}
</script>
