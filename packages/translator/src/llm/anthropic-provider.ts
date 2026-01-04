/**
 * Anthropic Provider Implementation
 *
 * Uses Anthropic Claude API for the proposer stage.
 */

import type {
  LLMProvider,
  ProposeRequest,
  ProposeResponse,
  ProviderResult,
  ProviderMetrics,
  AnthropicProviderConfig,
} from "./provider.js";
import type { PatchFragment } from "../domain/index.js";
import { computeFragmentId } from "../utils/index.js";

/**
 * Default Anthropic model
 */
const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

/**
 * Default timeout (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly defaultModel: string;

  private config: AnthropicProviderConfig;
  private client: any | null = null;

  constructor(config: AnthropicProviderConfig = {}) {
    this.config = config;
    this.defaultModel = config.model ?? DEFAULT_MODEL;
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey || process.env.ANTHROPIC_API_KEY);
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.isConfigured()) {
      errors.push("Anthropic API key not configured (set ANTHROPIC_API_KEY or pass apiKey)");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Initialize Anthropic client lazily
   */
  private async getClient(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      this.client = new Anthropic({
        apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout ?? DEFAULT_TIMEOUT,
        maxRetries: this.config.maxRetries ?? 3,
      });
      return this.client;
    } catch (error) {
      throw new Error(
        `Failed to initialize Anthropic client: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Propose fragments from natural language
   */
  async propose(request: ProposeRequest): Promise<ProviderResult<ProposeResponse>> {
    const startTime = Date.now();
    const modelId = this.config.model ?? this.defaultModel;

    try {
      const client = await this.getClient();
      const systemPrompt = this.buildSystemPrompt(request);
      const userPrompt = this.buildUserPrompt(request);

      const response = await client.messages.create({
        model: modelId,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: request.temperature ?? 0.1,
        max_tokens: request.maxTokens ?? 2048,
      });

      const latencyMs = Date.now() - startTime;
      const usage = response.usage ?? { input_tokens: 0, output_tokens: 0 };
      const metrics: ProviderMetrics = {
        modelId,
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        latencyMs,
      };

      // Extract text content
      const textContent = response.content.find((c: any) => c.type === "text");
      const content = textContent?.text;

      if (!content) {
        return {
          success: true,
          data: { kind: "empty", reason: "No content in response" },
          metrics,
        };
      }

      const parsed = this.parseResponse(content, request.intentId);
      return {
        success: true,
        data: parsed,
        metrics,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metrics: {
          modelId,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs,
        },
      };
    }
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(request: ProposeRequest): string {
    const schemaInfo = this.formatSchemaInfo(request);

    return `You are a Manifesto Translator that converts natural language to semantic change proposals.

## Your Task
Convert the user's natural language input into PatchFragment operations.

## Schema Context
${schemaInfo}

## Output Format
Respond with a JSON object (and nothing else) in one of these formats:

1. Success with fragments:
{
  "kind": "fragments",
  "fragments": [
    {
      "op": { "kind": "addField", "path": "state.user.email", "fieldType": { "kind": "primitive", "name": "string" } },
      "confidence": 0.9,
      "evidence": ["User requested email field"]
    }
  ]
}

2. Ambiguous input:
{
  "kind": "ambiguity",
  "question": "Which type should contain the new field?",
  "options": ["User profile", "Contact info"]
}

3. Cannot process:
{
  "kind": "empty",
  "reason": "Cannot understand the request"
}

## Rules
- Use exact paths from the schema
- Set confidence based on how well input matches intent
- Provide evidence for each operation
- If ambiguous, return ambiguity with options
- Output ONLY the JSON object, no other text`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(request: ProposeRequest): string {
    let prompt = `Input: "${request.input}"`;

    // Add anchors if available
    if (request.anchors.length > 0) {
      prompt += "\n\nRelevant schema paths:";
      for (const anchor of request.anchors.slice(0, 5)) {
        prompt += `\n- ${anchor.path}`;
      }
    }

    // Add examples if available
    if (request.examples && request.examples.length > 0) {
      prompt += "\n\nExamples:";
      for (const example of request.examples.slice(0, 3)) {
        prompt += `\nInput: "${example.input}"`;
        prompt += `\nOutput: ${JSON.stringify(example.fragments)}`;
      }
    }

    return prompt;
  }

  /**
   * Format schema info for prompt
   */
  private formatSchemaInfo(request: ProposeRequest): string {
    const paths = Object.keys(request.typeIndex).slice(0, 20);
    if (paths.length === 0) {
      return "No schema paths available.";
    }

    let info = "Available paths:\n";
    for (const path of paths) {
      const type = request.typeIndex[path];
      info += `- ${path}: ${this.formatType(type)}\n`;
    }

    return info;
  }

  /**
   * Format type for display
   */
  private formatType(type: any): string {
    if (!type) return "unknown";
    if (type.kind === "primitive") return type.name;
    if (type.kind === "array") return `${this.formatType(type.element)}[]`;
    if (type.kind === "optional") return `${this.formatType(type.inner)}?`;
    if (type.kind === "ref") return `→${type.target}`;
    return type.kind ?? "unknown";
  }

  /**
   * Parse response content
   */
  private parseResponse(content: string, intentId: string): ProposeResponse {
    try {
      // Extract JSON from response (Claude might include extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { kind: "empty", reason: "No JSON found in response" };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.kind === "fragments" && Array.isArray(parsed.fragments)) {
        const fragments: PatchFragment[] = parsed.fragments.map((f: any, i: number) => ({
          fragmentId: computeFragmentId(intentId, f.op),
          sourceIntentId: intentId,
          op: f.op,
          confidence: f.confidence ?? 0.5,
          evidence: f.evidence ?? [],
          createdAt: new Date().toISOString(),
        }));

        const avgConfidence =
          fragments.length > 0
            ? fragments.reduce((sum, f) => sum + f.confidence, 0) / fragments.length
            : 0;

        return { kind: "fragments", fragments, confidence: avgConfidence };
      }

      if (parsed.kind === "ambiguity") {
        return {
          kind: "ambiguity",
          report: {
            reportId: `amb-${Date.now()}`,
            kind: "intent",
            normalizedInput: "",
            candidates: (parsed.options ?? []).map((opt: string, i: number) => ({
              optionId: `opt-${i}`,
              description: opt,
              fragments: [],
              confidence: 0.5,
            })),
            resolutionPrompt: {
              question: parsed.question ?? "Please select an option:",
            },
          },
        };
      }

      if (parsed.kind === "empty") {
        return { kind: "empty", reason: parsed.reason ?? "Unknown" };
      }

      return { kind: "empty", reason: "Invalid response format" };
    } catch (error) {
      return { kind: "empty", reason: `Parse error: ${error}` };
    }
  }
}

/**
 * Create Anthropic provider
 */
export function createAnthropicProvider(config?: AnthropicProviderConfig): LLMProvider {
  return new AnthropicProvider(config);
}
