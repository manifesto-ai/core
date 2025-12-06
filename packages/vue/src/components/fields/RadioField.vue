<template>
  <FieldWrapper v-bind="props">
    <div class="mvs-radio-group">
      <label v-for="opt in options" :key="opt.value" class="mvs-radio">
        <input
          type="radio"
          :value="opt.value"
          :checked="current === String(opt.value)"
          :disabled="props.disabled || props.readonly || opt.disabled"
          @change="onSelect(opt.value)"
        />
        <span>{{ opt.label }}</span>
      </label>
    </div>
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
  return String(v)
})

const onSelect = (value: unknown) => {
  props.onChange(value)
}
</script>
