<template>
  <FieldWrapper v-bind="props">
    <input
      class="mvs-input mvs-input--slider"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="numericValue"
      :disabled="props.disabled"
      :readonly="props.readonly"
      @input="onInput"
    />
    <div class="mvs-slider__value">{{ numericValue }}</div>
  </FieldWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FieldWrapper from './FieldWrapper.vue'
import type { FieldComponentProps } from '../../types'

const props = defineProps<FieldComponentProps>()

const min = computed(() => (props.field.state.props?.min as number | undefined) ?? 0)
const max = computed(() => (props.field.state.props?.max as number | undefined) ?? 100)
const step = computed(() => (props.field.state.props?.step as number | undefined) ?? 1)
const numericValue = computed(() => (typeof props.value === 'number' ? props.value : 0))

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  props.onChange(Number(target.value))
}
</script>
