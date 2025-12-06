/**
 * Sync Manager
 *
 * Entity 변경 감지 및 View 동기화의 메인 API
 */

import type { FormViewSchema, ListViewSchema } from '../types'
import type {
  SyncManagerInput,
  SyncManagerOutput,
  SyncResult,
  ViewImpactAnalysis,
  SyncManagerConfig,
  SuggestedAction,
} from './types'
import { DEFAULT_SYNC_CONFIG, isFormView, isListView } from './types'
import { diffEntities, type DiffOptions } from './diff/entity-diff'
import {
  analyzeFormViewImpact,
  applyFormStrategy,
} from './strategies/form-strategy'
import {
  analyzeListViewImpact,
  applyListStrategy,
} from './strategies/list-strategy'
import {
  findBrokenReferencesInForm,
  findBrokenReferencesInList,
} from './strategies/reaction-strategy'

// ============================================================================
// Main API
// ============================================================================

/**
 * Entity 변경에 따라 View들을 동기화
 *
 * @param input - 동기화 입력 (old/new Entity, Views, Config)
 * @returns 동기화 결과 (변경 사항, 영향 분석, 업데이트된 View)
 *
 * @example
 * ```typescript
 * const result = syncViews({
 *   oldEntity,
 *   newEntity,
 *   views: [formView, listView],
 *   config: { mode: 'auto-safe', includeNewFields: false }
 * })
 *
 * for (const sync of result.syncResults) {
 *   console.log('Updated:', sync.viewId)
 *   console.log('Applied:', sync.appliedActions.length, 'actions')
 * }
 * ```
 */
export const syncViews = (input: SyncManagerInput): SyncManagerOutput => {
  const config: SyncManagerConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...input.config,
  }

  const diffOptions: DiffOptions = {
    fieldMappingHints: config.fieldMappingHints,
  }

  // 1. Entity 변경 감지
  const changes = diffEntities(input.oldEntity, input.newEntity, diffOptions)

  // 변경 없으면 조기 반환
  if (changes.changes.length === 0) {
    return {
      changes,
      viewImpacts: [],
      syncResults: input.views.map(view => ({
        viewId: view.id,
        viewType: isFormView(view) ? 'form' : 'list',
        originalView: view,
        updatedView: view,
        appliedActions: [],
        skippedActions: [],
        warnings: [],
        requiresReview: false,
      })),
    }
  }

  // 2. 각 View에 대해 영향 분석 및 업데이트 실행
  const viewImpacts: ViewImpactAnalysis[] = []
  const syncResults: SyncResult[] = []

  for (const view of input.views) {
    if (isFormView(view)) {
      // FormView 처리
      const impact = analyzeFormViewImpact(view, changes)

      // 깨진 참조 추가
      const removedIds = new Set(
        changes.changes
          .filter(c => c._type === 'FIELD_REMOVED')
          .map(c => (c as { fieldId: string }).fieldId)
      )
      const brokenRefs = findBrokenReferencesInForm(view, removedIds)
      const enrichedImpact = {
        ...impact,
        brokenReferences: [...impact.brokenReferences, ...brokenRefs],
      }

      viewImpacts.push(enrichedImpact)

      const strategyResult = applyFormStrategy(view, enrichedImpact, changes, config)

      syncResults.push({
        viewId: view.id,
        viewType: 'form',
        originalView: view,
        updatedView: strategyResult.updatedView,
        appliedActions: strategyResult.appliedActions,
        skippedActions: strategyResult.skippedActions,
        warnings: strategyResult.warnings,
        requiresReview: enrichedImpact.requiresReview || strategyResult.skippedActions.length > 0,
      })
    } else if (isListView(view)) {
      // ListView 처리
      const impact = analyzeListViewImpact(view, changes)

      // 깨진 참조 추가
      const removedIds = new Set(
        changes.changes
          .filter(c => c._type === 'FIELD_REMOVED')
          .map(c => (c as { fieldId: string }).fieldId)
      )
      const brokenRefs = findBrokenReferencesInList(view, removedIds)
      const enrichedImpact = {
        ...impact,
        brokenReferences: [...impact.brokenReferences, ...brokenRefs],
      }

      viewImpacts.push(enrichedImpact)

      const strategyResult = applyListStrategy(view, enrichedImpact, changes, config)

      syncResults.push({
        viewId: view.id,
        viewType: 'list',
        originalView: view,
        updatedView: strategyResult.updatedView,
        appliedActions: strategyResult.appliedActions,
        skippedActions: strategyResult.skippedActions,
        warnings: strategyResult.warnings,
        requiresReview: enrichedImpact.requiresReview || strategyResult.skippedActions.length > 0,
      })
    }
  }

  return {
    changes,
    viewImpacts,
    syncResults,
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * FormView만 동기화
 */
export const syncFormView = (
  oldEntity: SyncManagerInput['oldEntity'],
  newEntity: SyncManagerInput['newEntity'],
  formView: FormViewSchema,
  config?: Partial<SyncManagerConfig>
): SyncResult => {
  const result = syncViews({
    oldEntity,
    newEntity,
    views: [formView],
    config,
  })

  return result.syncResults[0]!
}

/**
 * ListView만 동기화
 */
export const syncListView = (
  oldEntity: SyncManagerInput['oldEntity'],
  newEntity: SyncManagerInput['newEntity'],
  listView: ListViewSchema,
  config?: Partial<SyncManagerConfig>
): SyncResult => {
  const result = syncViews({
    oldEntity,
    newEntity,
    views: [listView],
    config,
  })

  return result.syncResults[0]!
}

/**
 * View 영향 분석만 수행 (실제 업데이트 없음)
 */
export const analyzeViewImpact = (
  oldEntity: SyncManagerInput['oldEntity'],
  newEntity: SyncManagerInput['newEntity'],
  views: SyncManagerInput['views'],
  config?: Partial<SyncManagerConfig>
): {
  changes: SyncManagerOutput['changes']
  viewImpacts: readonly ViewImpactAnalysis[]
} => {
  const fullConfig: SyncManagerConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...config,
    mode: 'manual', // 강제로 manual 모드 - 분석만
  }

  const diffOptions: DiffOptions = {
    fieldMappingHints: fullConfig.fieldMappingHints,
  }

  const changes = diffEntities(oldEntity, newEntity, diffOptions)

  const viewImpacts: ViewImpactAnalysis[] = []

  for (const view of views) {
    if (isFormView(view)) {
      const impact = analyzeFormViewImpact(view, changes)
      viewImpacts.push(impact)
    } else if (isListView(view)) {
      const impact = analyzeListViewImpact(view, changes)
      viewImpacts.push(impact)
    }
  }

  return { changes, viewImpacts }
}

