<template>
  <div class="mvs-field">
    <div v-if="field.label" class="mvs-field__label">{{ field.label }}</div>
    <slot />
    <div v-if="field.helpText" class="mvs-field__help">{{ field.helpText }}</div>
    <div v-if="errors.length" class="mvs-field__errors">
      <div v-for="(err, idx) in errors" :key="idx" class="mvs-field__error">
        {{ err }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FieldComponentProps } from '../../types'

defineProps<FieldComponentProps>()
</script>
