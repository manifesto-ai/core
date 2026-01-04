/**
 * Preflight - Resolver + Policy
 *
 * Plan 실행 전 검증:
 * 1. Policy 검증 (위험도, 제약조건, confirm 삽입)
 * 2. Symbol Resolution (targetHint → taskId 바인딩)
 *
 * 모든 검증을 통과해야 ExecutablePlan이 생성됨
 */

import type { Task } from '@/manifesto';
import type { Plan, PlanStep, IntentStep, QueryStep, IfStep, ConfirmStep, NoteStep } from './plan';
import { isIntentStep, isQueryStep, isIfStep, isConfirmStep, isNoteStep, extractAllIntentSteps } from './plan';
import type { IntentSkeleton } from './skeleton';
import { requiresTaskResolution } from './skeleton';
import type { Intent } from './intent';
import type { Snapshot } from './runtime';
import { resolveSkeleton, isResolverError, type ResolverError, type ResolverResult } from './resolver';
import { validatePolicy, assessRisk, type PolicyConfig, DEFAULT_POLICY_CONFIG, type RiskAssessment, type PolicyViolation } from './policy';

// ============================================
// Types
// ============================================

export interface Warning {
  code: string;
  message: string;
}

export interface ExecutablePlan {
  /** Original plan */
  plan: Plan;
  /** Bound steps with resolved taskIds */
  boundSteps: BoundStep[];
  /** Snapshot version for optimistic concurrency */
  snapshotVersion: number;
  /** Risk assessment */
  risk: RiskAssessment;
}

/**
 * BoundStep - PlanStep with resolved intents
 */
export type BoundStep =
  | BoundIntentStep
  | BoundQueryStep
  | BoundIfStep
  | BoundConfirmStep
  | BoundNoteStep;

export interface BoundIntentStep {
  kind: 'intent';
  intent: Intent; // taskId resolved
  originalSkeleton: IntentSkeleton;
  resolvedTask?: Task;
}

export interface BoundQueryStep {
  kind: 'query';
  query: QueryStep['query'];
  assign?: string;
}

export interface BoundIfStep {
  kind: 'if';
  cond: IfStep['cond'];
  then: BoundStep[];
  else?: BoundStep[];
}

export interface BoundConfirmStep {
  kind: 'confirm';
  message: string;
  onApprove: BoundStep[];
  onReject?: BoundStep[];
}

export interface BoundNoteStep {
  kind: 'note';
  text: string;
}

// ============================================
// Clarification Request
// ============================================

export type ClarificationReason =
  | 'AMBIGUOUS_TARGET'      // Multiple tasks match
  | 'NOT_FOUND'             // No task found
  | 'POLICY_CONFIRM_REQUIRED' // Policy requires user confirmation
  | 'TOO_MANY_STEPS'        // Exceeds step limit
  | 'VERSION_CONFLICT';     // Snapshot version mismatch

export interface ClarificationRequest {
  reason: ClarificationReason;
  message: string;
  question: string;
  candidates?: Array<{ id: string; title: string }>;
  /** Original skeleton that failed resolution */
  failedSkeleton?: IntentSkeleton;
  /** Step index where resolution failed */
  failedStepIndex?: number;
}

// ============================================
// Preflight Result
// ============================================

export type PreflightResult =
  | { ok: true; executable: ExecutablePlan; warnings: Warning[] }
  | { ok: false; needsClarification: ClarificationRequest; partial?: ExecutablePlan };

// ============================================
// Main Preflight Function
// ============================================

/**
 * Plan에 대한 사전 검증 수행
 *
 * @param plan - 검증할 Plan
 * @param snapshot - 현재 Snapshot
 * @param config - Policy 설정
 * @returns PreflightResult
 */
