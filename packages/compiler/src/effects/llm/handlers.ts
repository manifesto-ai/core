/**
 * @manifesto-ai/compiler v1.1 LLM Effect Handlers
 *
 * Effect handlers for LLM operations (plan, generate).
 * Per SPEC §10: LLM Actors are effect handlers.
 */

import type { LLMAdapter, PlanResult, RawChunkOutput } from "./adapter.js";
import type {
  SourceInput,
  Plan,
  Chunk,
  Fragment,
  FragmentDraft,
  Issue,
  ResolutionPolicy,
  PlanStrategy,
} from "../../domain/types.js";
import { nanoid } from "nanoid";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Effect Handler Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Effect handler result
 *
 * Effect handlers return an action to dispatch, which the Host will execute.
 */
export interface EffectHandlerResult {
  action: string;
  input: Record<string, unknown>;
}

/**
 * LLM effect handler type
 */
export type LLMEffectHandler = (
  params: Record<string, unknown>
) => Promise<EffectHandlerResult>;

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Plan Handler
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create LLM plan effect handler
 *
 * Handles 'llm:plan' effect - creates a Plan from SourceInput.
 * Per SPEC §10.3: PlannerActor responsibility.
 */
export function createPlanHandler(
  adapter: LLMAdapter,
  policy: ResolutionPolicy
): LLMEffectHandler {
  return async (params: Record<string, unknown>): Promise<EffectHandlerResult> => {
    const sourceInput = params.sourceInput as SourceInput;
    const hints = params.hints as { preferredStrategy?: PlanStrategy; maxChunks?: number } | undefined;
    const useParallel = params.useParallel !== false; // Default to true

    if (process.env.DEBUG) {
      console.log("[LLM:plan] sourceInput:", JSON.stringify(sourceInput, null, 2));
      console.log("[LLM:plan] Starting planning for input:", sourceInput?.content?.slice?.(0, 100) ?? "(no content)");
      console.log("[LLM:plan] useParallel:", useParallel);
    }

    // Use planParallel if available and enabled
    let result: PlanResult;
    const adapterWithParallel = adapter as LLMAdapter & {
      planParallel?: (request: { sourceInput: SourceInput; hints?: typeof hints }, options?: unknown) => Promise<PlanResult>;
    };

    if (useParallel && typeof adapterWithParallel.planParallel === "function") {
      if (process.env.DEBUG) {
        console.log("[LLM:plan] Using parallel planning");
      }
      result = await adapterWithParallel.planParallel({ sourceInput, hints });
    } else {
      result = await adapter.plan({ sourceInput, hints });
    }

    if (process.env.DEBUG) {
      console.log("[LLM:plan] Result:", JSON.stringify(result, null, 2));
    }

    if (result.ok === true) {
      // Assign IDs to plan and chunks
      const planId = `plan_${nanoid(8)}`;
      const chunks: Chunk[] = result.data.plan.chunks.map((chunk: RawChunkOutput, index: number) => ({
        id: `chunk_${index}`,
        content: chunk.content,
        expectedType: chunk.expectedType,
        dependencies: chunk.dependencies.map((dep: RawChunkOutput["dependencies"][number]) => ({
          ...dep,
          // Normalize targetChunkId to use consistent format
          targetChunkId: dep.targetChunkId.startsWith("chunk_")
            ? dep.targetChunkId
            : `chunk_${dep.targetChunkId}`,
        })),
        sourceSpan: chunk.sourceSpan,
      }));

      const plan: Plan = {
        id: planId,
        sourceInputId: sourceInput.id,
        strategy: result.data.plan.strategy,
        chunks,
        rationale: result.data.plan.rationale,
        status: "pending",
      };

      return {
        action: "receivePlan",
        input: { plan, chunks },
      };
    }

    if (result.ok === "ambiguous") {
      // Handle ambiguity based on policy
      if (policy.onPlanDecision === "discard") {
        return {
          action: "fail",
          input: { reason: "PLANNING_FAILED", error: result.reason },
        };
      }

      // For "await" or "auto-accept" policy: use first alternative
      // TODO: Implement full resolution UI for ambiguous plans
      const firstAlt = result.alternatives[0];
      if (!firstAlt) {
        return {
          action: "fail",
          input: { reason: "PLANNING_FAILED", error: "No alternatives provided" },
        };
      }

      const planId = `plan_${nanoid(8)}`;
      const chunks: Chunk[] = firstAlt.plan.chunks.map((chunk: RawChunkOutput, chunkIndex: number) => ({
        id: `chunk_${chunkIndex}`,
        content: chunk.content,
        expectedType: chunk.expectedType,
        dependencies: chunk.dependencies,
        sourceSpan: chunk.sourceSpan,
      }));

      const plan: Plan = {
        id: planId,
        sourceInputId: sourceInput.id,
        strategy: firstAlt.plan.strategy,
        chunks,
        rationale: firstAlt.plan.rationale,
        status: "pending",
      };

      return {
        action: "receivePlan",
        input: { plan, chunks },
      };
    }

    // Error case
    console.error("[LLM:plan] Planning failed:", result.error);
    return {
      action: "fail",
      input: { reason: "PLANNING_FAILED", error: result.error },
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Generate Handler
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create LLM generate effect handler
 *
 * Handles 'llm:generate' effect - creates FragmentDraft from Chunk.
 * Per SPEC §10.4: GeneratorActor responsibility.
 */
export function createGenerateHandler(
  adapter: LLMAdapter,
  policy: ResolutionPolicy
): LLMEffectHandler {
  return async (params: Record<string, unknown>): Promise<EffectHandlerResult> => {
    const chunk = params.chunk as Chunk;
    const plan = params.plan as Plan;
    const existingFragments = (params.existingFragments as Fragment[]) || [];
    const retryContext = params.retryContext as {
      previousDraft: FragmentDraft;
      issues: Issue[];
      attemptNumber: number;
    } | undefined;

    if (process.env.DEBUG) {
      console.log("[LLM:generate] Generating for chunk:", chunk.id, chunk.content.slice(0, 50));
    }

    const result = await adapter.generate({
      chunk,
      plan,
      existingFragments,
      retryContext,
    });

    if (process.env.DEBUG) {
      console.log("[LLM:generate] Result:", JSON.stringify(result, null, 2));
    }

    if (result.ok === true) {
      // Create FragmentDraft with IDs
      const draft: FragmentDraft = {
        id: `draft_${nanoid(8)}`,
        chunkId: chunk.id,
        type: result.data.draft.type,
        interpretation: result.data.draft.interpretation,
        confidence: result.data.draft.confidence,
        alternatives: result.data.draft.alternatives,
        status: "pending",
      };

      return {
        action: "receiveFragmentDraft",
        input: { draft },
      };
    }

    if (result.ok === "ambiguous") {
      // Handle ambiguity based on policy
      if (policy.onDraftDecision === "discard") {
        return {
          action: "fail",
          input: { reason: "GENERATION_FAILED", error: result.reason },
        };
      }

      // Create alternative drafts for resolution
      const alternatives: FragmentDraft[] = result.alternatives.map((alt, index) => ({
        id: `draft_alt${index}_${nanoid(8)}`,
        chunkId: chunk.id,
        type: alt.draft.type,
        interpretation: alt.draft.interpretation,
        confidence: alt.draft.confidence,
        alternatives: alt.draft.alternatives,
        status: "pending" as const,
      }));

      return {
        action: "requestDraftResolution",
        input: {
          reason: result.reason,
          chunkId: chunk.id,
          alternatives,
        },
      };
    }

    // Error case
    console.error("[LLM:generate] Generation failed:", result.error);

    return {
      action: "fail",
      input: { reason: "GENERATION_FAILED", error: result.error },
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Effect Handler Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create all LLM effect handlers
 *
 * @param adapter - LLM adapter instance
 * @param policy - Resolution policy
 * @returns Record of effect type to handler
 */
export function createLLMEffectHandlers(
  adapter: LLMAdapter,
  policy: ResolutionPolicy
): Record<string, LLMEffectHandler> {
  return {
    "llm:plan": createPlanHandler(adapter, policy),
    "llm:generate": createGenerateHandler(adapter, policy),
  };
}

/**
 * Default resolution policy
 */
export const DEFAULT_RESOLUTION_POLICY: ResolutionPolicy = {
  onPlanDecision: "await",
  onDraftDecision: "auto-accept",
  onConflictResolution: "await",
};
