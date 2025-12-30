import { vi } from "vitest";
import type {
  LLMAdapter,
  SegmentResult,
  NormalizeResult,
  ProposeResult,
  NormalizedIntent,
} from "../../domain/types.js";

/**
 * Default successful segment response
 */
export const DEFAULT_SEGMENT_RESPONSE: SegmentResult = {
  ok: true,
  data: {
    segments: ["requirement 1", "requirement 2"],
  },
};

/**
 * Default successful normalize response
 */
export const DEFAULT_NORMALIZE_RESPONSE: NormalizeResult = {
  ok: true,
  data: {
    intents: [
      { kind: "state", description: "Track counter value", confidence: 0.9 },
      { kind: "action", description: "Increment counter", confidence: 0.85 },
    ],
  },
};

/**
 * Default successful propose response (minimal valid DomainDraft)
 */
export const DEFAULT_PROPOSE_RESPONSE: ProposeResult = {
  ok: true,
  data: {
    draft: {
      id: "test:counter",
      version: "1.0.0",
      state: {
        counter: { type: "number", default: 0 },
      },
      computed: {},
      actions: {
        increment: {
          flow: [{ set: { path: "counter", expr: { add: ["$counter", 1] } } }],
        },
      },
    },
  },
};

/**
 * Mock adapter options
 */
export interface MockAdapterOptions {
  segmentResponse?: SegmentResult | (() => SegmentResult);
  normalizeResponse?: NormalizeResult | (() => NormalizeResult);
  proposeResponse?: ProposeResult | (() => ProposeResult);
  proposeResponses?: ProposeResult[];
}

/**
 * Create a mock LLM adapter for testing
 */
export function createMockAdapter(options: MockAdapterOptions = {}): LLMAdapter {
  let proposeCallCount = 0;

  const getSegmentResponse = (): SegmentResult => {
    if (typeof options.segmentResponse === "function") {
      return options.segmentResponse();
    }
    return options.segmentResponse ?? DEFAULT_SEGMENT_RESPONSE;
  };

  const getNormalizeResponse = (): NormalizeResult => {
    if (typeof options.normalizeResponse === "function") {
      return options.normalizeResponse();
    }
    return options.normalizeResponse ?? DEFAULT_NORMALIZE_RESPONSE;
  };

  const getProposeResponse = (): ProposeResult => {
    // Support multiple propose responses for retry testing
    if (options.proposeResponses && options.proposeResponses.length > 0) {
      const response = options.proposeResponses[proposeCallCount] ?? options.proposeResponses[options.proposeResponses.length - 1];
      proposeCallCount++;
      return response;
    }

    if (typeof options.proposeResponse === "function") {
      return options.proposeResponse();
    }
    return options.proposeResponse ?? DEFAULT_PROPOSE_RESPONSE;
  };

  return {
    segment: vi.fn().mockImplementation(async () => getSegmentResponse()),
    normalize: vi.fn().mockImplementation(async () => getNormalizeResponse()),
    propose: vi.fn().mockImplementation(async () => getProposeResponse()),
  };
}

/**
 * Create a mock adapter that always succeeds
 */
export function createSuccessMockAdapter(): LLMAdapter {
  return createMockAdapter();
}

/**
 * Create a mock adapter that fails at segmentation
 */
export function createSegmentFailMockAdapter(error: string = "Segmentation failed"): LLMAdapter {
  return createMockAdapter({
    segmentResponse: { ok: false, error },
  });
}

/**
 * Create a mock adapter that requires resolution
 */
export function createResolutionMockAdapter(reason: string = "Ambiguous requirement"): LLMAdapter {
  return createMockAdapter({
    proposeResponse: {
      ok: "resolution",
      reason,
      options: [
        { id: "option1", description: "First option" },
        { id: "option2", description: "Second option" },
      ],
    },
  });
}

/**
 * Create a mock adapter that produces invalid drafts (for retry testing)
 */
export function createInvalidDraftMockAdapter(
  failCount: number = 2,
  eventualResponse: ProposeResult = DEFAULT_PROPOSE_RESPONSE
): LLMAdapter {
  const invalidResponse: ProposeResult = {
    ok: true,
    data: {
      draft: { _invalid: true }, // Will fail validation
    },
  };

  const responses: ProposeResult[] = [];
  for (let i = 0; i < failCount; i++) {
    responses.push(invalidResponse);
  }
  responses.push(eventualResponse);

  return createMockAdapter({ proposeResponses: responses });
}

/**
 * Create custom intents for testing
 */
export function createIntents(intents: Partial<NormalizedIntent>[]): NormalizedIntent[] {
  return intents.map((intent, index) => ({
    kind: intent.kind ?? "state",
    description: intent.description ?? `Intent ${index + 1}`,
    confidence: intent.confidence ?? 0.9,
  }));
}
