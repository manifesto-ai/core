/**
 * Reactive Dependency Tracker
 *
 * 필드 변경 시 영향받는 필드들의 재평가를 조율
 */

import type { ViewField, ViewSection, FormViewSchema, Expression, Result } from '@manifesto-ai/schema'
import { ok, err } from '@manifesto-ai/schema'
import { createDependencyTracker, type DependencyTracker, type CycleError } from './dag'
import { createEvaluator, type EvaluationContext, type EvaluatorError } from '../evaluator'

// ============================================================================
// Types
// ============================================================================

export interface FieldState {
  readonly id: string
  readonly value: unknown
  readonly props: Record<string, unknown>
  readonly errors: string[]
}

export interface ReactiveState {
  readonly fields: Map<string, FieldState>
  readonly dirty: Set<string>
}

export interface UpdateResult {
  readonly updatedFields: string[]
  readonly evaluatedExpressions: Map<string, unknown>
}

export type ReactiveTrackerError = CycleError | EvaluatorError | { type: 'FIELD_NOT_FOUND'; fieldId: string }

// ============================================================================
// Reactive Tracker
// ============================================================================

export class ReactiveDependencyTracker {
  private dag: DependencyTracker
  private fieldExpressions: Map<string, Map<string, Expression>> = new Map() // fieldId -> { propName -> expr }
  private evaluator = createEvaluator()

  constructor() {
    this.dag = createDependencyTracker()
  }

  /**
   * View 스키마에서 의존성 그래프 구축
   */
  buildFromViewSchema(schema: FormViewSchema): Result<void, CycleError> {
    this.dag.clear()
    this.fieldExpressions.clear()

    // 노드 우선 등록 (섹션 및 필드)
    for (const section of schema.sections) {
      // 섹션도 노드로 등록 (section: prefix 사용)
      this.dag.addNode(`section:${section.id}`)
      for (const field of section.fields) {
        this.dag.addNode(field.id)
      }
    }

    for (const section of schema.sections) {
      // 섹션의 visible 표현식 처리
      const sectionExpressions = this.extractSectionExpressions(section)
      if (sectionExpressions.size > 0) {
        const sectionNodeId = `section:${section.id}`
        const existing = this.fieldExpressions.get(sectionNodeId) ?? new Map()
        for (const [propName, expr] of sectionExpressions) {
          existing.set(propName, expr)
        }
        this.fieldExpressions.set(sectionNodeId, existing)

        // 섹션 표현식에서 참조하는 필드들을 의존성으로 추가
        const referencedFields = this.extractReferencedFields(sectionExpressions)
        if (referencedFields.length > 0) {
          const result = this.dag.addDependencies(sectionNodeId, referencedFields)
          if (result._tag === 'Err') return result
        }
      }

      for (const field of section.fields) {
        // dependsOn 명시적 의존성
        if (field.dependsOn && field.dependsOn.length > 0) {
          const result = this.dag.addDependencies(field.id, [...field.dependsOn])
          if (result._tag === 'Err') return result
        }

        // 표현식에서 의존성 추출
        const expressionsByTarget = this.extractExpressions(field)
        for (const [targetFieldId, expressions] of expressionsByTarget) {
          // 동일 타겟에 대한 표현식 병합
          const existing = this.fieldExpressions.get(targetFieldId) ?? new Map()
          for (const [propName, expr] of expressions) {
            existing.set(propName, expr)
          }
          this.fieldExpressions.set(targetFieldId, existing)

          // 표현식에서 참조하는 필드들을 의존성으로 추가 (자기 자신 제외)
          const referencedFields = this.extractReferencedFields(expressions)
            .filter(refField => refField !== targetFieldId) // 자기 참조 제외
          if (referencedFields.length > 0) {
            const result = this.dag.addDependencies(targetFieldId, referencedFields)
            if (result._tag === 'Err') return result
          }
        }
      }
    }

    return ok(undefined)
  }

  /**
   * 필드 변경 시 영향받는 필드들 계산
   */
  getAffectedFields(changedFieldId: string): string[] {
    return Array.from(this.dag.getAffectedNodes(changedFieldId))
  }

  /**
   * 변경된 필드에 대해 표현식 재평가 수행
   */
  evaluateAffected(
    changedFieldId: string,
    context: EvaluationContext
  ): Result<UpdateResult, ReactiveTrackerError> {
    const affected = this.getAffectedFields(changedFieldId)

    // 평가 순서 결정
    const orderResult = this.dag.getEvaluationOrder([changedFieldId, ...affected])
    if (orderResult._tag === 'Err') return orderResult

    const evaluatedExpressions = new Map<string, unknown>()
    const updatedFieldsSet = new Set<string>() // O(1) lookup으로 최적화

    // 순서대로 평가
    for (const fieldId of orderResult.value) {
      const expressions = this.fieldExpressions.get(fieldId)
      if (!expressions) continue

      for (const [propName, expr] of expressions) {
        const result = this.evaluator.evaluate(expr, context)
        if (result._tag === 'Err') {
          return err(result.error)
        }

        evaluatedExpressions.set(`${fieldId}.${propName}`, result.value)
        updatedFieldsSet.add(fieldId) // Set.add는 자동으로 중복 제거
      }
    }

    return ok({ updatedFields: Array.from(updatedFieldsSet), evaluatedExpressions })
  }

  /**
   * 초기 로드 시 모든 표현식 평가
   */
  evaluateAll(context: EvaluationContext): Result<Map<string, unknown>, ReactiveTrackerError> {
    const sortResult = this.dag.topologicalSort()
    if (sortResult._tag === 'Err') return sortResult

    const results = new Map<string, unknown>()

    for (const fieldId of sortResult.value) {
      const expressions = this.fieldExpressions.get(fieldId)
      if (!expressions) continue

      for (const [propName, expr] of expressions) {
        const result = this.evaluator.evaluate(expr, context)
        if (result._tag === 'Err') {
          return err(result.error)
        }
        results.set(`${fieldId}.${propName}`, result.value)
      }
    }

    return ok(results)
  }

