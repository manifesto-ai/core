<template>
  <FieldWrapper v-bind="props">
    <input
      class="mvs-input mvs-input--color"
      type="color"
      :value="color"
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
const color = computed(() => (typeof props.value === 'string' ? props.value : '#000000'))

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  props.onChange(target.value)
}
</script>
