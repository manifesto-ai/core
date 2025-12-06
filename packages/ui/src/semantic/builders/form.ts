import type { FormState } from '@manifesto-ai/engine'
import type { ViewAction, ViewField, ViewSection } from '@manifesto-ai/schema'
import {
  type ActionSemanticNode,
  type FieldSemanticNode,
  type FormSemanticContract,
  type FormSemanticNode,
  type SemanticBuildOptions,
  type SectionSemanticNode,
} from '../types'

const toActionNode = (action: ViewAction, prefix: string): ActionSemanticNode => ({
  id: `${prefix}:${action.id}`,
  kind: 'action',
  actionId: action.id,
  label: action.label,
  variant: action.variant,
  icon: action.icon,
  intent: action.action.type,
})

const toFieldNode = (
  field: ViewField,
  state?: FormState,
  options?: SemanticBuildOptions
): FieldSemanticNode | null => {
  const meta = state?.fields.get(field.id)
  const hidden = meta?.hidden ?? false

  const fieldState = {
    hidden,
    disabled: meta?.disabled ?? false,
    errors: meta?.errors ?? [],
    value: state?.values[field.id],
    props: meta?.props,
    options: state?.fieldOptions.get(field.id),
    liveValidators: options?.liveValidators?.get(field.id),
  }

  const liveErrors =
    fieldState.liveValidators?.map((validator) => (validator.test(fieldState.value) ? null : validator.message)).filter(
      (msg): msg is string => !!msg
    ) ?? []

  return {
    id: field.id,
    kind: 'field',
    fieldId: field.id,
    entityFieldId: field.entityFieldId,
    componentType: field.component,
    label: field.label,
    placeholder: field.placeholder,
    helpText: field.helpText,
    order: field.order,
    colSpan: field.colSpan,
    rowSpan: field.rowSpan,
    state: {
      ...fieldState,
      liveErrors,
    },
  }
}

const toSectionNode = (
  section: ViewSection,
  state?: FormState,
  options?: SemanticBuildOptions
): SectionSemanticNode => {
  const includeHidden = options?.includeHidden ?? true

  // Get section hidden state from FormState
  const sectionMeta = state?.sections?.get(section.id)
  const hidden = sectionMeta?.hidden ?? false

  const fields: FieldSemanticNode[] = []
  for (const field of section.fields) {
    const node = toFieldNode(field, state, options)
    if (!node) continue
    if (!includeHidden && node.state.hidden) continue
    fields.push(node)
  }

  return {
    id: section.id,
    kind: 'section',
    title: section.title,
    description: section.description,
    layout: section.layout,
    fields,
    hidden,
  }
}

export const buildFormSemanticTree = (
  contract: FormSemanticContract,
  options?: SemanticBuildOptions
): FormSemanticNode => {
  const { view, state } = contract
  const includeHidden = options?.includeHidden ?? true
  const allSections = view.sections.map((section) => toSectionNode(section, state, options))
  const sections = includeHidden ? allSections : allSections.filter((s) => !s.hidden)

  return {
    id: view.id,
    kind: 'form',
    viewId: view.id,
    entityRef: view.entityRef,
    mode: view.mode,
    title: view.header?.title,
    subtitle: view.header?.subtitle,
    sections,
    headerActions: view.header?.actions?.map((action) => toActionNode(action, 'header')),
    footerActions: view.footer?.actions?.map((action) => toActionNode(action, 'footer')),
    uiStateHints: options?.uiState,
  }
}
