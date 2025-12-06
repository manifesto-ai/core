<script setup lang="ts">
/**
 * DatePickerInput - Vuetify v-date-input wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const hasError = computed(() => props.errors.length > 0)

// Vuetify date-input uses Date object or string
const dateValue = computed(() => {
  if (!props.value) return null
  return new Date(props.value as string)
})

const handleUpdate = (value: Date | null) => {
  if (!value) {
    props.onChange(null)
  } else {
    // Convert to ISO date string (YYYY-MM-DD)
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    props.onChange(`${year}-${month}-${day}`)
  }
}
</script>

<template>
  <v-date-input
    :id="props.field.fieldId"
    :model-value="dateValue"
    @update:model-value="handleUpdate"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :placeholder="props.field.placeholder"
    :error="hasError"
    prepend-icon=""
    prepend-inner-icon="mdi-calendar"
  />
</template>