  /**
   * 의존성 그래프 내보내기 (디버깅용)
   */
  exportGraph() {
    return this.dag.export()
  }

  /**
   * 특정 필드의 특정 속성에 대한 표현식 가져오기
   */
  getFieldExpression(fieldId: string, propName: string): Expression | undefined {
    return this.fieldExpressions.get(fieldId)?.get(propName)
  }

  /**
   * 특정 필드의 visibility 표현식 가져오기
   */
  getVisibilityExpression(fieldId: string): Expression | undefined {
    return this.getFieldExpression(fieldId, 'hidden')
  }

  /**
   * 모든 visibility 표현식 가져오기
   */
  getAllVisibilityExpressions(): ReadonlyMap<string, Expression> {
    const result = new Map<string, Expression>()
    for (const [fieldId, expressions] of this.fieldExpressions) {
      const hiddenExpr = expressions.get('hidden')
      if (hiddenExpr !== undefined) {
        result.set(fieldId, hiddenExpr)
      }
    }
    return result
  }

  /**
   * 섹션에서 표현식 추출
   */
  private extractSectionExpressions(section: ViewSection): Map<string, Expression> {
    const expressions = new Map<string, Expression>()

    // section.visible 표현식 추출 (visible의 반대가 hidden)
    if (section.visible !== undefined && this.isExpression(section.visible)) {
      const visibleExpr = section.visible as Expression
      // { _expr: 'not', condition: visibleExpr } 형태로 래핑하여 hidden으로 변환
      const hiddenExpr: Expression = { _expr: 'not', condition: visibleExpr } as unknown as Expression
      expressions.set('hidden', hiddenExpr)
    }

    return expressions
  }

  /**
   * 필드에서 표현식 추출
   */
  private extractExpressions(field: ViewField): Map<string, Map<string, Expression>> {
    const expressionsByTarget = new Map<string, Map<string, Expression>>()

    const addExpression = (targetId: string, propName: string, expr: Expression) => {
      const map = expressionsByTarget.get(targetId) ?? new Map<string, Expression>()
      map.set(propName, expr)
      expressionsByTarget.set(targetId, map)
    }

    // field.hidden 표현식 추출
    if (field.hidden !== undefined && this.isExpression(field.hidden)) {
      addExpression(field.id, 'hidden', field.hidden as Expression)
    }

    // field.visibility 표현식 추출 (hidden의 반대)
    // visibility=true → hidden=false 이므로 not 연산으로 래핑
    if (field.visibility !== undefined && this.isExpression(field.visibility)) {
      const visibilityExpr = field.visibility as Expression
      // { _expr: 'not', condition: visibilityExpr } 형태로 래핑
      const hiddenExpr: Expression = { _expr: 'not', condition: visibilityExpr } as unknown as Expression
      addExpression(field.id, 'hidden', hiddenExpr)
    }

    // field.disabled 표현식 추출
    if (field.disabled !== undefined && this.isExpression(field.disabled)) {
      addExpression(field.id, 'disabled', field.disabled as Expression)
    }

    // reactions에서 표현식 추출
    if (field.reactions) {
      field.reactions.forEach((reaction, reactionIndex) => {
        // condition
        if (reaction.condition) {
          addExpression(field.id, `reaction_condition_${reactionIndex}`, reaction.condition)
        }

        // actions의 값들
        for (const action of reaction.actions) {
          if (action.type === 'setValue' && this.isExpression(action.value)) {
            addExpression(action.target, 'value', action.value as Expression)
          }
          if (action.type === 'updateProp' && this.isExpression(action.value)) {
            addExpression(action.target, action.prop, action.value as Expression)
          }
        }
      })
    }

    return expressionsByTarget
  }

  /**
   * 표현식에서 참조하는 필드 ID 추출
   */
  private extractReferencedFields(expressions: Map<string, Expression>): string[] {
    const fields = new Set<string>()

    const extract = (expr: unknown): void => {
      if (typeof expr === 'string' && expr.startsWith('$state.')) {
        // $state.fieldName에서 fieldName 추출
        const fieldName = expr.slice(7).split('.')[0]
        if (fieldName) {
          fields.add(fieldName)
        }
      } else if (Array.isArray(expr)) {
        for (const item of expr) {
          extract(item)
        }
      } else if (typeof expr === 'object' && expr !== null && '_expr' in expr) {
        // 객체 형태의 표현식에서 필드 참조 추출
        const objExpr = expr as Record<string, unknown>
        if (objExpr.field && typeof objExpr.field === 'string') {
          fields.add(objExpr.field)
        }
        // 중첩된 조건들 처리 (and, or)
        if (objExpr.conditions && Array.isArray(objExpr.conditions)) {
          for (const condition of objExpr.conditions) {
            extract(condition)
          }
        }
        // not 조건 처리
        if (objExpr.condition) {
          extract(objExpr.condition)
        }
      }
    }

    for (const expr of expressions.values()) {
      extract(expr)
    }

    return Array.from(fields)
  }

  /**
   * 값이 표현식인지 확인
   */
  private isExpression(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string' && value.startsWith('$')) return true
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      // 연산자로 시작하는 배열
      return true
    }
    // 객체 형태의 표현식 (예: { _expr: 'eq', field: 'x', value: 1 })
    if (typeof value === 'object' && '_expr' in (value as object)) {
      return true
    }
    return false
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createReactiveTracker = (): ReactiveDependencyTracker => {
  return new ReactiveDependencyTracker()
}