export function runPreflight(
  plan: Plan,
  snapshot: Snapshot,
  config: PolicyConfig = DEFAULT_POLICY_CONFIG
): PreflightResult {
  const warnings: Warning[] = [];

  // 1. Policy Validation
  const policyResult = validatePolicy(plan, config);

  // Add policy warnings
  for (const violation of policyResult.violations) {
    if (violation.severity === 'warning') {
      warnings.push({
        code: violation.code,
        message: violation.message,
      });
    }
  }

  // Check for policy errors
  const policyErrors = policyResult.violations.filter(v => v.severity === 'error');
  if (policyErrors.length > 0) {
    const firstError = policyErrors[0]!;
    return {
      ok: false,
      needsClarification: {
        reason: mapPolicyViolationToReason(firstError),
        message: firstError.message,
        question: generatePolicyQuestion(firstError),
      },
    };
  }

  // Use normalized plan (with auto-injected confirms) if available
  const workingPlan = policyResult.normalizedPlan || plan;

  // 2. Symbol Resolution (bind targetHint → taskId)
  const resolutionResult = resolveAllSteps(workingPlan.steps, snapshot);

  if (!resolutionResult.success) {
    const error = resolutionResult.error;
    return {
      ok: false,
      needsClarification: {
        reason: mapResolverErrorToReason(error.type),
        message: error.message,
        question: error.suggestedQuestion,
        candidates: error.candidates?.map(t => ({ id: t.id, title: t.title })),
        failedSkeleton: error.skeleton,
        failedStepIndex: error.stepIndex,
      },
    };
  }

  // 3. Build ExecutablePlan
  const executable: ExecutablePlan = {
    plan: workingPlan,
    boundSteps: resolutionResult.boundSteps,
    snapshotVersion: generateSnapshotVersion(snapshot),
    risk: policyResult.risk,
  };

  return {
    ok: true,
    executable,
    warnings,
  };
}

// ============================================
// Step Resolution
// ============================================

interface StepResolutionSuccess {
  success: true;
  boundSteps: BoundStep[];
}

interface StepResolutionError {
  success: false;
  error: {
    type: ResolverError['type'];
    message: string;
    suggestedQuestion: string;
    candidates?: Task[];
    skeleton?: IntentSkeleton;
    stepIndex?: number;
  };
}

type StepResolutionResult = StepResolutionSuccess | StepResolutionError;

function resolveAllSteps(steps: PlanStep[], snapshot: Snapshot): StepResolutionResult {
  const boundSteps: BoundStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const result = resolveStep(step, snapshot, i);

    if (!result.success) {
      return result;
    }

    boundSteps.push(result.boundStep);
  }

  return { success: true, boundSteps };
}

interface SingleStepSuccess {
  success: true;
  boundStep: BoundStep;
}

type SingleStepResult = SingleStepSuccess | StepResolutionError;

function resolveStep(step: PlanStep, snapshot: Snapshot, index: number): SingleStepResult {
  if (isIntentStep(step)) {
    return resolveIntentStep(step, snapshot, index);
  }

  if (isQueryStep(step)) {
    return {
      success: true,
      boundStep: {
        kind: 'query',
        query: step.query,
        assign: step.assign,
      },
    };
  }

  if (isIfStep(step)) {
    return resolveIfStep(step, snapshot, index);
  }

  if (isConfirmStep(step)) {
    return resolveConfirmStep(step, snapshot, index);
  }

  if (isNoteStep(step)) {
    return {
      success: true,
      boundStep: {
        kind: 'note',
        text: step.text,
      },
    };
  }

  // Should never reach here
  return {
    success: true,
    boundStep: step as unknown as BoundStep,
  };
}

function resolveIntentStep(step: IntentStep, snapshot: Snapshot, index: number): SingleStepResult {
  const skeleton = step.skeleton;

  // Non-task-ref skeletons don't need resolution
  if (!requiresTaskResolution(skeleton)) {
    return {
      success: true,
      boundStep: {
        kind: 'intent',
        intent: skeleton as unknown as Intent,
        originalSkeleton: skeleton,
      },
    };
  }

  // Resolve targetHint → taskId
  const result = resolveSkeleton(skeleton, snapshot);

  if (isResolverError(result)) {
    return {
      success: false,
      error: {
        type: result.error.type,
        message: result.error.message,
        suggestedQuestion: result.error.suggestedQuestion,
        candidates: result.error.candidates,
        skeleton,
        stepIndex: index,
      },
    };
  }

  return {
    success: true,
    boundStep: {
      kind: 'intent',
      intent: result.data.intent,
      originalSkeleton: skeleton,
      resolvedTask: result.data.resolvedTask,
    },
  };
}

