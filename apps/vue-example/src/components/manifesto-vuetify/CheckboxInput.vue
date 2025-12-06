<script setup lang="ts">
/**
 * CheckboxInput - Vuetify v-checkbox wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const hasError = computed(() => props.errors.length > 0)
const fieldProps = computed(() => props.field.state.props ?? {})
const label = computed(() => (fieldProps.value.label as string) || props.field.label)
const handleChange = (value: unknown) => props.onChange(value ?? false)
</script>

<template>
  <v-checkbox
    :id="props.field.fieldId"
    :model-value="props.value"
    @update:model-value="handleChange"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :error="hasError"
    :label="label"
  />
</template>
