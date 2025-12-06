<script setup lang="ts">
/**
 * SliderInput - Vuetify v-slider wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const hasError = computed(() => props.errors.length > 0)
const fieldProps = computed(() => props.field.state.props ?? {})
const min = computed(() => (fieldProps.value.min as number) ?? 0)
const max = computed(() => (fieldProps.value.max as number) ?? 100)
const step = computed(() => (fieldProps.value.step as number) ?? 1)
const showValue = computed(() => (fieldProps.value.showValue as boolean) ?? true)
const handleChange = (value: unknown) => props.onChange(value)
</script>

<template>
  <v-slider
    :id="props.field.fieldId"
    :model-value="props.value as number"
    @update:model-value="handleChange"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :error="hasError"
    :min="min"
    :max="max"
    :step="step"
    :thumb-label="showValue ? 'always' : false"
    color="primary"
  />
</template>
