<script setup lang="ts">
/**
 * TextInput - Vuetify v-text-field wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const hasError = computed(() => props.errors.length > 0)
const handleChange = (value: unknown) => props.onChange(value)
</script>

<template>
  <v-text-field
    :id="props.field.fieldId"
    :model-value="props.value"
    @update:model-value="handleChange"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :placeholder="props.field.placeholder"
    :error="hasError"
  />
</template>
