<script setup lang="ts">
/**
 * ListToolbar - 검색, 필터, Bulk 액션 툴바
 */
import { ref, watch, computed, onUnmounted } from 'vue'
import type { BulkAction, FilterConfig } from '@manifesto-ai/schema'

const props = withDefaults(
  defineProps<{
    searchTerm: string
    filters: Readonly<Record<string, unknown>>
    filterConfig?: FilterConfig
    selectedCount: number
    bulkActions?: readonly BulkAction[]
  }>(),
  {
    filterConfig: undefined,
    bulkActions: () => [],
  }
)

const emit = defineEmits<{
  search: [term: string]
  filter: [fieldId: string, value: unknown]
  resetFilters: []
  bulkAction: [actionId: string]
}>()

const localSearchTerm = ref(props.searchTerm)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Sync local search term with prop
watch(
  () => props.searchTerm,
  (newValue) => {
    localSearchTerm.value = newValue
  }
)

const handleSearchChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const value = target.value
  localSearchTerm.value = value

  // Debounce search
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    emit('search', value)
  }, 300)
}

const handleSearchClear = () => {
  localSearchTerm.value = ''
  emit('search', '')
}

const handleBulkActionClick = (actionId: string) => {
  emit('bulkAction', actionId)
}

const handleResetFilters = () => {
  emit('resetFilters')
}

// Computed
const searchEnabled = computed(() => props.filterConfig?.searchable !== false)

const hasActiveFilters = computed(
  () => Object.keys(props.filters).length > 0 || props.searchTerm.length > 0
)

const availableBulkActions = computed(() =>
  (props.bulkActions ?? []).filter((action) => {
    const minSelection = action.minSelection ?? 1
    return props.selectedCount >= minSelection
  })
)

onUnmounted(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
})
</script>

<template>
  <div class="list-toolbar">
    <!-- Left section: Search and filters -->
    <div class="list-toolbar__left">
      <!-- Search input -->
      <div v-if="searchEnabled" class="list-toolbar__search">
        <input
          type="text"
          class="list-toolbar__search-input"
          :placeholder="filterConfig?.searchPlaceholder ?? 'Search...'"
          :value="localSearchTerm"
          aria-label="Search"
          @input="handleSearchChange"
        />
        <button
          v-if="localSearchTerm"
          type="button"
          class="list-toolbar__search-clear"
          aria-label="Clear search"
          @click="handleSearchClear"
        >
          &#10005;
        </button>
      </div>

      <!-- Reset filters button -->
      <button
        v-if="hasActiveFilters"
        type="button"
        class="list-toolbar__reset"
        @click="handleResetFilters"
      >
        Reset filters
      </button>
    </div>

    <!-- Right section: Bulk actions -->
    <div class="list-toolbar__right">
      <!-- Selection info -->
      <span v-if="selectedCount > 0" class="list-toolbar__selection-info">
        {{ selectedCount }} selected
      </span>

      <!-- Bulk action buttons -->
      <div v-if="availableBulkActions.length > 0" class="list-toolbar__bulk-actions">
        <button
          v-for="action in availableBulkActions"
          :key="action.id"
          type="button"
          :class="[
            'list-toolbar__bulk-btn',
            `list-toolbar__bulk-btn--${action.variant ?? 'secondary'}`,
          ]"
          :data-action-id="action.id"
          @click="handleBulkActionClick(action.id)"
        >
          <span v-if="action.icon" class="list-toolbar__bulk-icon">{{ action.icon }}</span>
          <span class="list-toolbar__bulk-label">{{ action.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
