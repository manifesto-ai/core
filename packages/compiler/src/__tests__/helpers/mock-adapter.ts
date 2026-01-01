/**
 * Mock LLM Adapter for v1.1 Testing
 */

import { vi } from "vitest";
import type {
  LLMAdapter,
  LLMResult,
  RawPlanOutput,
  RawDraftOutput,
  RawChunkOutput,
  PlanStrategy,
  FragmentType,
} from "../../domain/types.js";

/**
 * Default successful plan response
 */
export const DEFAULT_PLAN_RESPONSE: LLMResult<{ plan: RawPlanOutput }> = {
  ok: true,
  data: {
    plan: {
      strategy: "by-statement" as PlanStrategy,
      chunks: [
        {
          content: "Track counter value",
          expectedType: "state" as FragmentType,
          dependencies: [],
        },
        {
          content: "Increment counter action",
          expectedType: "action" as FragmentType,
          dependencies: [{ kind: "requires", targetChunkId: "chunk_0" }],
        },
      ],
      rationale: "Split by domain concern",
    },
  },
};

/**
 * Default successful generate response (for state fragment)
 */
export const DEFAULT_STATE_DRAFT_RESPONSE: LLMResult<{ draft: RawDraftOutput }> = {
  ok: true,
  data: {
    draft: {
      type: "state" as FragmentType,
      interpretation: {
        raw: {
          name: "counter",
          schema: { type: "number", default: 0 },
        },
        description: "Counter value",
      },
      confidence: 0.95,
    },
  },
};

/**
 * Default successful generate response (for action fragment)
 */
export const DEFAULT_ACTION_DRAFT_RESPONSE: LLMResult<{ draft: RawDraftOutput }> = {
  ok: true,
  data: {
    draft: {
      type: "action" as FragmentType,
      interpretation: {
        raw: {
          name: "increment",
          flow: [{ set: { path: "counter", expr: { add: ["$counter", 1] } } }],
        },
        description: "Increment counter",
      },
      confidence: 0.9,
    },
  },
};

/**
 * Mock adapter options
 */
export interface MockAdapterOptions {
  planResponse?: LLMResult<{ plan: RawPlanOutput }> | (() => LLMResult<{ plan: RawPlanOutput }>);
  generateResponse?: LLMResult<{ draft: RawDraftOutput }> | (() => LLMResult<{ draft: RawDraftOutput }>);
  generateResponses?: Array<LLMResult<{ draft: RawDraftOutput }>>;
}

/**
 * Create a mock LLM adapter for testing (v1.1)
 */
export function createMockAdapter(options: MockAdapterOptions = {}): LLMAdapter {
  let generateCallCount = 0;

  const getPlanResponse = (): LLMResult<{ plan: RawPlanOutput }> => {
    if (typeof options.planResponse === "function") {
      return options.planResponse();
    }
    return options.planResponse ?? DEFAULT_PLAN_RESPONSE;
  };

  const getGenerateResponse = (): LLMResult<{ draft: RawDraftOutput }> => {
    // Support multiple generate responses for retry testing
    if (options.generateResponses && options.generateResponses.length > 0) {
      const response =
        options.generateResponses[generateCallCount] ??
        options.generateResponses[options.generateResponses.length - 1];
      generateCallCount++;
      return response;
    }

    if (typeof options.generateResponse === "function") {
      return options.generateResponse();
    }
    return options.generateResponse ?? DEFAULT_STATE_DRAFT_RESPONSE;
  };

  return {
    plan: vi.fn().mockImplementation(async () => getPlanResponse()),
    generate: vi.fn().mockImplementation(async () => getGenerateResponse()),
  };
}

/**
 * Create a mock adapter that always succeeds
 */
export function createSuccessMockAdapter(): LLMAdapter {
  // Provide responses for both chunks (state then action)
  return createMockAdapter({
    generateResponses: [DEFAULT_STATE_DRAFT_RESPONSE, DEFAULT_ACTION_DRAFT_RESPONSE],
  });
}

/**
 * Create a mock adapter that fails at planning
 */
export function createPlanFailMockAdapter(error: string = "Planning failed"): LLMAdapter {
  return createMockAdapter({
    planResponse: { ok: false, error },
  });
}

/**
 * Create a mock adapter that returns ambiguous plan
 */
export function createAmbiguousPlanMockAdapter(reason: string = "Ambiguous requirement"): LLMAdapter {
  const basePlan = (DEFAULT_PLAN_RESPONSE as { ok: true; data: { plan: RawPlanOutput } }).data.plan;
  return createMockAdapter({
    planResponse: {
      ok: "ambiguous",
      reason,
      alternatives: [
        { plan: { ...basePlan, strategy: "by-statement" as PlanStrategy } },
        { plan: { ...basePlan, strategy: "by-entity" as PlanStrategy } },
      ],
    },
  });
}

/**
 * Create a mock adapter that fails at generation
 */
export function createGenerateFailMockAdapter(error: string = "Generation failed"): LLMAdapter {
  return createMockAdapter({
    generateResponse: { ok: false, error },
  });
}

/**
 * Create a mock adapter with ambiguous drafts
 */
export function createAmbiguousDraftMockAdapter(reason: string = "Ambiguous interpretation"): LLMAdapter {
  const baseDraft = (DEFAULT_STATE_DRAFT_RESPONSE as { ok: true; data: { draft: RawDraftOutput } }).data.draft;
  return createMockAdapter({
    generateResponse: {
      ok: "ambiguous",
      reason,
      alternatives: [
        { draft: baseDraft },
        {
          draft: {
            type: "state" as FragmentType,
            interpretation: {
              raw: { name: "value", schema: { type: "number", default: 0 } },
              description: "Alternative interpretation",
            },
            confidence: 0.7,
          },
        },
      ],
    },
  });
}

/**
 * Create custom chunks for testing
 */
export function createChunks(chunks: Partial<RawChunkOutput>[]): RawChunkOutput[] {
  return chunks.map((chunk, index) => ({
    content: chunk.content ?? `Chunk ${index + 1}`,
    expectedType: chunk.expectedType ?? ("state" as FragmentType),
    dependencies: chunk.dependencies ?? [],
    sourceSpan: chunk.sourceSpan,
  }));
}

/**
 * Create a plan with custom chunks
 */
export function createPlan(
  strategy: PlanStrategy,
  chunks: RawChunkOutput[],
  rationale?: string
): RawPlanOutput {
  return {
    strategy,
    chunks,
    rationale,
  };
}
