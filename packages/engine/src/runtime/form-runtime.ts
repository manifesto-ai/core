/**
 * Form Runtime
 *
 * 폼 상태 관리 및 반응형 업데이트 조율
 */

import type {
  FormViewSchema,
  ViewField,
  Expression,
  Reaction,
  ReactionAction,
  Result,
  EntitySchema,
  EntityField,
  Constraint,
  EnumValue,
  SetOptionsAction,
  NavigateAction,
  EmitAction,
  DataSource,
  TransformConfig,
  DataType,
} from '@manifesto-ai/schema'
import { ok, err } from '@manifesto-ai/schema'
import { createReactiveTracker, type ReactiveDependencyTracker } from '../tracker'
import { createEvaluator, type EvaluationContext, type ExpressionEvaluator } from '../evaluator'

// ============================================================================
// Types
// ============================================================================

export interface FieldMeta {
  readonly id: string
  readonly entityFieldId: string
  readonly hidden: boolean
  readonly disabled: boolean
  readonly errors: readonly string[]
  readonly props: Readonly<Record<string, unknown>>
}

export interface SectionMeta {
  readonly id: string
  readonly hidden: boolean
}

export interface FormState {
  readonly values: Readonly<Record<string, unknown>>
  readonly fields: ReadonlyMap<string, FieldMeta>
  readonly sections: ReadonlyMap<string, SectionMeta>
  readonly fieldOptions: ReadonlyMap<string, readonly EnumValue[]>
  readonly isValid: boolean
  readonly isDirty: boolean
  readonly isSubmitting: boolean
}

/**
 * Fetch 핸들러 타입 - API 호출을 위한 DI 인터페이스
 */
export type FetchHandler = (
  endpoint: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  }
) => Promise<unknown>

/**
 * Navigate 핸들러 타입 - 라우팅을 위한 DI 인터페이스
 */
export type NavigateHandler = (
  path: string,
  params?: Record<string, unknown>
) => void

/**
 * Emit 핸들러 타입 - 이벤트 발행을 위한 DI 인터페이스
 */
export type EmitHandler = (
  event: string,
  payload?: Record<string, unknown>
) => void

export interface FormRuntimeOptions {
  /** 초기값 */
  initialValues?: Record<string, unknown>
  /** 컨텍스트 */
  context?: Partial<EvaluationContext>
  /** Entity 스키마 (검증용) */
  entitySchema?: EntitySchema
  /** API 호출 핸들러 (setOptions용) */
  fetchHandler?: FetchHandler
  /** Navigate 핸들러 (라우팅용) */
  navigateHandler?: NavigateHandler
  /** Emit 핸들러 (이벤트 발행용) */
  emitHandler?: EmitHandler
  /** 디버그 모드 */
  debug?: boolean
}

export type FormEvent =
  | { type: 'FIELD_CHANGE'; fieldId: string; value: unknown }
  | { type: 'FIELD_BLUR'; fieldId: string }
  | { type: 'FIELD_FOCUS'; fieldId: string }
  | { type: 'SUBMIT' }
  | { type: 'RESET' }
  | { type: 'VALIDATE'; fieldIds?: string[] }

export type FormRuntimeError =
  | { type: 'SCHEMA_ERROR'; message: string }
  | { type: 'EVALUATION_ERROR'; message: string; fieldId?: string }
  | { type: 'VALIDATION_ERROR'; errors: Record<string, string[]> }

export interface FormEventHandler {
  (event: FormEvent): void
}

export interface FormChangeListener {
  (state: FormState): void
}

// ============================================================================
// Form Runtime
// ============================================================================

export class FormRuntime {
  private schema: FormViewSchema
  private tracker: ReactiveDependencyTracker
  private evaluator: ExpressionEvaluator

  private values: Record<string, unknown> = {}
  private fieldMetas: Map<string, FieldMeta> = new Map()
  private sectionMetas: Map<string, SectionMeta> = new Map()
  private fieldOptions: Map<string, readonly EnumValue[]> = new Map()
  private entityFieldMap: Map<string, EntityField> = new Map()
  private isDirty = false
  private isSubmitting = false

