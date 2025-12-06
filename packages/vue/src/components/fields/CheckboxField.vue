<template>
  <FieldWrapper v-bind="props">
    <label class="mvs-checkbox">
      <input
        type="checkbox"
        :checked="Boolean(props.value)"
        :disabled="props.disabled || props.readonly"
        @change="onToggle"
      />
      <span>{{ props.field.label }}</span>
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
