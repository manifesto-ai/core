<script setup lang="ts">
/**
 * LinkCell - 링크 셀 렌더러
 *
 * linkTemplate으로 URL 템플릿 지정 가능 (예: '/users/{value}')
 * 값이 이미 URL이면 그대로 사용
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

const strValue = computed(() => String(props.value ?? ''))

const linkHref = computed(() => {
  const template = props.column.format?.linkTemplate

  if (template) {
    return template.replace('{value}', encodeURIComponent(strValue.value))
  }

  // 값이 이미 URL인 경우
  if (strValue.value.startsWith('http://') || strValue.value.startsWith('https://')) {
    return strValue.value
  }

  return null
})

const isExternalLink = computed(() => {
  return strValue.value.startsWith('http://') || strValue.value.startsWith('https://')
})
</script>

<template>
  <a
    v-if="linkHref"
    :href="linkHref"
    class="list-cell__link"
    :target="isExternalLink ? '_blank' : undefined"
    :rel="isExternalLink ? 'noopener noreferrer' : undefined"
  >
    {{ strValue }}
  </a>
  <span v-else class="list-cell__link">{{ strValue }}</span>
</template>
