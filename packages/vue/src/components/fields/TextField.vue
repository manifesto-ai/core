<template>
  <FieldWrapper v-bind="props">
    <input
      class="mvs-input"
      type="text"
      :placeholder="props.field.placeholder"
      :value="stringValue"
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

const stringValue = computed(() => {
  const v = props.value
  return v === undefined || v === null ? '' : String(v)
})

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  props.onChange(target.value)
}
</script>
