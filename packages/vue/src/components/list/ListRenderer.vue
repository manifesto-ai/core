<template>
  <table class="mvs-list" v-if="tree && rows.length">
    <thead>
      <tr>
        <th v-for="col in tree.columns" :key="col.columnId" :style="{ textAlign: col.align ?? 'left' }">
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
        <td v-for="col in tree.columns" :key="col.columnId">
          <slot name="cell" :column-id="col.columnId" :row-index="rowIndex" :row="row" :value="row[col.entityFieldId]">
            {{ row[col.entityFieldId] as any }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
  <div v-else class="mvs-list mvs-list--empty">
    {{ tree?.emptyState?.title ?? 'No data' }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ListViewSchema } from '@manifesto-ai/schema'
import { type ListSemanticNode, type SemanticRendererRegistry } from '@manifesto-ai/ui'
import { getDefaultSemanticRegistry } from '@manifesto-ai/ui'

const props = withDefaults(
  defineProps<{
    schema: ListViewSchema
    rows?: readonly Record<string, unknown>[]
    includeHiddenColumns?: boolean
    semanticRegistry?: SemanticRendererRegistry
  }>(),
  {
    rows: () => [],
    includeHiddenColumns: false,
  }
)

const semantic = computed(() => props.semanticRegistry ?? getDefaultSemanticRegistry())
const tree = ref<ListSemanticNode | null>(null)

const rebuild = () => {
  const contract = { kind: 'list' as const, view: props.schema, rows: props.rows }
  const built = semantic.value.build(contract, { includeHidden: props.includeHiddenColumns })
  tree.value = built as ListSemanticNode
}

watch(
  () => [props.schema, props.rows, props.includeHiddenColumns],
  () => rebuild(),
  { deep: true, immediate: true }
)

const rows = computed(() => props.rows ?? [])
</script>
