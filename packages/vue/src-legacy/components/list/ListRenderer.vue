<script setup lang="ts">
/**
 * ListRenderer - 메인 리스트 렌더러 컴포넌트
 *
 * ListViewSchema를 받아 자동으로 리스트/테이블 UI를 렌더링
 * useListRuntime을 통해 상태 관리 통합
 */
import { provide, computed, toRef, watch } from 'vue'
import type { ListViewSchema } from '@manifesto-ai/schema'
import type {
  EvaluationContext,
  ListRuntimeError,
  FetchHandler,
  NavigateHandler,
  EmitHandler,
  ActionHandler,
} from '@manifesto-ai/engine'
import { useListRuntime } from '../../composables/useListRuntime'
import {
  LIST_RUNTIME_KEY,
  CELL_REGISTRY_KEY,
  LIST_SCHEMA_KEY,
  LIST_READONLY_KEY,
  LIST_ID_FIELD_KEY,
  type ICellRegistry,
} from '../../types/list'
import { createCellRegistry } from './CellRegistry'
import ListToolbar from './ListToolbar.vue'
import ListTable from './ListTable.vue'
import ListPagination from './ListPagination.vue'

const props = withDefaults(
  defineProps<{
    /** ListView 스키마 */
    schema: ListViewSchema
    /** 평가 컨텍스트 */
    context?: Partial<EvaluationContext>
    /** 행 ID 필드명 */
    idField?: string
    /** 읽기 전용 모드 */
    readonly?: boolean
    /** API fetch 핸들러 */
    fetchHandler?: FetchHandler
    /** 네비게이션 핸들러 */
    navigateHandler?: NavigateHandler
    /** 이벤트 emit 핸들러 */
    emitHandler?: EmitHandler
    /** 액션 핸들러 */
    actionHandler?: ActionHandler
    /** 초기 데이터 */
    initialData?: readonly Record<string, unknown>[]
    /** 디버그 모드 */
    debug?: boolean
    /** 커스텀 Cell 레지스트리 */
    cellRegistry?: ICellRegistry
  }>(),
  {
    context: undefined,
    idField: 'id',
    readonly: false,
    fetchHandler: undefined,
    navigateHandler: undefined,
    emitHandler: undefined,
    actionHandler: undefined,
    initialData: undefined,
    debug: false,
    cellRegistry: undefined,
  }
)

const emit = defineEmits<{
  /** 행 클릭 */
  rowClick: [rowId: string, row: Record<string, unknown>]
  /** 행 액션 실행 */
  rowAction: [rowId: string, actionId: string, row: Record<string, unknown>]
  /** Bulk 액션 실행 */
  bulkAction: [actionId: string, selectedIds: string[]]
  /** 선택 변경 */
  selectionChange: [selectedIds: string[]]
  /** 페이지 변경 */
  pageChange: [page: number, pageSize: number]
  /** 정렬 변경 */
  sortChange: [field: string | null, direction: 'asc' | 'desc' | null]
  /** 검색어 변경 */
  searchChange: [term: string]
  /** 에러 발생 */
  error: [error: ListRuntimeError]
}>()

// Initialize runtime
const runtime = useListRuntime(toRef(() => props.schema), {
  context: props.context,
  idField: props.idField,
  fetchHandler: props.fetchHandler,
  navigateHandler: props.navigateHandler,
  emitHandler: props.emitHandler,
  actionHandler: props.actionHandler,
  initialData: props.initialData,
  debug: props.debug,
})

// Sync context changes to runtime
watch(
  () => props.context,
  (newContext) => {
    if (runtime.isInitialized.value && newContext) {
      runtime.setContext(newContext)
    }
  },
  { deep: true }
)

// Error callback
watch(
  () => runtime.error.value,
  (error) => {
    if (error) {
      emit('error', error)
    }
  }
)

// Selection change callback
watch(
  () => runtime.selectedIds.value,
  (selectedIds) => {
    emit('selectionChange', Array.from(selectedIds))
  }
)

// Page change callback
watch(
  [() => runtime.currentPage.value, () => runtime.pageSize.value],
  ([page, pageSize]) => {
    emit('pageChange', page, pageSize)
  }
)

// Sort change callback
watch(
  [() => runtime.sortField.value, () => runtime.sortDirection.value],
  ([field, direction]) => {
    emit('sortChange', field, direction)
  }
)

