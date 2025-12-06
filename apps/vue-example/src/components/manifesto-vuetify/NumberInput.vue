<script setup lang="ts">
/**
 * NumberInput - Vuetify v-text-field type=number wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const hasError = computed(() => props.errors.length > 0)
const handleUpdate = (value: string | number | null) => {
  if (value === '' || value === null) {
    props.onChange(null)
  } else {
    props.onChange(Number(value))
  }
}
</script>

<template>
  <v-text-field
    :id="props.field.fieldId"
    type="number"
    :model-value="props.value"
    @update:model-value="handleUpdate"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :placeholder="props.field.placeholder"
    :error="hasError"
  />
</template>
