<script setup lang="ts">
/**
 * ListPagination - 페이지네이션 컨트롤
 */
import { computed } from 'vue'
import type { PaginationConfig } from '@manifesto-ai/schema'

const props = withDefaults(
  defineProps<{
    currentPage: number
    pageSize: number
    totalPages: number
    totalCount: number
    config?: PaginationConfig
  }>(),
  {
    config: undefined,
  }
)

const emit = defineEmits<{
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
}>()

// Config options
const pageSizeOptions = computed(() => props.config?.pageSizeOptions ?? [10, 20, 50, 100])
const showTotal = computed(() => props.config?.showTotal !== false)
const showPageSize = computed(() => props.config?.showPageSize !== false)
const showQuickJumper = computed(() => props.config?.showQuickJumper ?? false)

const canGoPrev = computed(() => props.currentPage > 1)
const canGoNext = computed(() => props.currentPage < props.totalPages)

const handleFirstPage = () => {
  if (canGoPrev.value) emit('pageChange', 1)
}

const handlePrevPage = () => {
  if (canGoPrev.value) emit('pageChange', props.currentPage - 1)
}

const handleNextPage = () => {
  if (canGoNext.value) emit('pageChange', props.currentPage + 1)
}

const handleLastPage = () => {
  if (canGoNext.value) emit('pageChange', props.totalPages)
}

const handlePageSizeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  const newSize = Number(target.value)
  emit('pageSizeChange', newSize)
}

const handleQuickJump = (e: Event) => {
  const target = e.target as HTMLInputElement
  const page = Number(target.value)
  if (page >= 1 && page <= props.totalPages) {
    emit('pageChange', page)
  }
}

// Calculate visible range
const startItem = computed(() => (props.currentPage - 1) * props.pageSize + 1)
const endItem = computed(() => Math.min(props.currentPage * props.pageSize, props.totalCount))

// Generate page buttons (max 5 visible)
const pageButtons = computed(() => {
  const buttons: number[] = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  const end = Math.min(props.totalPages, start + maxVisible - 1)

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    buttons.push(i)
  }
  return buttons
})

const firstPageButton = computed<number | null>(() => {
  if (pageButtons.value.length === 0) return null
  return pageButtons.value[0]!
})

const lastPageButton = computed<number | null>(() => {
  if (pageButtons.value.length === 0) return null
  return pageButtons.value[pageButtons.value.length - 1]!
})

// Check if pagination is enabled
const isEnabled = computed(() => props.config?.enabled !== false)
</script>

<template>
  <div v-if="isEnabled" class="list-pagination">
    <!-- Total info -->
    <div v-if="showTotal" class="list-pagination__info">
      <span>{{ startItem }}-{{ endItem }} of {{ totalCount }}</span>
    </div>

    <!-- Page size selector -->
    <div v-if="showPageSize" class="list-pagination__page-size">
      <label for="page-size">Rows per page:</label>
      <select id="page-size" :value="pageSize" @change="handlePageSizeChange">
        <option v-for="size in pageSizeOptions" :key="size" :value="size">
          {{ size }}
        </option>
      </select>
    </div>

    <!-- Page navigation -->
    <div class="list-pagination__controls">
      <!-- First page -->
      <button
        type="button"
        class="list-pagination__btn list-pagination__btn--first"
        :disabled="!canGoPrev"
        aria-label="First page"
        @click="handleFirstPage"
      >
        &laquo;
      </button>

      <!-- Previous page -->
      <button
        type="button"
        class="list-pagination__btn list-pagination__btn--prev"
        :disabled="!canGoPrev"
        aria-label="Previous page"
        @click="handlePrevPage"
      >
        &lsaquo;
      </button>

      <!-- Page numbers -->
      <div class="list-pagination__pages">
        <template v-if="firstPageButton !== null && firstPageButton > 1">
          <button
            type="button"
            class="list-pagination__page"
            @click="emit('pageChange', 1)"
          >
            1
          </button>
          <span v-if="firstPageButton > 2" class="list-pagination__ellipsis">&hellip;</span>
        </template>

        <button
          v-for="page in pageButtons"
          :key="page"
          type="button"
          :class="[
            'list-pagination__page',
            { 'list-pagination__page--active': page === currentPage },
          ]"
          :aria-current="page === currentPage ? 'page' : undefined"
          @click="emit('pageChange', page)"
        >
          {{ page }}
        </button>

        <template
          v-if="lastPageButton !== null && lastPageButton < totalPages"
        >
          <span
            v-if="lastPageButton < totalPages - 1"
            class="list-pagination__ellipsis"
          >
            &hellip;
          </span>
          <button
            type="button"
            class="list-pagination__page"
            @click="emit('pageChange', totalPages)"
          >
            {{ totalPages }}
          </button>
        </template>
      </div>

      <!-- Next page -->
      <button
        type="button"
        class="list-pagination__btn list-pagination__btn--next"
        :disabled="!canGoNext"
        aria-label="Next page"
        @click="handleNextPage"
      >
        &rsaquo;
      </button>

      <!-- Last page -->
      <button
        type="button"
        class="list-pagination__btn list-pagination__btn--last"
        :disabled="!canGoNext"
        aria-label="Last page"
        @click="handleLastPage"
      >
        &raquo;
      </button>
    </div>

    <!-- Quick jumper -->
    <div v-if="showQuickJumper" class="list-pagination__jumper">
      <label for="quick-jump">Go to:</label>
      <input
        id="quick-jump"
        type="number"
        :min="1"
        :max="totalPages"
        :value="currentPage"
        @blur="handleQuickJump"
        @keydown.enter="handleQuickJump"
      />
    </div>
  </div>
</template>
