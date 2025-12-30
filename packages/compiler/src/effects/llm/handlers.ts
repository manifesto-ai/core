import type { LLMAdapter } from "./adapter.js";
import type {
  CompilerContext,
  NormalizedIntent,
  AttemptRecord,
  CompilerResolutionPolicy,
} from "../../domain/types.js";

/**
 * LLM Effect Handler result
 *
 * Effect handlers return an action to dispatch, which the Host will execute.
 */
export interface EffectHandlerResult {
  action: string;
  input: Record<string, unknown>;
}

/**
 * LLM Effect Handler type
 */
export type LLMEffectHandler = (
  params: Record<string, unknown>
) => Promise<EffectHandlerResult>;

/**
 * Create LLM segment effect handler
 *
 * Handles 'llm:segment' effect - segments input text into requirements.
 */
export function createSegmentHandler(adapter: LLMAdapter): LLMEffectHandler {
  return async (params: Record<string, unknown>): Promise<EffectHandlerResult> => {
    const text = params.text as string;

    if (process.env.DEBUG) {
      console.log("[LLM:segment] Starting segmentation for text:", text.slice(0, 100));
    }

    const result = await adapter.segment({ text });

    if (process.env.DEBUG) {
      console.log("[LLM:segment] Result:", JSON.stringify(result, null, 2));
    }

    if (result.ok === true) {
      return {
        action: "receiveSegments",
        input: { segments: result.data.segments },
      };
    }

    if (result.ok === "resolution") {
      return {
        action: "requestResolution",
        input: { reason: result.reason, options: result.options },
      };
    }

    // Error case - discard with segmentation failed
    console.error("[LLM:segment] Segmentation failed:", result.error);
    return {
      action: "discard",
      input: { reason: "SEGMENTATION_FAILED", error: result.error },
    };
  };
}

/**
 * Create LLM normalize effect handler
 *
 * Handles 'llm:normalize' effect - normalizes segments into intents.
 */
export function createNormalizeHandler(
  adapter: LLMAdapter,
  policy: CompilerResolutionPolicy
): LLMEffectHandler {
  return async (params: Record<string, unknown>): Promise<EffectHandlerResult> => {
    const segments = params.segments as string[];
    const schema = params.schema;
    const context = params.context as CompilerContext | undefined;

    const result = await adapter.normalize({ segments, schema, context });

    if (result.ok === true) {
      return {
        action: "receiveIntents",
        input: { intents: result.data.intents },
      };
    }

    if (result.ok === "resolution") {
      if (policy.onResolutionRequired === "discard") {
        return {
          action: "discard",
          input: { reason: "RESOLUTION_REQUIRED_BUT_DISABLED" },
        };
      }
      return {
        action: "requestResolution",
        input: { reason: result.reason, options: result.options },
      };
    }

    // Error case - treat as segmentation failed (normalization is part of that phase)
    return {
      action: "discard",
      input: { reason: "SEGMENTATION_FAILED" },
    };
  };
}

/**
 * Create LLM propose effect handler
 *
 * Handles 'llm:propose' effect - generates a DomainDraft from intents.
 *
 * Per FDR-C002: LLM output is an untrusted proposal.
 */
export function createProposeHandler(
  adapter: LLMAdapter,
  policy: CompilerResolutionPolicy
): LLMEffectHandler {
  return async (params: Record<string, unknown>): Promise<EffectHandlerResult> => {
    const schema = params.schema;
    const intents = params.intents as NormalizedIntent[];
    const history = params.history as AttemptRecord[];
    const context = params.context as CompilerContext | undefined;
    const resolution = params.resolution as string | undefined;

    const result = await adapter.propose({ schema, intents, history, context, resolution });

    if (result.ok === true) {
      return {
        action: "receiveDraft",
        input: { draft: result.data.draft },
      };
    }

    if (result.ok === "resolution") {
      if (policy.onResolutionRequired === "discard") {
        return {
          action: "discard",
          input: { reason: "RESOLUTION_REQUIRED_BUT_DISABLED" },
        };
      }
      return {
        action: "requestResolution",
        input: { reason: result.reason, options: result.options },
      };
    }

    // Error case - will be handled by retry logic
    // Return a draft that will fail validation to trigger retry
    return {
      action: "receiveDraft",
      input: { draft: { _error: result.error } },
    };
  };
}

/**
 * Create all LLM effect handlers
 *
 * @param adapter - LLM adapter instance
 * @param policy - Resolution policy
 * @returns Record of effect type to handler
 */
export function createLLMEffectHandlers(
  adapter: LLMAdapter,
  policy: CompilerResolutionPolicy
): Record<string, LLMEffectHandler> {
  return {
    "llm:segment": createSegmentHandler(adapter),
    "llm:normalize": createNormalizeHandler(adapter, policy),
    "llm:propose": createProposeHandler(adapter, policy),
  };
}
