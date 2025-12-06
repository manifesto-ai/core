<script setup lang="ts">
/**
 * BadgeCell - 뱃지 셀 렌더러
 *
 * badgeMap을 통해 값에 따른 라벨과 variant 설정
 * variant: success, warning, error, info, default
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

const badgeConfig = computed(() => {
  const strValue = String(props.value)
  return props.column.format?.badgeMap?.[strValue]
})

const label = computed(() => badgeConfig.value?.label ?? String(props.value))
const variant = computed(() => badgeConfig.value?.variant ?? '')

const badgeStyle = computed(() => {
  // variant가 없으면 inline style 사용 (하위 호환)
  if (variant.value) return {}

  const config = badgeConfig.value
  const style: Record<string, string> = {}

  if (config?.color) style.color = config.color
  if (config?.bgColor) style.backgroundColor = config.bgColor

  return style
})

const badgeClass = computed(() => {
  const classes = ['list-cell__badge']
  if (variant.value) {
    classes.push(`list-cell__badge--${variant.value}`)
  }
  return classes.join(' ')
})
</script>

<template>
  <span :class="badgeClass" :style="badgeStyle">{{ label }}</span>
</template>
