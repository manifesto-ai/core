<script setup lang="ts">
/**
 * ActionCell - 행 액션 버튼 셀
 */
import { ref, onMounted, onUnmounted } from 'vue'
import type { RowAction } from '@manifesto-ai/schema'

const props = defineProps<{
  rowId: string
  row: Record<string, unknown>
  actions: readonly RowAction[]
}>()

const emit = defineEmits<{
  action: [rowId: string, actionId: string, row: Record<string, unknown>]
}>()

const isMenuOpen = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)

const handleActionClick = (actionId: string) => {
  emit('action', props.rowId, actionId, props.row)
  isMenuOpen.value = false
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

// Close menu on outside click
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <!-- No actions -->
  <td v-if="!actions.length" class="list-row__cell list-row__cell--actions" />

  <!-- Inline mode for 1-2 actions -->
  <td v-else-if="actions.length <= 2" class="list-row__cell list-row__cell--actions">
    <div class="list-action-cell list-action-cell--inline">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        :class="['list-action-cell__btn', `list-action-cell__btn--${action.variant ?? 'ghost'}`]"
        :title="action.label"
        @click="handleActionClick(action.id)"
      >
        <span v-if="action.icon" class="list-action-cell__icon">{{ action.icon }}</span>
        <span class="list-action-cell__label">{{ action.label }}</span>
      </button>
    </div>
  </td>

  <!-- Dropdown menu for 3+ actions -->
  <td v-else class="list-row__cell list-row__cell--actions">
    <div ref="menuRef" class="list-action-cell list-action-cell--dropdown">
      <button
        type="button"
        class="list-action-cell__trigger"
        :aria-expanded="isMenuOpen"
        aria-haspopup="menu"
        @click="toggleMenu"
      >
        <span class="list-action-cell__dots">&#8942;</span>
      </button>
      <div v-if="isMenuOpen" class="list-action-cell__menu" role="menu">
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          role="menuitem"
          :class="[
            'list-action-cell__menu-item',
            `list-action-cell__menu-item--${action.variant ?? 'ghost'}`,
          ]"
          @click="handleActionClick(action.id)"
        >
          <span v-if="action.icon" class="list-action-cell__icon">{{ action.icon }}</span>
          <span class="list-action-cell__label">{{ action.label }}</span>
        </button>
      </div>
    </div>
  </td>
</template>
