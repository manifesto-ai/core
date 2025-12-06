<script setup lang="ts">
/**
 * TextCell - 텍스트 셀 렌더러
 */
import type { CellRendererProps } from '../../../types/list'

defineProps<CellRendererProps>()
</script>

<template>
  <span v-if="value != null" class="list-cell__text">{{ String(value) }}</span>
  <span v-else class="list-cell__empty">-</span>
</template>
