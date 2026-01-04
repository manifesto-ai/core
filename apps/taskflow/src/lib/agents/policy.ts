/**
 * Policy Gate
 *
 * "자유도 vs 안전" 균형 장치
 *
 * Preflight 단계에서 강제되는 정책들:
 * - 위험도 평가 (risk assessment)
 * - 제약 조건 (constraints)
 * - confirm 자동 삽입 (destructive operations)
 */

import type { Plan, PlanStep, RiskLevel, IntentStep, ConfirmStep } from './plan';
import { extractAllIntentSteps, hasDestructiveIntent, hasConfirmStep, countTotalSteps, isIntentStep, isConfirmStep, isIfStep } from './plan';
import type { IntentSkeleton } from './skeleton';

// ============================================
// Policy Configuration
// ============================================

export interface PolicyConfig {
  /** Maximum total steps in a plan */
  maxSteps: number;
  /** Maximum write (mutation) steps */
  maxWriteSteps: number;
  /** Require confirmation for destructive operations */
  requireConfirmForDestructive: boolean;
  /** Auto-inject confirm step if missing for destructive operations */
  autoInjectConfirm: boolean;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  maxSteps: 8,
  maxWriteSteps: 4,
  requireConfirmForDestructive: true,
  autoInjectConfirm: true,
};

// ============================================
// Risk Assessment
// ============================================

/**
 * Skeleton별 위험도
 */
const SKELETON_RISK_LEVELS: Record<string, RiskLevel> = {
  // High risk - destructive operations
  DeleteTask: 'high',
  RestoreTask: 'high',

  // Medium risk - mutations
  ChangeStatus: 'medium',
  UpdateTask: 'medium',
  CreateTask: 'medium',

  // Low risk - read-only or view changes
  SelectTask: 'low',
  ChangeView: 'low',
  SetDateFilter: 'low',
  QueryTasks: 'low',
  ToggleAssistant: 'low',
  Undo: 'medium', // Undo can undo important changes
};

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  hasDestructive: boolean;
  writeStepCount: number;
  totalStepCount: number;
}

/**
 * Plan의 위험도 평가
 */
export function assessRisk(plan: Plan): RiskAssessment {
  const reasons: string[] = [];
  const intents = extractAllIntentSteps(plan);
  const totalSteps = countTotalSteps(plan);
  const hasDestructive = hasDestructiveIntent(plan);

  // Count write steps
  const writeStepCount = intents.filter(step => {
    const kind = step.skeleton.kind;
    return kind === 'CreateTask' || kind === 'UpdateTask' ||
           kind === 'ChangeStatus' || kind === 'DeleteTask' ||
           kind === 'RestoreTask';
  }).length;

  // Determine highest risk level
  let level: RiskLevel = 'low';

  // Check for destructive operations
  if (hasDestructive) {
    level = 'high';
    reasons.push('Contains destructive operation (DeleteTask or RestoreTask)');
  }

  // Check for bulk operations
  if (writeStepCount > 3) {
    level = level === 'high' ? 'high' : 'medium';
    reasons.push(`Multiple write operations (${writeStepCount})`);
  }

  // Check for multiple creates
  if (intents.filter(s => s.skeleton.kind === 'CreateTask').length > 2) {
    level = level === 'high' ? 'high' : 'medium';
    reasons.push('Multiple task creations');
  }

  // Check individual skeleton risk levels
  for (const intent of intents) {
    const skeletonRisk = SKELETON_RISK_LEVELS[intent.skeleton.kind] || 'low';
    if (skeletonRisk === 'high' && level !== 'high') {
      level = 'high';
    } else if (skeletonRisk === 'medium' && level === 'low') {
      level = 'medium';
    }
  }

  // Many steps increases risk
  if (totalSteps > 5) {
    if (level === 'low') level = 'medium';
    reasons.push(`Many steps (${totalSteps})`);
  }

  if (reasons.length === 0) {
    reasons.push(level === 'low' ? 'Simple operation' : 'Standard operation');
  }

  return {
    level,
    reasons,
    hasDestructive,
    writeStepCount,
    totalStepCount: totalSteps,
  };
}

// ============================================
// Policy Validation
// ============================================

export interface PolicyViolation {
  code: PolicyViolationCode;
  message: string;
  severity: 'error' | 'warning';
}

export type PolicyViolationCode =
  | 'TOO_MANY_STEPS'
  | 'TOO_MANY_WRITE_STEPS'
  | 'DESTRUCTIVE_WITHOUT_CONFIRM'
  | 'HIGH_RISK_UNCONFIRMED';

export interface PolicyValidationResult {
  valid: boolean;
  violations: PolicyViolation[];
  risk: RiskAssessment;
  /** Plan with auto-injected confirm steps (if applicable) */
  normalizedPlan?: Plan;
}

/**
 * Plan에 대한 정책 검증
 */
