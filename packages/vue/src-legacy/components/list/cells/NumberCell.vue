<script setup lang="ts">
/**
 * NumberCell - 숫자 셀 렌더러
 *
 * 지원 포맷 옵션:
 * - decimals: 소수점 자릿수
 * - prefix: 접두사 (예: '$')
 * - suffix: 접미사 (예: '원')
 * - locale: 로케일 (예: 'ko-KR')
 * - style: 'decimal' | 'currency' | 'percent'
 * - currency: 통화 코드 (예: 'USD', 'KRW')
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

const formattedValue = computed(() => {
  if (props.value == null) return null

  const num = Number(props.value)
  if (isNaN(num)) return null

  const format = props.column.format?.numberFormat
  const locale = format?.locale ?? 'en-US'
  const decimals = format?.decimals
  const style = format?.style ?? 'decimal'

  let formatted: string

  if (style === 'currency' && format?.currency) {
    formatted = num.toLocaleString(locale, {
      style: 'currency',
      currency: format.currency,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
    })
  } else if (style === 'percent') {
    formatted = num.toLocaleString(locale, {
      style: 'percent',
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 2,
    })
  } else {
    formatted =
      decimals !== undefined
        ? num.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : num.toLocaleString(locale)
  }

  const prefix = format?.prefix ?? ''
  const suffix = format?.suffix ?? ''

  return `${prefix}${formatted}${suffix}`
})
</script>

<template>
  <span v-if="formattedValue != null" class="list-cell__number">{{ formattedValue }}</span>
  <span v-else class="list-cell__empty">-</span>
</template>
