<script setup lang="ts">
/**
 * RadioInput - Vuetify v-radio-group wrapper
 */
import type { FieldComponentProps } from '@manifesto-ai/vue'
import { computed } from 'vue'

const props = defineProps<FieldComponentProps>()

const options = computed(() => props.field.state.options ?? [])
const hasError = computed(() => props.errors.length > 0)
const handleChange = (value: unknown) => props.onChange(value)
</script>

<template>
  <v-radio-group
    :id="props.field.fieldId"
    :model-value="props.value"
    @update:model-value="handleChange"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :error="hasError"
  >
    <v-radio
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :value="option.value"
      :disabled="option.disabled"
    />
  </v-radio-group>
</template>
