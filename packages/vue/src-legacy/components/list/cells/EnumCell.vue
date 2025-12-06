<script setup lang="ts">
/**
 * EnumCell - Enum 셀 렌더러
 *
 * enumMap을 통해 값 → 표시 라벨 매핑
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

const label = computed(() => {
  const strValue = String(props.value)
  return props.column.format?.enumMap?.[strValue] ?? strValue
})
</script>

<template>
  <span class="list-cell__enum">{{ label }}</span>
</template>
