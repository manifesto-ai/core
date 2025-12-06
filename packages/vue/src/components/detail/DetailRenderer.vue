<template>
  <div class="mvs-detail" v-if="semanticTree">
    <slot name="header" :tree="semanticTree" />
    <SectionRenderer
      v-for="section in semanticTree.sections"
      :key="section.id"
      :section="section"
      :readonly="true"
      :onChange="(fieldId, value) => runtime.setFieldValue(fieldId, value)"
    >
      <template #field="slotProps">
        <slot name="field" v-bind="slotProps" />
      </template>
    </SectionRenderer>
    <slot name="footer" :tree="semanticTree" />
    <div v-if="missingRenderers.length" class="mvs-warning">
      Missing renderers for: {{ missingRenderers.join(', ') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { FormViewSchema } from '@manifesto-ai/schema'
import type {
  EvaluationContext,
  FetchHandler,
  NavigateHandler,
  EmitHandler,
  FormRuntime,
  FormRuntimeError,
} from '@manifesto-ai/engine'
import {
  resolveFieldRenderers,
  type ResolvedDetailSemanticNode,
  type SemanticRendererRegistry,
} from '@manifesto-ai/ui'
import { getDefaultSemanticRegistry } from '@manifesto-ai/ui'
import type { FieldRendererRegistry } from '@manifesto-ai/ui'
import { getDefaultFieldRegistry } from '../../registry'
import { useFormRuntime } from '../../composables/useFormRuntime'
import SectionRenderer from '../form/SectionRenderer.vue'
import type { FieldRendererComponent } from '../../types'

const props = withDefaults(
  defineProps<{
    schema: FormViewSchema
    initialValues?: Record<string, unknown>
    context?: Partial<EvaluationContext>
    fieldRegistry?: FieldRendererRegistry<FieldRendererComponent>
    semanticRegistry?: SemanticRendererRegistry
    fetchHandler?: FetchHandler
    navigateHandler?: NavigateHandler
    emitHandler?: EmitHandler
    debug?: boolean
  }>(),
  {
    debug: false,
  }
)

const emit = defineEmits<{
  (e: 'runtime-ready', runtime: FormRuntime): void
  (e: 'error', error: FormRuntimeError): void
}>()

const runtime = useFormRuntime(props.schema, {
  initialValues: props.initialValues,
  context: props.context,
  fetchHandler: props.fetchHandler,
  navigateHandler: props.navigateHandler,
  emitHandler: props.emitHandler,
  debug: props.debug,
})

const registry = computed(() => props.fieldRegistry ?? getDefaultFieldRegistry())
const semantic = computed(() => props.semanticRegistry ?? getDefaultSemanticRegistry())

const semanticTree = ref<ResolvedDetailSemanticNode<FieldRendererComponent> | null>(null)
const missingRenderers = ref<string[]>([])

const rebuildSemantic = async () => {
  const contract = { kind: 'detail' as const, view: props.schema, state: runtime.getState() }
  const tree = semantic.value.build(contract, { includeHidden: true })
  const { tree: resolved, missing } = await resolveFieldRenderers(tree, registry.value)
  semanticTree.value = resolved as ResolvedDetailSemanticNode<FieldRendererComponent>
  missingRenderers.value = [...missing]
}

watch(
  () => [runtime.values.value, runtime.fields.value],
  () => rebuildSemantic(),
  { deep: true, immediate: true }
)

onMounted(() => {
  const rt = runtime.getRuntime()
  if (rt) emit('runtime-ready', rt as FormRuntime)
})

watch(
  () => runtime.error.value,
  (err) => {
    if (err) emit('error', err)
  }
)
</script>
