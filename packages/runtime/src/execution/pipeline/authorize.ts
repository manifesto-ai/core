/**
 * Authorize Stage
 *
 * Phase 3-4: Derive ExecutionKey, request approval from PolicyService,
 * validate scope. Transition to approved or rejected.
 *
 * Early exit: rejected (authority denial or scope validation failure).
 *
 * @see ADR-004 Phase 3
 * @module
 */

import type { ActionResult } from "../../types/index.js";
import type { PipelineContext, AuthorizeDeps, StageResult } from "./types.js";

/**
 * Handle rejection — consolidated helper for authority and scope rejections.
 *
 * Eliminates the 35-line duplication in the original executor.
 */
async function handleRejection(
  ctx: PipelineContext,
  deps: AuthorizeDeps,
  reason: string
): Promise<StageResult> {
  const { handle, actionType, actorId, branchId } = ctx;
  const { lifecycleManager, subscriptionStore } = deps;

  handle._transitionTo("rejected", {
    kind: "rejected",
    reason,
  });

  // Emit audit:rejected
  await lifecycleManager.emitHook(
    "audit:rejected",
    {
      operation: actionType,
      reason,
      proposalId: handle.proposalId,
    },
    { actorId, branchId }
  );

  const result: ActionResult = {
    status: "rejected" as const,
    proposalId: handle.proposalId,
    decisionId: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    reason,
    runtime: "domain" as const,
  };

  subscriptionStore.endTransaction();

  await lifecycleManager.emitHook(
    "action:completed",
    { proposalId: handle.proposalId, result },
    { actorId, branchId }
  );

  handle._setResult(result);

  return { halted: true, result };
}

/**
 * Execute the Authorize stage.
 *
 * Derives ExecutionKey, requests approval, validates scope.
 * Halts with rejected result if authority denies or scope validation fails.
 */
export async function authorize(
  ctx: PipelineContext,
  deps: AuthorizeDeps
): Promise<StageResult> {
  const { handle } = ctx;
  const { policyService } = deps;
  const proposal = ctx.prepare!.proposal;

  // ==== Phase 3: evaluating ====
  handle._transitionTo("evaluating");

  // Derive ExecutionKey
  const executionKey = policyService.deriveExecutionKey(proposal);

  // Request approval from PolicyService
  const decision = await policyService.requestApproval(proposal);

  // ==== Phase 4: approved/rejected ====
  if (!decision.approved) {
    return handleRejection(ctx, deps, decision.reason ?? "Authority rejected the action");
  }

  // POLICY-3: Validate Proposal against ApprovedScope before execution
  if (decision.scope) {
    const scopeValidation = policyService.validateScope(proposal, decision.scope);
    if (!scopeValidation.valid) {
      const reason = scopeValidation.errors?.[0] ?? "Scope validation failed";
      return handleRejection(ctx, deps, reason);
    }
  }

  // Approved
  handle._transitionTo("approved");

  // Write stage output
  (ctx as { authorize?: unknown }).authorize = {
    decision: decision as { approved: true; scope?: unknown; reason?: string; timestamp: number },
    executionKey,
  };

  return { halted: false };
}
