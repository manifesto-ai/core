<script setup lang="ts">
/**
 * TextareaInput - Vuetify v-textarea wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const hasError = computed(() => props.errors.length > 0)
const fieldProps = computed(() => props.field.state.props ?? {})
const rows = computed(() => (fieldProps.value.rows as number) ?? 3)
const handleChange = (value: unknown) => props.onChange(value)
</script>

<template>
  <v-textarea
    :id="props.field.fieldId"
    :model-value="props.value"
    @update:model-value="handleChange"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :placeholder="props.field.placeholder"
    :error="hasError"
    :rows="rows"
  />
</template>