  private listeners: Set<FormChangeListener> = new Set()
  private options: FormRuntimeOptions & {
    initialValues: Record<string, unknown>
    context: Partial<EvaluationContext>
    debug: boolean
  }
  private baseContext: EvaluationContext

  constructor(schema: FormViewSchema, options: FormRuntimeOptions = {}) {
    this.schema = schema
    this.tracker = createReactiveTracker()
    this.evaluator = createEvaluator({ debug: options.debug })

    this.options = {
      initialValues: options.initialValues ?? {},
      context: options.context ?? {},
      entitySchema: options.entitySchema,
      fetchHandler: options.fetchHandler,
      navigateHandler: options.navigateHandler,
      emitHandler: options.emitHandler,
      debug: options.debug ?? false,
    }

    this.baseContext = {
      state: {},
      context: this.options.context.context ?? {},
      user: this.options.context.user ?? {},
      params: this.options.context.params ?? {},
      result: this.options.context.result ?? {},
      env: this.options.context.env ?? {},
    }

    // Entity 필드 맵 구축
    if (options.entitySchema) {
      for (const field of options.entitySchema.fields) {
        this.entityFieldMap.set(field.id, field)
      }
    }
  }

  /**
   * 런타임 초기화
   */
  initialize(): Result<void, FormRuntimeError> {
    // 의존성 그래프 구축
    const buildResult = this.tracker.buildFromViewSchema(this.schema)
    if (buildResult._tag === 'Err') {
      return err({
        type: 'SCHEMA_ERROR',
        message: buildResult.error.message,
      })
    }

    // 초기값 설정
    this.values = { ...this.options.initialValues }

    // 섹션 메타 초기화 (visible 표현식의 정적 boolean 값 처리)
    for (const section of this.schema.sections) {
      // section.visible이 없거나 표현식인 경우 hidden=false로 시작
      // 정적 boolean인 경우 해당 값 사용
      const hidden = section.visible === false // visible=false면 hidden=true
      this.sectionMetas.set(section.id, { id: section.id, hidden })
    }

    // 필드 메타 초기화 및 enum 옵션 로드
    for (const section of this.schema.sections) {
      for (const field of section.fields) {
        // hidden/visibility/disabled의 정적 boolean 값 처리
        let hidden = false
        if (typeof field.hidden === 'boolean') {
          hidden = field.hidden
        } else if (typeof field.visibility === 'boolean') {
          hidden = !field.visibility // visibility의 반대
        }

        const disabled = typeof field.disabled === 'boolean' ? field.disabled : false

        this.fieldMetas.set(field.id, {
          id: field.id,
          entityFieldId: field.entityFieldId,
          hidden,
          disabled,
          errors: [],
          props: field.props ?? {},
        })

        // EntitySchema에서 enumValues 자동 로드
        const entityField = this.entityFieldMap.get(field.entityFieldId)
        if (entityField?.enumValues && entityField.enumValues.length > 0) {
          this.fieldOptions.set(field.id, entityField.enumValues)
        }
      }
    }

    // 초기 표현식 평가
    const evalResult = this.evaluateAllExpressions()
    if (evalResult._tag === 'Err') {
      return evalResult
    }

    // mount reactions 실행
    for (const section of this.schema.sections) {
      for (const field of section.fields) {
        this.executeReactions(field.id, 'mount')
      }
    }

    return ok(undefined)
  }

  /**
   * 이벤트 처리
   */
  dispatch(event: FormEvent): Result<void, FormRuntimeError> {
    switch (event.type) {
      case 'FIELD_CHANGE':
        return this.handleFieldChange(event.fieldId, event.value)

      case 'FIELD_BLUR':
        return this.handleFieldBlur(event.fieldId)

      case 'FIELD_FOCUS':
        return this.handleFieldFocus(event.fieldId)

      case 'SUBMIT':
        return this.handleSubmit()

      case 'RESET':
        return this.handleReset()

      case 'VALIDATE':
        return this.handleValidate(event.fieldIds)
    }
  }