/**
 * 특정 Action만 선택적으로 적용
 */
export const applySuggestedActions = (
  view: FormViewSchema | ListViewSchema,
  changes: SyncManagerOutput['changes'],
  actionIndices: number[],
  config?: Partial<SyncManagerConfig>
): SyncResult => {
  const fullConfig: SyncManagerConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...config,
    mode: 'auto-all', // 선택된 것은 모두 적용
  }

  // 영향 분석
  let impact: ViewImpactAnalysis

  if (isFormView(view)) {
    impact = analyzeFormViewImpact(view, changes)
  } else {
    impact = analyzeListViewImpact(view, changes)
  }

  // 선택된 액션만 포함하는 impact 생성
  const selectedActions = actionIndices
    .map(i => impact.suggestedActions[i])
    .filter((a): a is SuggestedAction => a !== undefined)
  const filteredImpact: ViewImpactAnalysis = {
    ...impact,
    suggestedActions: selectedActions,
  }

  // 적용
  if (isFormView(view)) {
    const result = applyFormStrategy(view, filteredImpact, changes, fullConfig)
    return {
      viewId: view.id,
      viewType: 'form',
      originalView: view,
      updatedView: result.updatedView,
      appliedActions: result.appliedActions,
      skippedActions: result.skippedActions,
      warnings: result.warnings,
      requiresReview: false,
    }
  } else {
    const result = applyListStrategy(view, filteredImpact, changes, fullConfig)
    return {
      viewId: view.id,
      viewType: 'list',
      originalView: view,
      updatedView: result.updatedView,
      appliedActions: result.appliedActions,
      skippedActions: result.skippedActions,
      warnings: result.warnings,
      requiresReview: false,
    }
  }
}

// ============================================================================
// Summary Utilities
// ============================================================================

/**
 * Sync 결과 요약 생성
 */
export const summarizeSyncResults = (output: SyncManagerOutput): string => {
  const lines: string[] = []

  // Changes summary
  lines.push(`Entity Changes: ${output.changes.changes.length}`)
  if (output.changes.hasBreakingChanges) {
    lines.push('⚠️ Contains breaking changes')
  }

  // View impacts
  for (const impact of output.viewImpacts) {
    lines.push(`\nView: ${impact.viewId} (${impact.viewType})`)
    lines.push(`  Affected elements: ${impact.affectedElements.length}`)
    lines.push(`  Suggested actions: ${impact.suggestedActions.length}`)
    if (impact.requiresReview) {
      lines.push('  ⚠️ Requires review')
    }
  }

  // Sync results
  for (const result of output.syncResults) {
    lines.push(`\nSync Result: ${result.viewId}`)
    lines.push(`  Applied: ${result.appliedActions.length}`)
    lines.push(`  Skipped: ${result.skippedActions.length}`)
    if (result.warnings.length > 0) {
      lines.push(`  Warnings: ${result.warnings.length}`)
    }
  }

  return lines.join('\n')
}

/**
 * 리뷰가 필요한 View만 필터링
 */
export const getViewsRequiringReview = (
  output: SyncManagerOutput
): readonly SyncResult[] =>
  output.syncResults.filter(r => r.requiresReview)

/**
 * 모든 skipped actions 수집
 */
export const getAllSkippedActions = (
  output: SyncManagerOutput
): readonly { viewId: string; action: { action: any; reason: string } }[] =>
  output.syncResults.flatMap(result =>
    result.skippedActions.map(skipped => ({
      viewId: result.viewId,
      action: skipped,
    }))
  )
