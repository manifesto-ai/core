/**
 * @fileoverview OpenAI LLM Client Implementation
 *
 * Implements LLMClient interface using OpenAI GPT models.
 */

import type { IntentIR } from "@manifesto-ai/intent-ir";
import type { LLMClient, ProposeRequest, ProposeResponse } from "./llm-client.js";

// =============================================================================
// Types
// =============================================================================

export type OpenAIClientOptions = {
  /** OpenAI API key */
  apiKey: string;
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Temperature (default: 0.1) */
  temperature?: number;
  /** Max tokens (default: 2048) */
  maxTokens?: number;
};

// =============================================================================
// Prompt Template
// =============================================================================

const SYSTEM_PROMPT = `You are an Intent IR generator for the Manifesto system.
Your task is to convert natural language requests into structured IntentIR JSON.

IntentIR Schema:
{
  "v": "0.1",                    // Version (always "0.1")
  "force": "DO" | "DONT" | "ASK" | "TRY",  // Intent force
  "event": {
    "lemma": "UPPERCASE_ACTION_NAME",  // Action lemma (e.g., "ADD_TASK", "DEFINE_TYPE")
    "class": "CREATE" | "TRANSFORM" | "OBSERVE" | "CONTROL" | "DECIDE"
  },
  "args": {                      // Arguments (role -> term)
    "TARGET": { "kind": "value", "valueType": "string", "shape": { "value": "..." } },
    "THEME": { "kind": "value", "valueType": "string", "shape": { "value": "..." } }
  }
}

Common Lemmas:
- ADD_TASK, CREATE_TODO: Create a task/todo item
- DEFINE_TYPE: Define a new type
- ADD_FIELD: Add a field to a type
- ADD_ACTION: Add an action
- ADD_COMPUTED: Add a computed value
- UPDATE_*, MODIFY_*: Transform operations
- GET_*, LIST_*, FETCH_*: Observe operations
- DELETE_*, REMOVE_*: Control operations

Roles:
- TARGET: The entity being acted upon (e.g., task name, type name)
- THEME: The content/data (e.g., task description)
- SOURCE: Origin of data
- DEST: Destination
- INSTRUMENT: Options/configuration

Rules:
1. Always output valid JSON
2. Use UPPERCASE for lemmas
3. Infer the most appropriate lemma from the input
4. Extract named entities into appropriate roles
5. Default force is "DO"`;

function buildUserPrompt(request: ProposeRequest): string {
  let prompt = `Convert the following natural language to IntentIR JSON:\n\n"${request.text}"`;

  if (request.lang && request.lang !== "en") {
    prompt += `\n\nLanguage hint: ${request.lang}`;
  }

  if (request.availableLemmas && request.availableLemmas.length > 0) {
    prompt += `\n\nAvailable lemmas: ${request.availableLemmas.join(", ")}`;
  }

  prompt += "\n\nRespond with only the JSON object, no markdown or explanation.";

  return prompt;
}

// =============================================================================
// OpenAI Client Implementation
// =============================================================================

/**
 * OpenAI LLM Client
 *
 * Uses OpenAI's chat completion API to generate IntentIR from natural language.
 */
export class OpenAIClient implements LLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(options: OpenAIClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gpt-4o-mini";
    this.temperature = options.temperature ?? 0.1;
    this.maxTokens = options.maxTokens ?? 2048;
  }

  async propose(request: ProposeRequest): Promise<ProposeResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(request) },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const rawOutput = data.choices[0]?.message?.content ?? "";

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = rawOutput.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    let ir: IntentIR;
    try {
      ir = JSON.parse(jsonStr) as IntentIR;
    } catch (e) {
      throw new Error(`Failed to parse IntentIR from response: ${rawOutput}`);
    }

    return {
      ir,
      rawOutput,
      model: this.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  isReady(): boolean {
    return !!this.apiKey;
  }

  getProvider(): string {
    return "openai";
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create OpenAI LLM client
 *
 * @param apiKey - OpenAI API key (or reads from OPENAI_API_KEY env var)
 * @param options - Additional options
 */
export function createOpenAIClient(
  apiKey?: string,
  options?: Omit<OpenAIClientOptions, "apiKey">
): OpenAIClient {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey option.");
  }
  return new OpenAIClient({ apiKey: key, ...options });
}
