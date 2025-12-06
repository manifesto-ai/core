<script setup lang="ts">
/**
 * DataCell - CellRegistry를 사용한 셀 렌더링
 */
import {
  inject,
  computed,
  defineAsyncComponent,
  type Component,
} from 'vue'
import type { ListColumn } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'
import { CELL_REGISTRY_KEY } from '../../types/list'

const props = defineProps<{
  column: ListColumn
  columnMeta: ColumnMeta
  value: unknown
  row: Record<string, unknown>
  rowId: string
  rowIndex: number
}>()

const cellRegistry = inject(CELL_REGISTRY_KEY)

const CellComponent = computed(() => {
  const registration = cellRegistry?.value?.get(props.column.type)
  if (!registration) return null

  const component = registration.component

  // Handle async components
  if (typeof component === 'function') {
    return defineAsyncComponent(component as () => Promise<{ default: Component }>)
  }

  return component as Component
})

const cellClassName = computed(() => {
  const classes = ['list-row__cell', `list-row__cell--${props.column.type}`]
  if (props.column.align) {
    classes.push(`list-row__cell--align-${props.column.align}`)
  }
  return classes.join(' ')
})
</script>

<template>
  <td :class="cellClassName" :style="{ textAlign: column.align }" :data-column-id="column.id">
    <component
      :is="CellComponent"
      v-if="CellComponent"
      :column="column"
      :column-meta="columnMeta"
      :value="value"
      :row="row"
      :row-id="rowId"
      :row-index="rowIndex"
    />
    <span v-else>{{ value }}</span>
  </td>
</template>