  /**
   * 현재 상태 반환
   */
  getState(): FormState {
    return {
      values: { ...this.values },
      fields: new Map(this.fieldMetas),
      sections: new Map(this.sectionMetas),
      fieldOptions: new Map(this.fieldOptions),
      isValid: this.isFormValid(),
      isDirty: this.isDirty,
      isSubmitting: this.isSubmitting,
    }
  }

  /**
   * 필드 옵션 가져오기
   */
  getFieldOptions(fieldId: string): readonly EnumValue[] | undefined {
    return this.fieldOptions.get(fieldId)
  }

  /**
   * 필드 값 가져오기
   */
  getValue(fieldId: string): unknown {
    return this.values[fieldId]
  }

  /**
   * 필드 메타 가져오기
   */
  getFieldMeta(fieldId: string): FieldMeta | undefined {
    return this.fieldMetas.get(fieldId)
  }

  /**
   * 상태 변경 리스너 등록
   */
  subscribe(listener: FormChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 폼 제출 데이터
   */
  getSubmitData(): Record<string, unknown> {
    const data: Record<string, unknown> = {}

    for (const [fieldId, meta] of this.fieldMetas) {
      if (!meta.hidden) {
        data[meta.entityFieldId] = this.values[fieldId]
      }
    }

    return data
  }

  private handleFieldChange(fieldId: string, value: unknown): Result<void, FormRuntimeError> {
    const meta = this.fieldMetas.get(fieldId)
    if (!meta) {
      return ok(undefined) // 필드가 없으면 무시
    }

    // EntityField 조회
    const entityField = this.entityFieldMap.get(meta.entityFieldId)

    if (entityField) {
      // 1. 타입 coercion 시도
      value = this.coerceValue(value, entityField.dataType)

      // 2. 타입 검증
      const typeError = this.validateType(value, entityField)
      if (typeError) {
        // 에러를 fieldMeta에 설정하고 값은 할당하지 않음
        this.fieldMetas.set(fieldId, { ...meta, errors: [typeError] })
        this.notifyListeners()
        return err({
          type: 'VALIDATION_ERROR',
          errors: { [fieldId]: [typeError] },
        })
      }
    }

    // 검증 통과한 값만 할당
    this.values[fieldId] = value
    this.isDirty = true

    // 기존 에러 클리어 (검증 통과 시)
    if (meta.errors.length > 0) {
      this.fieldMetas.set(fieldId, { ...meta, errors: [] })
    }

    // reactions 실행 (change 트리거)
    this.executeReactions(fieldId, 'change')

    // 영향받는 필드들 재평가
    const evalResult = this.evaluateAffectedFields(fieldId)
    if (evalResult._tag === 'Err') {
      return evalResult
    }

    this.notifyListeners()
    return ok(undefined)
  }

  /**
   * 값을 대상 타입으로 coercion 시도
   */
  private coerceValue(value: unknown, dataType: DataType): unknown {
    if (value === null || value === undefined || value === '') {
      return value
    }

    switch (dataType) {
      case 'number':
        if (typeof value === 'string') {
          const num = Number(value)
          if (!isNaN(num)) {
            return num
          }
        }
        break

      case 'boolean':
        if (value === 'true') return true
        if (value === 'false') return false
        if (value === 1) return true
        if (value === 0) return false
        break

      case 'date':
      case 'datetime':
        if (typeof value === 'string') {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return dataType === 'date'
              ? date.toISOString().split('T')[0]
              : date.toISOString()
          }
        }
        break
    }

    return value
  }

  /**
   * 값의 타입이 EntityField의 dataType과 호환되는지 검증
   */
  private validateType(value: unknown, entityField: EntityField): string | null {
    // 빈 값은 타입 검증 통과 (required는 별도 constraint)
    if (value === null || value === undefined || value === '') {
      return null
    }

    switch (entityField.dataType) {
      case 'string':
        if (typeof value !== 'string') {
          return '문자열을 입력해야 합니다'
        }
        break

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return '숫자를 입력해야 합니다'
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          return 'true 또는 false를 입력해야 합니다'
        }
        break

      case 'date':
      case 'datetime':
        if (typeof value === 'string') {
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            return '유효한 날짜 형식이 아닙니다'
          }
        } else if (!(value instanceof Date)) {
          return '유효한 날짜 형식이 아닙니다'
        }
        break

