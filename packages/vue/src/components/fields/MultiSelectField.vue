<template>
  <FieldWrapper v-bind="props">
    <select
      class="mvs-select"
      multiple
      :value="selected"
      :disabled="props.disabled"
      :aria-readonly="props.readonly"
      @change="onChange"
    >
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
const selected = computed(() => (Array.isArray(props.value) ? props.value.map(String) : []))

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const values = Array.from(target.selectedOptions).map((opt) => opt.value)
  props.onChange(values)
}
</script>
