/**
 * Action Schema Combinator
 *
 * 액션 스텝들을 조합하여 Action 스키마(워크플로우)를 구성
 */

import type {
  ActionSchema,
  ActionStep,
  ActionTrigger,
  SchemaVersion,
} from '../types'

// ============================================================================
// Action Builder
// ============================================================================

export interface ActionBuilder {
  readonly _schema: ActionSchema
  description(desc: string): ActionBuilder
  tags(...tags: string[]): ActionBuilder
  step(step: ActionStep): ActionBuilder
  steps(...steps: ActionStep[]): ActionBuilder
  rollback(...steps: ActionStep[]): ActionBuilder
  timeout(ms: number): ActionBuilder
  retries(count: number): ActionBuilder
  build(): ActionSchema
}

const createActionBuilder = (schema: ActionSchema): ActionBuilder => ({
  _schema: schema,

  description(description: string) {
    return createActionBuilder({ ...this._schema, description })
  },

  tags(...tags: string[]) {
    return createActionBuilder({
      ...this._schema,
      tags: [...(this._schema.tags ?? []), ...tags],
    })
  },

  step(step: ActionStep) {
    return createActionBuilder({
      ...this._schema,
      steps: [...this._schema.steps, step],
    })
  },

  steps(...steps: ActionStep[]) {
    return createActionBuilder({
      ...this._schema,
      steps: [...this._schema.steps, ...steps],
    })
  },

  rollback(...steps: ActionStep[]) {
    return createActionBuilder({
      ...this._schema,
      rollback: [...(this._schema.rollback ?? []), ...steps],
    })
  },

  timeout(timeout: number) {
    return createActionBuilder({ ...this._schema, timeout })
  },

  retries(retries: number) {
    return createActionBuilder({ ...this._schema, retries })
  },

  build() {
    return this._schema
  },
})

/**
 * Action 스키마 생성
 *
 * @example
 * const createProductAction = action('create-product', 'Create Product', '0.1.0')
 *   .trigger(trigger.manual())
 *   .steps(
 *     api.post('createProduct', '/api/products').body($state).build(),
 *     navigate('afterCreate', '/products/:id')
 *   )
 *   .build()
 */
export const action = (
  id: string,
  name: string,
  version: SchemaVersion = '0.1.0'
) => ({
  trigger(trigger: ActionTrigger): ActionBuilder {
    return createActionBuilder({
      _type: 'action',
      id,
      version,
      name,
      trigger,
      steps: [],
    })
  },
})

// ============================================================================
// Trigger Helpers
// ============================================================================

export const trigger = {
  manual(): ActionTrigger {
    return { type: 'manual' }
  },

  event(eventName: string): ActionTrigger {
    return { type: 'event', event: eventName }
  },

  schedule(cron: string): ActionTrigger {
    return { type: 'schedule', cron }
  },
}

// ============================================================================
// Workflow Composition Helpers
// ============================================================================

/**
 * 여러 액션을 순차적으로 실행하는 파이프라인 생성
 */
export const pipeline = (...steps: ActionStep[]): ActionStep[] => steps

/**
 * 조건부 분기
 */
export { condition } from '../primitives/action'

/**
 * 병렬 실행
 */
export { parallel } from '../primitives/action'
