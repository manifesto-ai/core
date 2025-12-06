<script setup lang="ts">
/**
 * ToggleInput - Vuetify v-switch wrapper
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
  <v-switch
    :id="props.field.fieldId"
    :model-value="props.value"
    @update:model-value="handleChange"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :error="hasError"
    :label="label"
    color="primary"
  />
</template>