function resolveIfStep(step: IfStep, snapshot: Snapshot, index: number): SingleStepResult {
  // Resolve then branch
  const thenResult = resolveAllSteps(step.then, snapshot);
  if (!thenResult.success) {
    return thenResult;
  }

  // Resolve else branch if present
  let elseSteps: BoundStep[] | undefined;
  if (step.else) {
    const elseResult = resolveAllSteps(step.else, snapshot);
    if (!elseResult.success) {
      return elseResult;
    }
    elseSteps = elseResult.boundSteps;
  }

  return {
    success: true,
    boundStep: {
      kind: 'if',
      cond: step.cond,
      then: thenResult.boundSteps,
      else: elseSteps,
    },
  };
}

function resolveConfirmStep(step: ConfirmStep, snapshot: Snapshot, index: number): SingleStepResult {
  // Resolve onApprove branch
  const approveResult = resolveAllSteps(step.onApprove, snapshot);
  if (!approveResult.success) {
    return approveResult;
  }

  // Resolve onReject branch if present
  let rejectSteps: BoundStep[] | undefined;
  if (step.onReject) {
    const rejectResult = resolveAllSteps(step.onReject, snapshot);
    if (!rejectResult.success) {
      return rejectResult;
    }
    rejectSteps = rejectResult.boundSteps;
  }

  return {
    success: true,
    boundStep: {
      kind: 'confirm',
      message: step.message,
      onApprove: approveResult.boundSteps,
      onReject: rejectSteps,
    },
  };
}

// ============================================
// Helpers
// ============================================

function mapPolicyViolationToReason(violation: PolicyViolation): ClarificationReason {
  switch (violation.code) {
    case 'TOO_MANY_STEPS':
    case 'TOO_MANY_WRITE_STEPS':
      return 'TOO_MANY_STEPS';
    case 'DESTRUCTIVE_WITHOUT_CONFIRM':
    case 'HIGH_RISK_UNCONFIRMED':
      return 'POLICY_CONFIRM_REQUIRED';
    default:
      return 'POLICY_CONFIRM_REQUIRED';
  }
}

function mapResolverErrorToReason(type: ResolverError['type']): ClarificationReason {
  switch (type) {
    case 'ambiguous':
      return 'AMBIGUOUS_TARGET';
    case 'not_found':
    case 'deleted':
    case 'invalid_state':
    default:
      return 'NOT_FOUND';
  }
}

function generatePolicyQuestion(violation: PolicyViolation): string {
  switch (violation.code) {
    case 'TOO_MANY_STEPS':
      return 'This plan has too many steps. Would you like to simplify it?';
    case 'TOO_MANY_WRITE_STEPS':
      return 'This plan has too many write operations. Would you like to reduce them?';
    case 'DESTRUCTIVE_WITHOUT_CONFIRM':
      return 'This plan includes destructive operations. Please confirm to proceed.';
    default:
      return 'Please confirm this operation.';
  }
}

function generateSnapshotVersion(snapshot: Snapshot): number {
  // Simple version based on task count and timestamps
  const taskCount = snapshot.data.tasks.length;
  const latestUpdate = Math.max(
    ...snapshot.data.tasks.map(t => new Date(t.updatedAt).getTime()),
    0
  );
  return taskCount * 1000000 + (latestUpdate % 1000000);
}

// ============================================
// Type Guards
// ============================================

export function isPreflightSuccess(result: PreflightResult): result is { ok: true; executable: ExecutablePlan; warnings: Warning[] } {
  return result.ok === true;
}

export function isPreflightError(result: PreflightResult): result is { ok: false; needsClarification: ClarificationRequest; partial?: ExecutablePlan } {
  return result.ok === false;
}

// ============================================
// Exports
// ============================================

export { type PolicyConfig, DEFAULT_POLICY_CONFIG } from './policy';