// Row click handler
const handleRowClick = (rowId: string, row: Record<string, unknown>) => {
  runtime.onRowClick(rowId, row)
  emit('rowClick', rowId, row)
}

// Row action handler
const handleRowAction = (rowId: string, actionId: string, row: Record<string, unknown>) => {
  runtime.onRowAction(rowId, actionId, row)
  emit('rowAction', rowId, actionId, row)
}

// Bulk action handler
const handleBulkAction = (actionId: string) => {
  runtime.onBulkAction(actionId)
  emit('bulkAction', actionId, Array.from(runtime.selectedIds.value))
}

// Search change handler
const handleSearch = (term: string) => {
  runtime.setSearch(term)
  emit('searchChange', term)
}

// Cell registry (use provided or default)
const cellRegistry = computed(() => props.cellRegistry ?? createCellRegistry())

// Provide to children
provide(LIST_RUNTIME_KEY, runtime)
provide(CELL_REGISTRY_KEY, cellRegistry)
provide(
  LIST_SCHEMA_KEY,
  computed(() => props.schema)
)
provide(LIST_READONLY_KEY, toRef(() => props.readonly))
provide(LIST_ID_FIELD_KEY, props.idField)

// Container class names
const containerClassName = computed(() => {
  const classes = ['list-renderer']
  if (props.readonly) classes.push('list-renderer--readonly')
  if (!runtime.isInitialized.value) classes.push('list-renderer--loading')
  if (runtime.error.value) classes.push('list-renderer--error')
  if (runtime.rows.value.length === 0 && runtime.isInitialized.value) {
    classes.push('list-renderer--empty')
  }
  return classes.join(' ')
})
</script>

<template>
  <div :class="containerClassName">
    <!-- Loading State -->
    <div v-if="!runtime.isInitialized.value" class="list-renderer__loading">
      <slot name="loading">
        <span>Loading...</span>
      </slot>
    </div>

    <!-- Error State -->
    <div v-else-if="runtime.error.value" class="list-renderer__error">
      <slot name="error" :error="runtime.error.value">
        <span class="list-renderer__error-message">
          {{ runtime.error.value.message ?? runtime.error.value.type }}
        </span>
      </slot>
    </div>

    <!-- List Content -->
    <template v-else>
      <!-- Header Slot -->
      <header v-if="$slots.header" class="list-renderer__header">
        <slot name="header" />
      </header>

      <!-- Toolbar -->
      <ListToolbar
        :search-term="runtime.searchTerm.value"
        :filters="runtime.filters.value"
        :filter-config="schema.filtering"
        :selected-count="runtime.selectedIds.value.size"
        :bulk-actions="schema.bulkActions"
        @search="handleSearch"
        @filter="runtime.setFilter"
        @reset-filters="runtime.resetFilters"
        @bulk-action="handleBulkAction"
      />

      <!-- Table -->
      <ListTable
        :rows="runtime.rows.value"
        :columns="schema.columns"
        :column-meta-map="runtime.columns.value"
        :id-field="idField"
        :selection="schema.selection"
        :selected-ids="runtime.selectedIds.value"
        :is-all-selected="runtime.isAllSelected.value"
        :is-indeterminate="runtime.isIndeterminate.value"
        :sort-field="runtime.sortField.value"
        :sort-direction="runtime.sortDirection.value"
        :empty-state="schema.emptyState"
        :is-row-selected="runtime.isRowSelected"
        @toggle-row="runtime.toggleRow"
        @select-all="runtime.selectAll"
        @deselect-all="runtime.deselectAll"
        @toggle-sort="runtime.toggleSort"
        @row-click="handleRowClick"
        @row-action="handleRowAction"
      />

      <!-- Pagination -->
      <ListPagination
        :current-page="runtime.currentPage.value"
        :page-size="runtime.pageSize.value"
        :total-pages="runtime.totalPages.value"
        :total-count="runtime.totalCount.value"
        :config="schema.pagination"
        @page-change="runtime.setPage"
        @page-size-change="runtime.setPageSize"
      />
    </template>

    <!-- Debug info -->
    <pre v-if="debug && runtime.isInitialized.value" class="list-renderer__debug">{{
      JSON.stringify(runtime.getState(), null, 2)
    }}</pre>
  </div>
</template>