export function validatePolicy(
  plan: Plan,
  config: PolicyConfig = DEFAULT_POLICY_CONFIG
): PolicyValidationResult {
  const violations: PolicyViolation[] = [];
  const risk = assessRisk(plan);

  // Check max steps
  if (risk.totalStepCount > config.maxSteps) {
    violations.push({
      code: 'TOO_MANY_STEPS',
      message: `Plan has ${risk.totalStepCount} steps, max allowed is ${config.maxSteps}`,
      severity: 'error',
    });
  }

  // Check max write steps
  if (risk.writeStepCount > config.maxWriteSteps) {
    violations.push({
      code: 'TOO_MANY_WRITE_STEPS',
      message: `Plan has ${risk.writeStepCount} write steps, max allowed is ${config.maxWriteSteps}`,
      severity: 'error',
    });
  }

  // Check destructive operations have confirmation
  if (config.requireConfirmForDestructive && risk.hasDestructive) {
    const hasConfirm = hasConfirmStep(plan);
    if (!hasConfirm) {
      if (config.autoInjectConfirm) {
        // Auto-inject confirm - this is a warning, not an error
        violations.push({
          code: 'DESTRUCTIVE_WITHOUT_CONFIRM',
          message: 'Destructive operation without confirmation - auto-injecting confirm step',
          severity: 'warning',
        });
      } else {
        violations.push({
          code: 'DESTRUCTIVE_WITHOUT_CONFIRM',
          message: 'Destructive operation requires confirmation',
          severity: 'error',
        });
      }
    }
  }

  // Normalize plan if needed (auto-inject confirm)
  let normalizedPlan = plan;
  if (config.autoInjectConfirm && risk.hasDestructive && !hasConfirmStep(plan)) {
    normalizedPlan = injectConfirmForDestructive(plan);
  }

  const hasErrors = violations.some(v => v.severity === 'error');

  return {
    valid: !hasErrors,
    violations,
    risk,
    normalizedPlan: normalizedPlan !== plan ? normalizedPlan : undefined,
  };
}

// ============================================
// Confirm Injection
// ============================================

/**
 * 파괴적 작업에 confirm step 자동 삽입
 */
function injectConfirmForDestructive(plan: Plan): Plan {
  const newSteps: PlanStep[] = [];

  for (const step of plan.steps) {
    if (isIntentStep(step) && isDestructiveSkeleton(step.skeleton)) {
      // Wrap in confirm step
      const confirmStep: ConfirmStep = {
        kind: 'confirm',
        message: generateConfirmMessage(step.skeleton),
        onApprove: [step],
      };
      newSteps.push(confirmStep);
    } else if (isIfStep(step)) {
      // Recursively process if branches
      const newThen = step.then.map(s => injectConfirmInStep(s));
      const newElse = step.else?.map(s => injectConfirmInStep(s));
      newSteps.push({
        ...step,
        then: newThen,
        else: newElse,
      });
    } else {
      newSteps.push(step);
    }
  }

  return {
    ...plan,
    steps: newSteps,
  };
}

function injectConfirmInStep(step: PlanStep): PlanStep {
  if (isIntentStep(step) && isDestructiveSkeleton(step.skeleton)) {
    return {
      kind: 'confirm',
      message: generateConfirmMessage(step.skeleton),
      onApprove: [step],
    };
  }
  return step;
}

function isDestructiveSkeleton(skeleton: IntentSkeleton): boolean {
  return skeleton.kind === 'DeleteTask' || skeleton.kind === 'RestoreTask';
}

function generateConfirmMessage(skeleton: IntentSkeleton): string {
  if (skeleton.kind === 'DeleteTask') {
    const hint = 'targetHint' in skeleton ? (skeleton as { targetHint?: string }).targetHint : 'the task';
    return `Delete "${hint}"?`;
  }
  if (skeleton.kind === 'RestoreTask') {
    const hint = 'targetHint' in skeleton ? (skeleton as { targetHint?: string }).targetHint : 'the task';
    return `Restore "${hint}"?`;
  }
  return 'Proceed with this operation?';
}

// ============================================
// Policy Helpers
// ============================================

/**
 * Skeleton이 쓰기 작업인지 확인
 */
export function isWriteOperation(skeleton: IntentSkeleton): boolean {
  return ['CreateTask', 'UpdateTask', 'ChangeStatus', 'DeleteTask', 'RestoreTask'].includes(skeleton.kind);
}

/**
 * Skeleton이 읽기 전용인지 확인
 */
export function isReadOnlyOperation(skeleton: IntentSkeleton): boolean {
  return ['QueryTasks', 'SelectTask', 'ChangeView', 'SetDateFilter', 'ToggleAssistant'].includes(skeleton.kind);
}

/**
 * Plan이 읽기 전용인지 확인
 */
export function isPlanReadOnly(plan: Plan): boolean {
  const intents = extractAllIntentSteps(plan);
  return intents.every(step => isReadOnlyOperation(step.skeleton));
}
