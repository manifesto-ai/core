/**
 * @fileoverview LLM Client Interface
 *
 * Abstract interface for LLM integration.
 * Implementations can use Anthropic Claude, OpenAI GPT, or other providers.
 * Actual implementation deferred to later version.
 */

import type { IntentIR } from "@manifesto-ai/intent-ir";

// =============================================================================
// Types
// =============================================================================

/**
 * LLM proposal request
 */
export type ProposeRequest = {
  /** Normalized natural language text */
  readonly text: string;
  /** Language hint */
  readonly lang: string;
  /** Schema context for the LLM */
  readonly schemaContext?: string;
  /** Available lemmas from lexicon */
  readonly availableLemmas?: readonly string[];
  /** Recent requests for context */
  readonly recentContext?: readonly string[];
};

/**
 * LLM proposal response
 */
export type ProposeResponse = {
  /** Proposed IntentIR (parsed JSON) */
  readonly ir: IntentIR;
  /** Raw output from LLM (for debugging/tracing) */
  readonly rawOutput: string;
  /** Token usage statistics */
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
  /** Model used for generation */
  readonly model?: string;
};

/**
 * LLM Client interface
 *
 * Implementations should:
 * 1. Build appropriate prompt from ProposeRequest
 * 2. Call the LLM API
 * 3. Parse the response into IntentIR
 * 4. Return ProposeResponse or throw on failure
 */
export interface LLMClient {
  /**
   * Propose IntentIR from natural language
   *
   * @param request - Proposal request with text and context
   * @returns Promise resolving to ProposeResponse
   * @throws Error if LLM call fails or response is invalid
   */
  propose(request: ProposeRequest): Promise<ProposeResponse>;

  /**
   * Check if the client is ready
   */
  isReady(): boolean;

  /**
   * Get the provider name
   */
  getProvider(): string;
}

// =============================================================================
// Mock Implementation for Testing
// =============================================================================

/**
 * Mock LLM client for testing
 *
 * Returns a fixed IntentIR based on input patterns
 */
export class MockLLMClient implements LLMClient {
  private readonly responses: Map<string, IntentIR> = new Map();

  constructor(private readonly defaultResponse?: IntentIR) {}

  /**
   * Register a mock response for a specific text pattern
   */
  registerResponse(pattern: string, ir: IntentIR): void {
    this.responses.set(pattern.toLowerCase(), ir);
  }

  async propose(request: ProposeRequest): Promise<ProposeResponse> {
    // Look for matching pattern
    const text = request.text.toLowerCase();
    for (const [pattern, ir] of this.responses) {
      if (text.includes(pattern)) {
        return {
          ir,
          rawOutput: JSON.stringify(ir),
          model: "mock",
        };
      }
    }

    // Return default response if set
    if (this.defaultResponse) {
      return {
        ir: this.defaultResponse,
        rawOutput: JSON.stringify(this.defaultResponse),
        model: "mock",
      };
    }

    // Generate a basic response based on text
    const ir = this.generateBasicIR(request.text);
    return {
      ir,
      rawOutput: JSON.stringify(ir),
      model: "mock",
    };
  }

  isReady(): boolean {
    return true;
  }

  getProvider(): string {
    return "mock";
  }

  /**
   * Generate a basic IntentIR from text (heuristic)
   */
  private generateBasicIR(text: string): IntentIR {
    const lowerText = text.toLowerCase();

    // Detect lemma from keywords
    let lemma = "UNKNOWN";
    if (lowerText.includes("define") || lowerText.includes("type")) {
      lemma = "DEFINE_TYPE";
    } else if (lowerText.includes("add field") || lowerText.includes("field")) {
      lemma = "ADD_FIELD";
    } else if (lowerText.includes("action")) {
      lemma = "ADD_ACTION";
    } else if (lowerText.includes("computed")) {
      lemma = "ADD_COMPUTED";
    }

    return {
      v: "0.1",
      force: "DO",
      event: {
        lemma,
        class: "CREATE",
      },
      args: {
        TARGET: {
          kind: "value",
          valueType: "string",
          shape: { value: extractTarget(text) },
        },
      },
    };
  }
}

/**
 * Extract target name from text (heuristic)
 */
function extractTarget(text: string): string {
  // Look for quoted strings
  const quoted = text.match(/"([^"]+)"|'([^']+)'/);
  if (quoted) {
    return quoted[1] || quoted[2];
  }

  // Look for "called X" or "named X"
  const named = text.match(/(?:called|named)\s+(\w+)/i);
  if (named) {
    return named[1];
  }

  // Default
  return "unnamed";
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a mock LLM client for testing
 */
export function createMockLLMClient(defaultResponse?: IntentIR): MockLLMClient {
  return new MockLLMClient(defaultResponse);
}
