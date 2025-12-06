/**
 * View Schema Combinator
 *
 * 뷰 필드와 섹션을 조합하여 View 스키마를 구성
 */

import type {
  FormViewSchema,
  ViewSection,
  ViewField,
  ViewHeader,
  ViewFooter,
  ViewAction,
  LayoutConfig,
  SchemaVersion,
  Expression,
  ConfirmConfig,
} from '../types'

// ============================================================================
// Section Builder
// ============================================================================

export interface SectionBuilder {
  readonly _section: ViewSection
  title(title: string): SectionBuilder
  description(desc: string): SectionBuilder
  layout(config: LayoutConfig): SectionBuilder
  field(field: ViewField): SectionBuilder
  fields(...fields: ViewField[]): SectionBuilder
  visible(condition: Expression): SectionBuilder
  collapsible(collapsed?: boolean): SectionBuilder
  build(): ViewSection
}

const createSectionBuilder = (section: ViewSection): SectionBuilder => ({
  _section: section,

  title(title: string) {
    return createSectionBuilder({ ...this._section, title })
  },

  description(description: string) {
    return createSectionBuilder({ ...this._section, description })
  },

  layout(layout: LayoutConfig) {
    return createSectionBuilder({ ...this._section, layout })
  },

  field(field: ViewField) {
    return createSectionBuilder({
      ...this._section,
      fields: [...this._section.fields, field],
    })
  },

  fields(...fields: ViewField[]) {
    return createSectionBuilder({
      ...this._section,
      fields: [...this._section.fields, ...fields],
    })
  },

  visible(condition: Expression) {
    return createSectionBuilder({ ...this._section, visible: condition })
  },

  collapsible(collapsed = false) {
    return createSectionBuilder({
      ...this._section,
      collapsible: true,
      collapsed,
    })
  },

  build() {
    return this._section
  },
})

export const section = (id: string): SectionBuilder =>
  createSectionBuilder({
    id,
    layout: { type: 'form' },
    fields: [],
  })

// ============================================================================
// View Builder
// ============================================================================

export interface ViewBuilder {
  readonly _schema: FormViewSchema
  description(desc: string): ViewBuilder
  tags(...tags: string[]): ViewBuilder
  layout(config: LayoutConfig): ViewBuilder
  section(section: ViewSection): ViewBuilder
  sections(...sections: ViewSection[]): ViewBuilder
  header(config: ViewHeader): ViewBuilder
  footer(config: ViewFooter): ViewBuilder
  build(): FormViewSchema
}

const createViewBuilder = (schema: FormViewSchema): ViewBuilder => ({
  _schema: schema,

  description(description: string) {
    return createViewBuilder({ ...this._schema, description })
  },

  tags(...tags: string[]) {
    return createViewBuilder({
      ...this._schema,
      tags: [...(this._schema.tags ?? []), ...tags],
    })
  },

  layout(layout: LayoutConfig) {
    return createViewBuilder({ ...this._schema, layout })
  },

  section(section: ViewSection) {
    return createViewBuilder({
      ...this._schema,
      sections: [...this._schema.sections, section],
    })
  },

  sections(...sections: ViewSection[]) {
    return createViewBuilder({
      ...this._schema,
      sections: [...this._schema.sections, ...sections],
    })
  },

  header(header: ViewHeader) {
    return createViewBuilder({ ...this._schema, header })
  },

  footer(footer: ViewFooter) {
    return createViewBuilder({ ...this._schema, footer })
  },

  build() {
    return this._schema
  },
})

/**
 * View 스키마 생성
 *
 * @example
 * const productCreateView = view('product-create', 'Product Create', '0.1.0')
 *   .entityRef('product')
 *   .mode('create')
 *   .sections(
 *     section('basic')
 *       .title('기본 정보')
 *       .fields(...)
 *       .build()
 *   )
 *   .build()
 */
export const view = (
  id: string,
  name: string,
  version: SchemaVersion = '0.1.0'
) => ({
  entityRef(entityRef: string) {
    return {
      mode(mode: FormViewSchema['mode']): ViewBuilder {
        return createViewBuilder({
          _type: 'view',
          id,
          version,
          name,
          entityRef,
          mode,
          layout: { type: 'form' },
          sections: [],
        })
      },
    }
  },
})

// ============================================================================
// Layout Helpers
// ============================================================================

export const layout = {
  form(columns?: number): LayoutConfig {
    return { type: 'form', columns }
  },

  grid(columns: number, gap?: string): LayoutConfig {
    return { type: 'grid', columns, gap }
  },

  flex(direction: 'row' | 'column' = 'row', gap?: string): LayoutConfig {
    return { type: 'flex', direction, gap }
  },

  tabs(): LayoutConfig {
    return { type: 'tabs' }
  },

  accordion(): LayoutConfig {
    return { type: 'accordion' }
  },

  wizard(): LayoutConfig {
    return { type: 'wizard' }
  },
}

// ============================================================================
// Header/Footer Helpers
// ============================================================================

export const header = (
  title: string | Expression,
  options?: {
    subtitle?: string | Expression
    actions?: ViewAction[]
  }
): ViewHeader => ({
  title,
  subtitle: options?.subtitle,
  actions: options?.actions,
})

export const footer = (
  actions: ViewAction[],
  sticky = true
): ViewFooter => ({
  actions,
  sticky,
})

// ============================================================================
// Action Helpers
// ============================================================================

export interface ViewActionBuilder {
  readonly _action: ViewAction
  variant(variant: ViewAction['variant']): ViewActionBuilder
  icon(icon: string): ViewActionBuilder
  disabled(condition: Expression): ViewActionBuilder
  visible(condition: Expression): ViewActionBuilder
  confirm(config: ConfirmConfig): ViewActionBuilder
  build(): ViewAction
}

const createViewActionBuilder = (action: ViewAction): ViewActionBuilder => ({
  _action: action,

  variant(variant) {
    return createViewActionBuilder({ ...this._action, variant })
  },

  icon(icon) {
    return createViewActionBuilder({ ...this._action, icon })
  },

  disabled(condition) {
    return createViewActionBuilder({ ...this._action, disabled: condition })
  },

  visible(condition) {
    return createViewActionBuilder({ ...this._action, visible: condition })
  },

  confirm(config) {
    return createViewActionBuilder({
      ...this._action,
      action: { ...this._action.action, confirm: config },
    })
  },

  build() {
    return this._action
  },
})

export const viewAction = {
  submit(id: string, label: string): ViewActionBuilder {
    return createViewActionBuilder({
      id,
      label,
      variant: 'primary',
      action: { type: 'submit' },
    })
  },

  cancel(id: string, label: string): ViewActionBuilder {
    return createViewActionBuilder({
      id,
      label,
      variant: 'secondary',
      action: { type: 'cancel' },
    })
  },

  custom(id: string, label: string, actionId: string): ViewActionBuilder {
    return createViewActionBuilder({
      id,
      label,
      action: { type: 'custom', actionId },
    })
  },
}

export const confirm = (
  title: string,
  message: string,
  options?: { confirmLabel?: string; cancelLabel?: string }
): ConfirmConfig => ({
  title,
  message,
  confirmLabel: options?.confirmLabel,
  cancelLabel: options?.cancelLabel,
})
