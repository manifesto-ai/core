<script setup lang="ts">
/**
 * ListHeaderRow - 테이블 헤더 행 (정렬, 전체선택)
 */
import { computed, ref, watchEffect } from 'vue'
import type { ListColumn, SelectionConfig } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'

const props = defineProps<{
  columns: readonly ListColumn[]
  columnMetaMap: ReadonlyMap<string, ColumnMeta>
  selection?: SelectionConfig
  isAllSelected: boolean
  isIndeterminate: boolean
  sortField: string | null
  sortDirection: 'asc' | 'desc' | null
}>()

const emit = defineEmits<{
  selectAll: []
  deselectAll: []
  toggleSort: [field: string]
}>()

// Checkbox indeterminate handling
const checkboxRef = ref<HTMLInputElement | null>(null)

watchEffect(() => {
  if (checkboxRef.value) {
    checkboxRef.value.indeterminate = props.isIndeterminate
  }
})

const handleSelectAllChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.checked) {
    emit('selectAll')
  } else {
    emit('deselectAll')
  }
}

const handleColumnClick = (columnId: string, sortable?: boolean) => {
  if (sortable) {
    emit('toggleSort', columnId)
  }
}

const hasActionsColumn = computed(() => props.columns.some((col) => col.type === 'actions'))

const getCellClassName = (column: ListColumn) => {
  const isSorted = props.sortField === column.id
  const sortable = column.sortable !== false

  const classes = ['list-header-row__cell']
  if (sortable) classes.push('list-header-row__cell--sortable')
  if (isSorted && props.sortDirection === 'asc') {
    classes.push('list-header-row__cell--sorted-asc')
  }
  if (isSorted && props.sortDirection === 'desc') {
    classes.push('list-header-row__cell--sorted-desc')
  }
  if (column.align) {
    classes.push(`list-header-row__cell--align-${column.align}`)
  }
  return classes.join(' ')
}

const getCellStyle = (column: ListColumn) => {
  const style: Record<string, string> = {}
  if (column.width) {
    style.width = typeof column.width === 'number' ? `${column.width}px` : column.width
  }
  if (column.minWidth) style.minWidth = `${column.minWidth}px`
  if (column.maxWidth) style.maxWidth = `${column.maxWidth}px`
  return style
}

const getSortIcon = (column: ListColumn) => {
  const isSorted = props.sortField === column.id
  if (isSorted) {
    return props.sortDirection === 'asc' ? '\u25B2' : '\u25BC'
  }
  return '\u25B4\u25BE'
}
</script>

<template>
  <tr class="list-header-row">
    <!-- Select All checkbox -->
    <th
      v-if="selection?.enabled !== false"
      class="list-header-row__cell list-header-row__cell--checkbox"
    >
      <input
        ref="checkboxRef"
        type="checkbox"
        :checked="isAllSelected"
        aria-label="Select all rows"
        @change="handleSelectAllChange"
      />
    </th>

    <!-- Column headers -->
    <template v-for="column in columns" :key="column.id">
      <th
        v-if="column.type !== 'actions' && !columnMetaMap.get(column.id)?.hidden"
        :class="getCellClassName(column)"
        :style="getCellStyle(column)"
        :data-column-id="column.id"
        :aria-sort="
          sortField === column.id
            ? sortDirection === 'asc'
              ? 'ascending'
              : 'descending'
            : undefined
        "
        @click="handleColumnClick(column.id, column.sortable !== false)"
      >
        <div class="list-header-row__content">
          <span class="list-header-row__label">{{ column.label }}</span>
          <span v-if="column.sortable !== false" class="list-header-row__sort-icon">
            {{ getSortIcon(column) }}
          </span>
        </div>
      </th>
    </template>

    <!-- Actions header -->
    <th
      v-if="hasActionsColumn"
      class="list-header-row__cell list-header-row__cell--actions"
    >
      Actions
    </th>
  </tr>
</template>
