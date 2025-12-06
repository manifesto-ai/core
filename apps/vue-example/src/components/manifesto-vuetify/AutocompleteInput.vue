<script setup lang="ts">
/**
 * AutocompleteInput - Vuetify v-autocomplete wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const options = computed(() => props.field.state.options ?? [])
const hasError = computed(() => props.errors.length > 0)
const handleChange = (value: unknown) => props.onChange(value)
</script>

<template>
  <v-autocomplete
    :id="props.field.fieldId"
    :model-value="props.value"
    @update:model-value="handleChange"
    :items="options"
    item-title="label"
    item-value="value"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :placeholder="props.field.placeholder"
    :error="hasError"
    clearable
  />
</template>
