/**
 * Plan-Native Agent Runtime Types
 *
 * LLM은 Plan을 생성하고, Runtime은 검증/실행한다.
 *
 * 핵심 원칙:
 * - LLM 출력에 taskId 절대 금지 (targetHint만)
 * - Plan.steps로 멀티스텝 구성
 * - 파괴적 작업은 confirm step 필수
 * - 실패 시 전체 롤백 (원자성)
 */

import type { IntentSkeleton } from './skeleton';
import type { TaskStatus, TaskPriority, DateFilter } from './types';

// ============================================
// Plan (LLM 출력 최상위)
// ============================================

export interface Plan {
  version: 1;
  locale?: string; // 'ko' | 'en' | etc.
  goal: string; // 유저 요청 요약
  steps: PlanStep[];
  risk?: RiskLevel; // planner의 자기평가 (참고용)
}

export type RiskLevel = 'low' | 'medium' | 'high';

// ============================================
// PlanStep (유연성의 핵심)
// ============================================

export type PlanStep =
  | IntentStep
  | QueryStep
  | IfStep
  | ConfirmStep
  | NoteStep;

export interface IntentStep {
  kind: 'intent';
  skeleton: IntentSkeleton;
}

export interface QueryStep {
  kind: 'query';
  query: QuerySpec;
  assign?: string; // 결과를 저장할 변수명
}

export interface IfStep {
  kind: 'if';
  cond: Condition;
  then: PlanStep[];
  else?: PlanStep[];
}

export interface ConfirmStep {
  kind: 'confirm';
  message: string; // 사용자에게 표시할 메시지
  onApprove: PlanStep[];
  onReject?: PlanStep[];
}

export interface NoteStep {
  kind: 'note';
  text: string; // 사용자에게 설명 (실행 없음)
}

// ============================================
// QuerySpec (읽기 전용 쿼리)
// ============================================

export type QuerySpec =
  | CountTasksQuery
  | FindTaskQuery
  | ListTasksQuery;

export interface CountTasksQuery {
  kind: 'countTasks';
  filter?: FilterSpec;
}

export interface FindTaskQuery {
  kind: 'findTask';
  hint: string; // resolver가 사용할 힌트
}

export interface ListTasksQuery {
  kind: 'listTasks';
  filter?: FilterSpec;
  limit?: number;
}

// ============================================
// FilterSpec (쿼리 필터)
// ============================================

export interface FilterSpec {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  dateFilter?: DateFilter;
  tags?: string[];
  deleted?: boolean;
}

// ============================================
// Condition (조건식)
// ============================================

export type Condition =
  | CompareCondition
  | ExistsCondition
  | LogicalCondition;

export interface CompareCondition {
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';
  left: VarRef | LiteralValue;
  right: VarRef | LiteralValue;
}

export interface ExistsCondition {
  op: 'exists' | 'notExists';
  var: VarRef;
}

export interface LogicalCondition {
  op: 'and' | 'or' | 'not';
  items: Condition[];
}

export interface VarRef {
  var: string; // assign로 받은 값 참조
}

export type LiteralValue = string | number | boolean | null;

