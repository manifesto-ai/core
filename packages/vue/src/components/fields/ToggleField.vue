<template>
  <FieldWrapper v-bind="props">
    <label class="mvs-toggle">
      <input
        type="checkbox"
        :checked="Boolean(props.value)"
        :disabled="props.disabled || props.readonly"
        @change="onToggle"
      />
      <span class="mvs-toggle__track"><span class="mvs-toggle__thumb" /></span>
      <span class="mvs-toggle__label">{{ props.field.label }}</span>
    </label>
  </FieldWrapper>
</template>

<script setup lang="ts">
import FieldWrapper from './FieldWrapper.vue'
import type { FieldComponentProps } from '../../types'

const props = defineProps<FieldComponentProps>()

const onToggle = (event: Event) => {
  const target = event.target as HTMLInputElement
  props.onChange(target.checked)
}
</script>
