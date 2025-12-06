<script setup lang="ts">
/**
 * BooleanCell - Boolean 셀 렌더러
 *
 * true: ✓ (체크마크)
 * false: ✗ (X 마크)
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

const boolValue = computed(() => Boolean(props.value))
</script>

<template>
  <span :class="['list-cell__boolean', `list-cell__boolean--${boolValue}`]">
    {{ boolValue ? '\u2713' : '\u2717' }}
  </span>
</template>