// ============================================
// Plan Validation
// ============================================

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePlan(plan: unknown): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan must be an object'], warnings: [] };
  }

  const p = plan as Record<string, unknown>;

  // version 검증
  if (p.version !== 1) {
    errors.push('Plan.version must be 1');
  }

  // goal 검증
  if (!p.goal || typeof p.goal !== 'string') {
    errors.push('Plan.goal is required and must be a string');
  }

  // steps 검증
  if (!Array.isArray(p.steps)) {
    errors.push('Plan.steps must be an array');
  } else if (p.steps.length === 0) {
    errors.push('Plan.steps must not be empty');
  } else {
    for (let i = 0; i < p.steps.length; i++) {
      const stepErrors = validatePlanStep(p.steps[i], `steps[${i}]`);
      errors.push(...stepErrors);
    }
  }

  // risk 검증 (optional)
  if (p.risk !== undefined && !['low', 'medium', 'high'].includes(p.risk as string)) {
    warnings.push('Plan.risk should be "low", "medium", or "high"');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validatePlanStep(step: unknown, path: string): string[] {
  const errors: string[] = [];

  if (!step || typeof step !== 'object') {
    return [`${path}: must be an object`];
  }

  const s = step as Record<string, unknown>;

  if (!s.kind || typeof s.kind !== 'string') {
    return [`${path}: must have a "kind" field`];
  }

  switch (s.kind) {
    case 'intent':
      if (!s.skeleton || typeof s.skeleton !== 'object') {
        errors.push(`${path}: intent step must have a "skeleton" object`);
      }
      break;

    case 'query':
      if (!s.query || typeof s.query !== 'object') {
        errors.push(`${path}: query step must have a "query" object`);
      }
      break;

    case 'if':
      if (!s.cond || typeof s.cond !== 'object') {
        errors.push(`${path}: if step must have a "cond" object`);
      }
      if (!Array.isArray(s.then)) {
        errors.push(`${path}: if step must have a "then" array`);
      } else {
        for (let i = 0; i < s.then.length; i++) {
          errors.push(...validatePlanStep(s.then[i], `${path}.then[${i}]`));
        }
      }
      if (s.else !== undefined && Array.isArray(s.else)) {
        for (let i = 0; i < s.else.length; i++) {
          errors.push(...validatePlanStep(s.else[i], `${path}.else[${i}]`));
        }
      }
      break;

    case 'confirm':
      if (!s.message || typeof s.message !== 'string') {
        errors.push(`${path}: confirm step must have a "message" string`);
      }
      if (!Array.isArray(s.onApprove)) {
        errors.push(`${path}: confirm step must have an "onApprove" array`);
      } else {
        for (let i = 0; i < s.onApprove.length; i++) {
          errors.push(...validatePlanStep(s.onApprove[i], `${path}.onApprove[${i}]`));
        }
      }
      if (s.onReject !== undefined && Array.isArray(s.onReject)) {
        for (let i = 0; i < s.onReject.length; i++) {
          errors.push(...validatePlanStep(s.onReject[i], `${path}.onReject[${i}]`));
        }
      }
      break;

    case 'note':
      if (!s.text || typeof s.text !== 'string') {
        errors.push(`${path}: note step must have a "text" string`);
      }
      break;

    default:
      errors.push(`${path}: unknown step kind "${s.kind}"`);
  }

  return errors;
}

// ============================================
// Type Guards
// ============================================

export function isIntentStep(step: PlanStep): step is IntentStep {
  return step.kind === 'intent';
}

export function isQueryStep(step: PlanStep): step is QueryStep {
  return step.kind === 'query';
}

export function isIfStep(step: PlanStep): step is IfStep {
  return step.kind === 'if';
}

export function isConfirmStep(step: PlanStep): step is ConfirmStep {
  return step.kind === 'confirm';
}

export function isNoteStep(step: PlanStep): step is NoteStep {
  return step.kind === 'note';
}

// ============================================
// Plan Utilities
// ============================================

/**
 * Plan에서 모든 Intent steps를 flat하게 추출 (if/confirm 내부 포함)
 */
export function extractAllIntentSteps(plan: Plan): IntentStep[] {
  const intents: IntentStep[] = [];

  function traverse(steps: PlanStep[]) {
    for (const step of steps) {
      if (isIntentStep(step)) {
        intents.push(step);
      } else if (isIfStep(step)) {
        traverse(step.then);
        if (step.else) traverse(step.else);
      } else if (isConfirmStep(step)) {
        traverse(step.onApprove);
        if (step.onReject) traverse(step.onReject);
      }
    }
  }

  traverse(plan.steps);
  return intents;
}

/**
 * Plan의 총 step 수 계산 (중첩 포함)
 */
export function countTotalSteps(plan: Plan): number {
  let count = 0;

  function traverse(steps: PlanStep[]) {
    for (const step of steps) {
      count++;
      if (isIfStep(step)) {
        traverse(step.then);
        if (step.else) traverse(step.else);
      } else if (isConfirmStep(step)) {
        traverse(step.onApprove);
        if (step.onReject) traverse(step.onReject);
      }
    }
  }

  traverse(plan.steps);
  return count;
}

/**
 * Plan에 파괴적 Intent가 있는지 확인
 */
export function hasDestructiveIntent(plan: Plan): boolean {
  const intents = extractAllIntentSteps(plan);
  return intents.some(step => {
    const kind = step.skeleton.kind;
    return kind === 'DeleteTask' || kind === 'RestoreTask';
  });
}

/**
 * Plan에 confirm step이 있는지 확인
 */
export function hasConfirmStep(plan: Plan): boolean {
  function traverse(steps: PlanStep[]): boolean {
    for (const step of steps) {
      if (isConfirmStep(step)) return true;
      if (isIfStep(step)) {
        if (traverse(step.then)) return true;
        if (step.else && traverse(step.else)) return true;
      }
    }
    return false;
  }

  return traverse(plan.steps);
}
