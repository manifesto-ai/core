<template>
  <FieldWrapper v-bind="props">
    <input
      class="mvs-input"
      type="number"
      :placeholder="props.field.placeholder"
      :value="numberValue"
      :disabled="props.disabled"
      :readonly="props.readonly"
      @input="onInput"
    />
  </FieldWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FieldWrapper from './FieldWrapper.vue'
import type { FieldComponentProps } from '../../types'

const props = defineProps<FieldComponentProps>()

const numberValue = computed(() => {
  const v = props.value
  if (v === undefined || v === null || v === '') return ''
  return typeof v === 'number' ? v : Number(v)
})

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  props.onChange(target.value === '' ? null : Number(target.value))
}
</script>
