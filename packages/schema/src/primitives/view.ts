/**
 * View Primitives - 아토믹한 뷰 필드 빌더
 *
 * Entity 필드를 UI 컴포넌트에 매핑하고
 * 반응성(reactions)을 선언적으로 정의
 */

import type {
  ViewField,
  StyleConfig,
  Reaction,
  ReactionAction,
  DataSource,
  Expression,
} from '../types'

// ============================================================================
// View Field Builder
// ============================================================================

export interface ViewFieldBuilder {
  readonly _field: ViewField
  label(label: string): ViewFieldBuilder
  placeholder(text: string): ViewFieldBuilder
  helpText(text: string): ViewFieldBuilder
  props(props: Record<string, unknown>): ViewFieldBuilder
  styles(styles: StyleConfig): ViewFieldBuilder
  dependsOn(...fields: string[]): ViewFieldBuilder
  reaction(reaction: Reaction): ViewFieldBuilder
  hidden(condition: Expression): ViewFieldBuilder
  disabled(condition: Expression): ViewFieldBuilder
  order(order: number): ViewFieldBuilder
  span(col: number, row?: number): ViewFieldBuilder
  build(): ViewField
}

const createViewFieldBuilder = (field: ViewField): ViewFieldBuilder => ({
  _field: field,

  label(label: string) {
    return createViewFieldBuilder({ ...this._field, label })
  },

  placeholder(placeholder: string) {
    return createViewFieldBuilder({ ...this._field, placeholder })
  },

  helpText(helpText: string) {
    return createViewFieldBuilder({ ...this._field, helpText })
  },

  props(props: Record<string, unknown>) {
    return createViewFieldBuilder({
      ...this._field,
      props: { ...this._field.props, ...props },
    })
  },

  styles(styles: StyleConfig) {
    return createViewFieldBuilder({ ...this._field, styles })
  },

  dependsOn(...fields: string[]) {
    return createViewFieldBuilder({
      ...this._field,
      dependsOn: [...(this._field.dependsOn ?? []), ...fields],
    })
  },

  reaction(reaction: Reaction) {
    return createViewFieldBuilder({
      ...this._field,
      reactions: [...(this._field.reactions ?? []), reaction],
    })
  },

  hidden(condition: Expression) {
    const reaction: Reaction = {
      trigger: 'change',
      actions: [{ type: 'updateProp', target: this._field.id, prop: 'hidden', value: condition }],
    }
    return createViewFieldBuilder({
      ...this._field,
      reactions: [...(this._field.reactions ?? []), reaction],
    })
  },

  disabled(condition: Expression) {
    const reaction: Reaction = {
      trigger: 'change',
      actions: [{ type: 'updateProp', target: this._field.id, prop: 'disabled', value: condition }],
    }
    return createViewFieldBuilder({
      ...this._field,
      reactions: [...(this._field.reactions ?? []), reaction],
    })
  },

  order(order: number) {
    return createViewFieldBuilder({ ...this._field, order })
  },

  span(colSpan: number, rowSpan?: number) {
    return createViewFieldBuilder({
      ...this._field,
      colSpan,
      rowSpan: rowSpan ?? this._field.rowSpan,
    })
  },

  build() {
    return this._field
  },
})

// ============================================================================
// View Field Constructors
// ============================================================================

