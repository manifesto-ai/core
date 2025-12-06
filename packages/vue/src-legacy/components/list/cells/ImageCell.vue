<script setup lang="ts">
/**
 * ImageCell - 이미지 셀 렌더러
 *
 * imageSize로 크기 지정 가능 (기본: 40x40)
 * lazy loading 지원
 */
import { computed } from 'vue'
import type { CellRendererProps } from '../../../types/list'

const props = defineProps<CellRendererProps>()

const src = computed(() => String(props.value ?? ''))
const width = computed(() => props.column.format?.imageSize?.width ?? 40)
const height = computed(() => props.column.format?.imageSize?.height ?? 40)
</script>

<template>
  <img
    v-if="value != null"
    :src="src"
    alt=""
    class="list-cell__image"
    :width="width"
    :height="height"
    loading="lazy"
  />
  <span v-else class="list-cell__empty">-</span>
</template>
