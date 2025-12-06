<script setup lang="ts">
/**
 * ListRow - 데이터 행 컴포넌트
 */
import { computed } from 'vue'
import type { ListColumn, SelectionConfig } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'
import DataCell from './DataCell.vue'
import ActionCell from './ActionCell.vue'

const props = defineProps<{
  rowId: string
  row: Record<string, unknown>
  rowIndex: number
  columns: readonly ListColumn[]
  columnMetaMap: ReadonlyMap<string, ColumnMeta>
  selection?: SelectionConfig
  isSelected: boolean
}>()

const emit = defineEmits<{
  toggleRow: [rowId: string]
  rowClick: [rowId: string, row: Record<string, unknown>]
  rowAction: [rowId: string, actionId: string, row: Record<string, unknown>]
}>()

const handleCheckboxChange = (e: Event) => {
  e.stopPropagation()
  emit('toggleRow', props.rowId)
}

const handleRowClick = (e: MouseEvent) => {
  // Don't trigger row click for checkbox or action cells
  const target = e.target as HTMLElement
  if (
    target.closest('.list-row__cell--checkbox') ||
    target.closest('.list-row__cell--actions')
  ) {
    return
  }
  emit('rowClick', props.rowId, props.row)
}

const handleRowAction = (rowId: string, actionId: string, row: Record<string, unknown>) => {
  emit('rowAction', rowId, actionId, row)
}

const rowClassName = computed(() => {
  const classes = ['list-row']
  if (props.isSelected) classes.push('list-row--selected')
  if (props.rowIndex % 2 === 1) classes.push('list-row--odd')
  return classes.join(' ')
})

const actionsColumn = computed(() => props.columns.find((col) => col.type === 'actions'))
</script>

<template>
  <tr :class="rowClassName" :data-row-id="rowId" @click="handleRowClick">
    <!-- Selection checkbox -->
    <td v-if="selection?.enabled !== false" class="list-row__cell list-row__cell--checkbox">
      <input
        type="checkbox"
        :checked="isSelected"
        :aria-label="`Select row ${rowIndex + 1}`"
        @change="handleCheckboxChange"
      />
    </td>

    <!-- Data cells -->
    <template v-for="columnSchema in columns" :key="columnSchema.id">
      <DataCell
        v-if="
          columnSchema.type !== 'actions' && !columnMetaMap.get(columnSchema.id)?.hidden
        "
        :column="columnSchema"
        :column-meta="columnMetaMap.get(columnSchema.id)!"
        :value="row[columnSchema.entityFieldId]"
        :row="row"
        :row-id="rowId"
        :row-index="rowIndex"
      />
    </template>

    <!-- Actions cell -->
    <ActionCell
      v-if="actionsColumn"
      :row-id="rowId"
      :row="row"
      :actions="actionsColumn.actions ?? []"
      @action="handleRowAction"
    />
  </tr>
</template>