export const viewField = {
  /**
   * 텍스트 입력 필드
   */
  textInput(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'text-input',
    })
  },

  /**
   * 숫자 입력 필드
   */
  numberInput(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'number-input',
    })
  },

  /**
   * 셀렉트 박스
   */
  select(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'select',
    })
  },

  /**
   * 멀티 셀렉트
   */
  multiSelect(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'multi-select',
    })
  },

  /**
   * 체크박스
   */
  checkbox(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'checkbox',
    })
  },

  /**
   * 라디오 버튼
   */
  radio(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'radio',
    })
  },

  /**
   * 날짜 선택기
   */
  datePicker(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'date-picker',
    })
  },

  /**
   * 날짜시간 선택기
   */
  datetimePicker(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'datetime-picker',
    })
  },

  /**
   * 텍스트에어리어
   */
  textarea(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'textarea',
    })
  },

  /**
   * 리치 에디터
   */
  richEditor(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'rich-editor',
    })
  },

  /**
   * 파일 업로드
   */
  fileUpload(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'file-upload',
    })
  },

  /**
   * 이미지 업로드
   */
  imageUpload(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'image-upload',
    })
  },

  /**
   * 자동완성
   */
  autocomplete(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'autocomplete',
    })
  },

  /**
   * 토글 스위치
   */
  toggle(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'toggle',
    })
  },

  /**
   * 슬라이더
   */
  slider(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'slider',
    })
  },

  /**
   * 컬러 피커
   */
  colorPicker(id: string, entityFieldId: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'color-picker',
    })
  },

  /**
   * 커스텀 컴포넌트
   */
  custom(id: string, entityFieldId: string, component: string): ViewFieldBuilder {
    return createViewFieldBuilder({
      id,
      entityFieldId,
      component: 'custom',
      props: { customComponent: component },
    })
  },
}

// ============================================================================
// Reaction Builder
// ============================================================================

export interface ReactionBuilder {
  readonly _reaction: Partial<Reaction>
  when(condition: Expression): ReactionBuilder
  debounce(ms: number): ReactionBuilder
  throttle(ms: number): ReactionBuilder
  do(...actions: ReactionAction[]): Reaction
}

const createReactionBuilder = (
  trigger: Reaction['trigger'],
  partial: Partial<Reaction> = {}
): ReactionBuilder => ({
  _reaction: { trigger, ...partial },

  when(condition: Expression) {
    return createReactionBuilder(trigger, { ...this._reaction, condition })
  },

  debounce(ms: number) {
    return createReactionBuilder(trigger, { ...this._reaction, debounce: ms })
  },

  throttle(ms: number) {
    return createReactionBuilder(trigger, { ...this._reaction, throttle: ms })
  },

  do(...actions: ReactionAction[]): Reaction {
    return {
      trigger: this._reaction.trigger ?? trigger,
      condition: this._reaction.condition,
      actions,
      debounce: this._reaction.debounce,
      throttle: this._reaction.throttle,
    }
  },
})

export const on = {
  change: () => createReactionBuilder('change'),
  blur: () => createReactionBuilder('blur'),
  focus: () => createReactionBuilder('focus'),
  mount: () => createReactionBuilder('mount'),
  unmount: () => createReactionBuilder('unmount'),
}

// ============================================================================
// Action Helpers
// ============================================================================

export const actions = {
  setValue(target: string, value: Expression | unknown): ReactionAction {
    return { type: 'setValue', target, value }
  },

  setOptions(target: string, source: DataSource): ReactionAction {
    return { type: 'setOptions', target, source }
  },

  updateProp(target: string, prop: string, value: Expression | unknown): ReactionAction {
    return { type: 'updateProp', target, prop, value }
  },

  validate(targets?: string[], mode: 'silent' | 'visible' = 'visible'): ReactionAction {
    return { type: 'validate', targets, mode }
  },

  navigate(path: string, params?: Record<string, unknown>): ReactionAction {
    return { type: 'navigate', path, params }
  },

  emit(event: string, payload?: Record<string, unknown>): ReactionAction {
    return { type: 'emit', event, payload }
  },
}

// ============================================================================
// DataSource Helpers
// ============================================================================

export const dataSource = {
  static(values: readonly { value: string | number; label: string }[]): DataSource {
    return { type: 'static', static: values }
  },

  api(endpoint: string, options?: Partial<DataSource['api']>): DataSource {
    return {
      type: 'api',
      api: { endpoint, ...options },
    }
  },

  derived(expression: Expression): DataSource {
    return { type: 'derived', derived: expression }
  },
}