      case 'enum':
        if (entityField.enumValues && entityField.enumValues.length > 0) {
          const validValues = entityField.enumValues.map((e) => e.value)
          if (!validValues.includes(value as string | number)) {
            const labels = entityField.enumValues.map((e) => e.label).join(', ')
            return `유효한 옵션이 아닙니다. 선택 가능: ${labels}`
          }
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          return '배열 형식이어야 합니다'
        }
        break

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return '객체 형식이어야 합니다'
        }
        break

      case 'reference':
        // reference는 보통 string 또는 number ID
        if (typeof value !== 'string' && typeof value !== 'number') {
          return '유효한 참조 값이 아닙니다'
        }
        break
    }

    return null
  }

  private handleFieldBlur(fieldId: string): Result<void, FormRuntimeError> {
    // 필드 검증
    this.validateField(fieldId)

    // reactions 실행 (blur 트리거)
    this.executeReactions(fieldId, 'blur')

    this.notifyListeners()
    return ok(undefined)
  }

  private handleFieldFocus(fieldId: string): Result<void, FormRuntimeError> {
    // reactions 실행 (focus 트리거)
    this.executeReactions(fieldId, 'focus')

    this.notifyListeners()
    return ok(undefined)
  }

  private handleSubmit(): Result<void, FormRuntimeError> {
    // 전체 검증
    const validationResult = this.validateAll()
    if (!validationResult) {
      return err({
        type: 'VALIDATION_ERROR',
        errors: this.collectErrors(),
      })
    }

    this.isSubmitting = true
    this.notifyListeners()

    return ok(undefined)
  }

  private handleReset(): Result<void, FormRuntimeError> {
    this.values = { ...this.options.initialValues }
    this.isDirty = false
    this.isSubmitting = false

    // 모든 필드 에러 클리어
    for (const [id, meta] of this.fieldMetas) {
      this.fieldMetas.set(id, { ...meta, errors: [] })
    }

    // 표현식 재평가
    const evalResult = this.evaluateAllExpressions()
    if (evalResult._tag === 'Err') {
      return evalResult
    }

    this.notifyListeners()
    return ok(undefined)
  }

  private handleValidate(fieldIds?: string[]): Result<void, FormRuntimeError> {
    if (fieldIds) {
      for (const id of fieldIds) {
        this.validateField(id)
      }
    } else {
      this.validateAll()
    }

    this.notifyListeners()
    return ok(undefined)
  }

  private executeReactions(fieldId: string, trigger: Reaction['trigger']): void {
    const field = this.findField(fieldId)
    if (!field?.reactions) return

    const context = this.buildContext()

    for (const reaction of field.reactions) {
      if (reaction.trigger !== trigger) continue

      // 조건 확인
      if (reaction.condition) {
        const condResult = this.evaluator.evaluate(reaction.condition, context)
        if (condResult._tag === 'Err' || !condResult.value) continue
      }

      // 액션 실행
      for (const action of reaction.actions) {
        this.executeAction(action, context)
      }
    }
  }

  private executeAction(action: ReactionAction, context: EvaluationContext): void {
    switch (action.type) {
      case 'setValue': {
        let value = action.value
        if (this.isExpression(value)) {
          const result = this.evaluator.evaluate(value as Expression, context)
          if (result._tag === 'Ok') {
            value = result.value
          }
        }
        this.values[action.target] = value
        break
      }

      case 'updateProp': {
        const meta = this.fieldMetas.get(action.target)
        if (meta) {
          let value = action.value
          if (this.isExpression(value)) {
            const result = this.evaluator.evaluate(value as Expression, context)
            if (result._tag === 'Ok') {
              value = result.value
            }
          }

          if (action.prop === 'hidden') {
            this.fieldMetas.set(action.target, { ...meta, hidden: !!value })
          } else if (action.prop === 'disabled') {
            this.fieldMetas.set(action.target, { ...meta, disabled: !!value })
          } else {
            this.fieldMetas.set(action.target, {
              ...meta,
              props: { ...meta.props, [action.prop]: value },
            })
          }
        }
        break
      }

      case 'validate': {
        if (action.targets) {
          for (const target of action.targets) {
            this.validateField(target)
          }
        } else {
          this.validateAll()
        }
        break
      }

      case 'setOptions': {
        // 비동기로 실행, 에러 로깅
        this.executeSetOptionsAction(action as SetOptionsAction, context).catch((error) => {
          if (this.options.debug) {
            console.error('[FormRuntime] setOptions failed:', error)
          }
        })
        break
      }

      case 'navigate': {
        this.executeNavigateAction(action as NavigateAction, context)
        break
      }

      case 'emit': {
        this.executeEmitAction(action as EmitAction, context)
        break
      }
    }
  }

  /**
   * setOptions 액션 실행
   */
  private async executeSetOptionsAction(
    action: SetOptionsAction,
    context: EvaluationContext
  ): Promise<void> {
    const { target, source } = action
    let options: EnumValue[] = []

    switch (source.type) {
      case 'static':
        options = [...(source.static ?? [])]
        break

      case 'derived':
        if (source.derived) {
          const result = this.evaluator.evaluate(source.derived, context)
          if (result._tag === 'Ok' && Array.isArray(result.value)) {
            options = result.value as EnumValue[]
          }
        }
        break

      case 'api':
        if (source.api) {
          options = await this.fetchOptions(source, context)
        }
        break
    }

    this.fieldOptions.set(target, options)
    this.notifyListeners()
  }

  /**
   * API를 통해 옵션 로드
   */
  private async fetchOptions(source: DataSource, context: EvaluationContext): Promise<EnumValue[]> {
    if (!source.api || !this.options.fetchHandler) {
      if (this.options.debug) {
        console.warn('[FormRuntime] fetchOptions: No API source or fetchHandler')
      }
      return []
    }

    const apiSource = source.api

    // params 표현식 평가
    const evaluatedParams: Record<string, unknown> = {}
    if (apiSource.params) {
      for (const [key, value] of Object.entries(apiSource.params)) {
        if (this.isExpression(value)) {
          const result = this.evaluator.evaluate(value as Expression, context)
          evaluatedParams[key] = result._tag === 'Ok' ? result.value : value
        } else {
          evaluatedParams[key] = value
        }
      }
    }

    // URL 빌드 (GET인 경우 쿼리스트링 추가)
    let url = apiSource.endpoint
    const method = apiSource.method ?? 'GET'

    if (method === 'GET' && Object.keys(evaluatedParams).length > 0) {
      const searchParams = new URLSearchParams()
      for (const [k, v] of Object.entries(evaluatedParams)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v))
        }
      }
      url = `${url}?${searchParams.toString()}`
    }

    try {
      const data = await this.options.fetchHandler(url, {
        method,
        body: method !== 'GET' ? evaluatedParams : undefined,
      })

      return this.transformApiResponse(data, apiSource.transform)
    } catch (error) {
      if (this.options.debug) {
        console.error('[FormRuntime] fetchOptions error:', error)
      }
      return []
    }
  }

  /**
   * API 응답을 EnumValue 배열로 변환
   */
  private transformApiResponse(data: unknown, transform?: TransformConfig): EnumValue[] {
    if (!transform) {
      return Array.isArray(data) ? (data as EnumValue[]) : []
    }

    // path로 데이터 추출
    let items = data
    if (transform.path) {
      const parts = transform.path.split('.')
      for (const part of parts) {
        if (items && typeof items === 'object') {
          items = (items as Record<string, unknown>)[part]
        }
      }
    }

    if (!Array.isArray(items)) {
      return []
    }

    // map 설정으로 EnumValue 형식으로 변환
    if (transform.map) {
      return items.map((item) => ({
        value: (item as Record<string, unknown>)[transform.map!.value] as string | number,
        label: String((item as Record<string, unknown>)[transform.map!.label]),
      }))
    }

    return items as EnumValue[]
  }

  /**
   * navigate 액션 실행
   */
  private executeNavigateAction(action: NavigateAction, context: EvaluationContext): void {
    if (!this.options.navigateHandler) {
      if (this.options.debug) {
        console.warn('[FormRuntime] navigate action: No navigateHandler configured')
      }
      return
    }

    // params 표현식 평가
    const evaluatedParams: Record<string, unknown> = {}
    if (action.params) {
      for (const [key, value] of Object.entries(action.params)) {
        if (this.isExpression(value)) {
          const result = this.evaluator.evaluate(value as Expression, context)
          evaluatedParams[key] = result._tag === 'Ok' ? result.value : value
        } else {
          evaluatedParams[key] = value
        }
      }
    }

    try {
      this.options.navigateHandler(action.path, evaluatedParams)
    } catch (error) {
      if (this.options.debug) {
        console.error('[FormRuntime] navigate error:', error)
      }
    }
  }

  /**
   * emit 액션 실행
   */
  private executeEmitAction(action: EmitAction, context: EvaluationContext): void {
    if (!this.options.emitHandler) {
      if (this.options.debug) {
        console.warn('[FormRuntime] emit action: No emitHandler configured')
      }
      return
    }

    // payload 표현식 평가
    const evaluatedPayload: Record<string, unknown> = {}
    if (action.payload) {
      for (const [key, value] of Object.entries(action.payload)) {
        if (this.isExpression(value)) {
          const result = this.evaluator.evaluate(value as Expression, context)
          evaluatedPayload[key] = result._tag === 'Ok' ? result.value : value
        } else {
          evaluatedPayload[key] = value
        }
      }
    }

    try {
      this.options.emitHandler(action.event, evaluatedPayload)
    } catch (error) {
      if (this.options.debug) {
        console.error('[FormRuntime] emit error:', error)
      }
    }
  }

  private evaluateAllExpressions(): Result<void, FormRuntimeError> {
    const context = this.buildContext()
    const result = this.tracker.evaluateAll(context)

    if (result._tag === 'Err') {
      const error = result.error
      const message = 'message' in error ? error.message : `Error: ${error.type}`
      return err({
        type: 'EVALUATION_ERROR',
        message,
      })
    }

    // 결과 적용
    this.applyExpressionResults(result.value)

    return ok(undefined)
  }

  private evaluateAffectedFields(changedFieldId: string): Result<void, FormRuntimeError> {
    const context = this.buildContext()
    const result = this.tracker.evaluateAffected(changedFieldId, context)

    if (result._tag === 'Err') {
      const error = result.error
      const message = 'message' in error ? error.message : `Error: ${error.type}`
      return err({
        type: 'EVALUATION_ERROR',
        message,
        fieldId: changedFieldId,
      })
    }

    // 결과 적용
    this.applyExpressionResults(result.value.evaluatedExpressions)

    return ok(undefined)
  }

  private applyExpressionResults(results: Map<string, unknown>): void {
    for (const [key, value] of results) {
      const [targetId, propName] = key.split('.')
      if (!targetId || !propName) continue

      // 섹션 hidden 결과 처리 (section:sectionId.hidden)
      if (targetId.startsWith('section:')) {
        const sectionId = targetId.slice(8) // 'section:' 제거
        const sectionMeta = this.sectionMetas.get(sectionId)
        if (sectionMeta && propName === 'hidden') {
          this.sectionMetas.set(sectionId, { ...sectionMeta, hidden: !!value })
        }
        continue
      }

      // 필드 결과 처리
      const meta = this.fieldMetas.get(targetId)
      if (!meta) continue

      if (propName === 'hidden') {
        this.fieldMetas.set(targetId, { ...meta, hidden: !!value })
      } else if (propName === 'disabled') {
        this.fieldMetas.set(targetId, { ...meta, disabled: !!value })
      } else if (propName === 'value') {
        this.values[targetId] = value
      }
    }
  }

  private validateField(fieldId: string): void {
    const meta = this.fieldMetas.get(fieldId)
    if (!meta) return

    const errors: string[] = []
    const value = this.values[fieldId]

    // Entity 스키마에서 필드 정의 조회
    const entityField = this.entityFieldMap.get(meta.entityFieldId)
    if (!entityField?.constraints) {
      this.fieldMetas.set(fieldId, { ...meta, errors })
      return
    }

    // 각 제약조건 평가
    const context = this.buildContext()
    for (const constraint of entityField.constraints) {
      const error = this.evaluateConstraint(constraint, value, context)
      if (error) {
        errors.push(error)
      }
    }

    this.fieldMetas.set(fieldId, { ...meta, errors })
  }

  /**
   * 제약조건 평가
   */
  private evaluateConstraint(
    constraint: Constraint,
    value: unknown,
    context: EvaluationContext
  ): string | null {
    switch (constraint.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return constraint.message ?? '필수 항목입니다'
        }
        // 배열인 경우 빈 배열 체크
        if (Array.isArray(value) && value.length === 0) {
          return constraint.message ?? '필수 항목입니다'
        }
        break

      case 'min':
        if (typeof value === 'number' && value < (constraint.value as number)) {
          return constraint.message ?? `최소값은 ${constraint.value}입니다`
        }
        if (typeof value === 'string' && value.length < (constraint.value as number)) {
          return constraint.message ?? `최소 ${constraint.value}자 이상이어야 합니다`
        }
        if (Array.isArray(value) && value.length < (constraint.value as number)) {
          return constraint.message ?? `최소 ${constraint.value}개 이상 선택해야 합니다`
        }
        break

      case 'max':
        if (typeof value === 'number' && value > (constraint.value as number)) {
          return constraint.message ?? `최대값은 ${constraint.value}입니다`
        }
        if (typeof value === 'string' && value.length > (constraint.value as number)) {
          return constraint.message ?? `최대 ${constraint.value}자 이하여야 합니다`
        }
        if (Array.isArray(value) && value.length > (constraint.value as number)) {
          return constraint.message ?? `최대 ${constraint.value}개까지 선택 가능합니다`
        }
        break

      case 'pattern':
        if (typeof value === 'string' && value !== '') {
          try {
            const regex = new RegExp(constraint.value as string)
            if (!regex.test(value)) {
              return constraint.message ?? '형식이 올바르지 않습니다'
            }
          } catch {
            if (this.options.debug) {
              console.error('[FormRuntime] Invalid regex pattern:', constraint.value)
            }
            return constraint.message ?? '형식이 올바르지 않습니다'
          }
        }
        break

      case 'custom':
        if (constraint.expression) {
          const result = this.evaluator.evaluate(constraint.expression, context)
          if (result._tag === 'Ok' && result.value === false) {
            return constraint.message ?? '검증에 실패했습니다'
          }
          if (result._tag === 'Err' && this.options.debug) {
            console.error('[FormRuntime] Custom validation expression error:', result.error)
          }
        }
        break
    }

    return null
  }

  private validateAll(): boolean {
    let isValid = true

    for (const fieldId of this.fieldMetas.keys()) {
      this.validateField(fieldId)
      const meta = this.fieldMetas.get(fieldId)
      if (meta && meta.errors.length > 0) {
        isValid = false
      }
    }

    return isValid
  }

  private isFormValid(): boolean {
    for (const meta of this.fieldMetas.values()) {
      if (meta.errors.length > 0) return false
    }
    return true
  }

  private collectErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {}

    for (const [id, meta] of this.fieldMetas) {
      if (meta.errors.length > 0) {
        errors[id] = [...meta.errors]
      }
    }

    return errors
  }

  private buildContext(): EvaluationContext {
    return {
      ...this.baseContext,
      state: { ...this.values },
    }
  }

  private findField(fieldId: string): ViewField | undefined {
    for (const section of this.schema.sections) {
      const field = section.fields.find((f) => f.id === fieldId)
      if (field) return field
    }
    return undefined
  }

  private isExpression(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string' && value.startsWith('$')) return true
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') return true
    return false
  }

  private notifyListeners(): void {
    const state = this.getState()
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  /**
   * Visibility 표현식 가져오기 (AI-Util용)
   */
  getVisibilityExpressions(): ReadonlyMap<string, Expression> {
    return this.tracker.getAllVisibilityExpressions()
  }

  /**
   * 현재 evaluation context 빌드
   */
  getEvaluationContext(): EvaluationContext {
    return this.buildContext()
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createFormRuntime = (
  schema: FormViewSchema,
  options?: FormRuntimeOptions
): FormRuntime => {
  return new FormRuntime(schema, options)
}
