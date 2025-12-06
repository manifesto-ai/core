<script setup lang="ts">
/**
 * DateCell - 날짜 셀 렌더러
 *
 * 지원 포맷: yyyy-MM-dd (기본)
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

function formatDate(date: Date, format: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())

  return format
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
}

const formattedValue = computed(() => {
  if (props.value == null) return null

  let date: Date

  if (props.value instanceof Date) {
    date = props.value
  } else if (typeof props.value === 'string' || typeof props.value === 'number') {
    date = new Date(props.value)
  } else {
    return null
  }

  if (isNaN(date.getTime())) return null

  const formatString = props.column.format?.dateFormat ?? 'yyyy-MM-dd'
  return formatDate(date, formatString)
})
</script>

<template>
  <span v-if="formattedValue != null" class="list-cell__date">{{ formattedValue }}</span>
  <span v-else class="list-cell__empty">-</span>
</template>
