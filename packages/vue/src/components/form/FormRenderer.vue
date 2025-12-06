<template>
  <form class="mvs-form" @submit.prevent="handleSubmit">
    <div v-if="!runtime.isInitialized.value" class="mvs-form__loading">Loading...</div>
    <div v-else-if="runtime.error.value" class="mvs-form__error">
      {{ 'message' in runtime.error.value ? runtime.error.value.message : runtime.error.value.type }}
    </div>
    <template v-else>
      <slot name="header" :tree="semanticTree" />
      <div v-if="semanticTree?.headerActions?.length" class="mvs-actions mvs-actions--header">
        <button v-for="action in semanticTree.headerActions" :key="action.id" type="button" @click="handleAction(action)">
          {{ action.label }}
        </button>
      </div>
      <SectionRenderer
        v-for="section in semanticTree?.sections ?? []"
        :key="section.id"
        :section="section"
        :readonly="readonly"
        :onChange="(fieldId, value) => runtime.setFieldValue(fieldId, value)"
        :live-validators="liveValidators"
      >
        <template #field="slotProps">
          <slot name="field" v-bind="slotProps" />
        </template>
      </SectionRenderer>
      <slot name="footer" :tree="semanticTree">
        <footer class="mvs-form__footer">
          <button type="submit" class="mvs-button mvs-button--primary" :disabled="!runtime.isValid.value || runtime.isSubmitting.value">
            Submit
          </button>
          <div v-if="semanticTree?.footerActions?.length" class="mvs-actions mvs-actions--footer">
            <button v-for="action in semanticTree.footerActions" :key="action.id" type="button" @click="handleAction(action)">
              {{ action.label }}
            </button>
          </div>
        </footer>
      </slot>
      <div v-if="missingRenderers.length" class="mvs-warning">
        Missing renderers for: {{ missingRenderers.join(', ') }}
      </div>
    </template>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
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
  type ResolvedFormSemanticNode,
  type SemanticRendererRegistry,
  type LightweightValidator,
  type ActionSemanticNode,
} from '@manifesto-ai/ui'
import type { FieldRendererRegistry, ActionHandlerRegistry } from '@manifesto-ai/ui'
import { getDefaultSemanticRegistry } from '@manifesto-ai/ui'
import { useFormRuntime } from '../../composables/useFormRuntime'
import SectionRenderer from './SectionRenderer.vue'
import type { FieldRendererComponent, FormActionHandlerContext } from '../../types'
import { getDefaultFieldRegistry } from '../../registry'
import { getDefaultActionRegistry } from '../../registry/actionRegistry'

const props = withDefaults(
  defineProps<{
    schema: FormViewSchema
    initialValues?: Record<string, unknown>
    context?: Partial<EvaluationContext>
    entitySchema?: EntitySchema
    readonly?: boolean
    includeHiddenFields?: boolean
    fieldRegistry?: FieldRendererRegistry<FieldRendererComponent>
    semanticRegistry?: SemanticRendererRegistry
    actionRegistry?: ActionHandlerRegistry<FormActionHandlerContext>
    liveValidators?: ReadonlyMap<string, readonly LightweightValidator[]>
    uiStateHints?: Readonly<Record<string, unknown>>
    fetchHandler?: FetchHandler
    navigateHandler?: NavigateHandler
    emitHandler?: EmitHandler
    debug?: boolean
  }>(),
  {
    readonly: false,
    includeHiddenFields: true,
    debug: false,
  }
)

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'change', fieldId: string, value: unknown): void
  (e: 'validate', isValid: boolean): void
  (e: 'error', error: FormRuntimeError): void
  (e: 'runtime-ready', runtime: FormRuntime): void
  (e: 'action', actionId: string): void
}>()

const runtime = useFormRuntime(props.schema, {
  initialValues: props.initialValues,
  context: props.context,
  entitySchema: props.entitySchema,
  fetchHandler: props.fetchHandler,
  navigateHandler: props.navigateHandler,
  emitHandler: props.emitHandler,
  debug: props.debug,
})

const registry = computed(() => props.fieldRegistry ?? getDefaultFieldRegistry())
const semantic = computed(() => props.semanticRegistry ?? getDefaultSemanticRegistry())
const actions = computed(() => props.actionRegistry ?? getDefaultActionRegistry())

const semanticTree = ref<ResolvedFormSemanticNode<FieldRendererComponent> | null>(null)
const missingRenderers = ref<string[]>([])

const rebuildSemanticTree = async () => {
  const contract = { kind: 'form' as const, view: props.schema, state: runtime.getState() }
  const tree = semantic.value.build(contract, {
    includeHidden: props.includeHiddenFields,
    liveValidators: props.liveValidators,
    uiState: props.uiStateHints,
  })
  const { tree: resolved, missing } = await resolveFieldRenderers(tree, registry.value)
  semanticTree.value = resolved as ResolvedFormSemanticNode<FieldRendererComponent>
  missingRenderers.value = [...missing]
}

watch(
  () => [runtime.values.value, runtime.fields.value, runtime.isDirty.value, runtime.isValid.value, runtime.isSubmitting.value],
  () => {
    rebuildSemanticTree()
  },
  { deep: true }
)

onMounted(() => {
  rebuildSemanticTree()
  const rt = runtime.getRuntime()
  if (rt) {
    emit('runtime-ready', rt as FormRuntime)
  }
})

watch(
  () => runtime.error.value,
  (err) => {
    if (err) emit('error', err)
  }
)

watch(
  () => runtime.values.value,
  (values, prev) => {
    if (!prev) return
    for (const key of Object.keys(values)) {
      if (values[key] !== prev[key]) {
        emit('change', key, values[key])
      }
    }
  },
  { deep: true }
)

const handleSubmit = async () => {
  const data = await runtime.submit()
  emit('validate', runtime.isValid.value)
  if (!runtime.isValid.value || !data) return
  emit('submit', data)
}

const readonly = computed(() => props.readonly)

defineExpose({
  runtime,
  semanticTree,
})

const handleAction = (action: ActionSemanticNode) => {
  const handler = actions.value.get(action.actionId)
  const rt = runtime.getRuntime()
  if (handler && rt) {
    handler({ actionId: action.actionId, runtime: rt as FormRuntime, node: action })
  }
  emit('action', action.actionId)
}
</script>
