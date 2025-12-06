<script setup lang="ts">
/**
 * ListTable - 테이블 컨테이너 컴포넌트
 */
import type { ListColumn, SelectionConfig, EmptyStateConfig } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'
import ListHeaderRow from './ListHeaderRow.vue'
import ListRow from './ListRow.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps<{
  rows: readonly Record<string, unknown>[]
  columns: readonly ListColumn[]
  columnMetaMap: ReadonlyMap<string, ColumnMeta>
  idField: string
  selection?: SelectionConfig
  selectedIds: ReadonlySet<string>
  isAllSelected: boolean
  isIndeterminate: boolean
  sortField: string | null
  sortDirection: 'asc' | 'desc' | null
  emptyState?: EmptyStateConfig
  isRowSelected: (rowId: string) => boolean
}>()

const emit = defineEmits<{
  toggleRow: [rowId: string]
  selectAll: []
  deselectAll: []
  toggleSort: [field: string]
  rowClick: [rowId: string, row: Record<string, unknown>]
  rowAction: [rowId: string, actionId: string, row: Record<string, unknown>]
}>()

const getRowId = (row: Record<string, unknown>, index: number): string => {
  return String(row[props.idField] ?? index)
}
</script>

<template>
  <!-- Empty State -->
  <div v-if="rows.length === 0" class="list-table list-table--empty">
    <EmptyState :config="emptyState" />
  </div>

  <!-- Table -->
  <div v-else class="list-table">
    <table class="list-table__table">
      <thead class="list-table__header">
        <ListHeaderRow
          :columns="columns"
          :column-meta-map="columnMetaMap"
          :selection="selection"
          :is-all-selected="isAllSelected"
          :is-indeterminate="isIndeterminate"
          :sort-field="sortField"
          :sort-direction="sortDirection"
          @select-all="emit('selectAll')"
          @deselect-all="emit('deselectAll')"
          @toggle-sort="emit('toggleSort', $event)"
        />
      </thead>
      <tbody class="list-table__body">
        <ListRow
          v-for="(row, index) in rows"
          :key="getRowId(row, index)"
          :row-id="getRowId(row, index)"
          :row="row as Record<string, unknown>"
          :row-index="index"
          :columns="columns"
          :column-meta-map="columnMetaMap"
          :selection="selection"
          :is-selected="isRowSelected(getRowId(row, index))"
          @toggle-row="emit('toggleRow', $event)"
          @row-click="emit('rowClick', $event, row as Record<string, unknown>)"
          @row-action="
            (rowId, actionId, rowData) => emit('rowAction', rowId, actionId, rowData)
          "
        />
      </tbody>
    </table>
  </div>
</template>
