/**
 * Intent Parser (LLM1)
 *
 * Parses user messages into intents using an LLM.
 * This is the first LLM in the 2-LLM architecture.
 */

import type { IntentBody } from "@manifesto-ai/world";
import type { Task } from "../manifesto/index.js";
import type { IntentParseResult, AgentConfig, QueryType } from "./types.js";
import { INTENT_PARSER_SYSTEM_PROMPT, INTENT_PARSER_USER_PROMPT } from "./prompts.js";

/**
 * Parse a user message into an intent
 */
export async function parseIntent(
  userMessage: string,
  currentTasks: Task[],
  config: AgentConfig
): Promise<IntentParseResult> {
  const { apiKey, intentModel = "gpt-4o-mini", language = "en" } = config;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: intentModel,
        messages: [
          { role: "system", content: INTENT_PARSER_SYSTEM_PROMPT },
          { role: "user", content: INTENT_PARSER_USER_PROMPT(userMessage, currentTasks, language) },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[IntentParser] API error:", error);
      return { kind: "error", error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { kind: "error", error: "No response from LLM" };
    }

    const parsed = JSON.parse(content);
    return validateParseResult(parsed);
  } catch (error) {
    console.error("[IntentParser] Error:", error);
    return {
      kind: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate and normalize the parsed result
 */
function validateParseResult(parsed: unknown): IntentParseResult {
  if (!parsed || typeof parsed !== "object") {
    return { kind: "error", error: "Invalid response format" };
  }

  const result = parsed as Record<string, unknown>;

  switch (result.kind) {
    case "intent": {
      const intent = result.intent as Record<string, unknown> | undefined;
      if (!intent || typeof intent.type !== "string") {
        return { kind: "error", error: "Invalid intent format" };
      }
      return {
        kind: "intent",
        intent: {
          type: intent.type as string,
          input: intent.input as Record<string, unknown> | undefined,
        },
        confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
      };
    }

    case "query": {
      const queryType = result.queryType as string;
      const validQueryTypes = ["list_tasks", "count_tasks", "describe_task", "summarize_status", "help", "unknown"];
      return {
        kind: "query",
        queryType: validQueryTypes.includes(queryType) ? queryType as QueryType : "unknown",
        params: (result.params as Record<string, unknown>) ?? {},
      };
    }

    case "clarification": {
      return {
        kind: "clarification",
        message: (result.message as string) ?? "Could you please clarify?",
      };
    }

    case "error": {
      return {
        kind: "error",
        error: (result.error as string) ?? "Unknown error",
      };
    }

    default:
      return { kind: "error", error: `Unknown result kind: ${result.kind}` };
  }
}

/**
 * Pattern-based intent parsing (fallback when LLM is unavailable)
 */
export function parseIntentFallback(
  userMessage: string,
  currentTasks: Task[]
): IntentParseResult {
  const message = userMessage.toLowerCase().trim();

  // Create task patterns
  const createPatterns = [
    /^(create|add|new|make)\s+(a\s+)?task[:\s]+(.+)/i,
    /^할\s*일[:\s]+(.+)/i,
    /^작업\s*추가[:\s]+(.+)/i,
  ];

  for (const pattern of createPatterns) {
    const match = message.match(pattern);
    if (match) {
      const title = match[match.length - 1].trim();
      return {
        kind: "intent",
        intent: {
          type: "createTask",
          input: { title, priority: "medium", tags: [] },
        },
        confidence: 0.8,
      };
    }
  }

  // Delete task patterns
  const deletePatterns = [
    /^(delete|remove)\s+task\s+["\']?(.+?)["\']?$/i,
    /^삭제\s+["\']?(.+?)["\']?$/i,
  ];

  for (const pattern of deletePatterns) {
    const match = message.match(pattern);
    if (match) {
      const taskName = match[match.length - 1].trim();
      const task = currentTasks.find(t =>
        t.title.toLowerCase().includes(taskName.toLowerCase())
      );
      if (task) {
        return {
          kind: "intent",
          intent: { type: "deleteTask", input: { id: task.id } },
          confidence: 0.7,
        };
      }
    }
  }

  // Move task patterns
  const movePatterns = [
    /^(move|set)\s+["\']?(.+?)["\']?\s+to\s+(todo|in-?progress|review|done)/i,
    /^["\']?(.+?)["\']?\s*(을|를)?\s*(완료|진행|검토)/i,
  ];

  for (const pattern of movePatterns) {
    const match = message.match(pattern);
    if (match) {
      const taskName = match[2] ?? match[1];
      const statusText = (match[3] ?? "").toLowerCase();
      const statusMap: Record<string, string> = {
        todo: "todo",
        "in-progress": "in-progress",
        inprogress: "in-progress",
        진행: "in-progress",
        review: "review",
        검토: "review",
        done: "done",
        완료: "done",
      };
      const newStatus = statusMap[statusText];

      const task = currentTasks.find(t =>
        t.title.toLowerCase().includes(taskName.toLowerCase())
      );

      if (task && newStatus) {
        return {
          kind: "intent",
          intent: { type: "moveTask", input: { id: task.id, newStatus } },
          confidence: 0.7,
        };
      }
    }
  }

  // Query patterns
  if (/^(show|list|what|how many|몇|보여|목록)/i.test(message)) {
    if (/count|how many|몇/i.test(message)) {
      return { kind: "query", queryType: "count_tasks", params: {} };
    }
    return { kind: "query", queryType: "list_tasks", params: {} };
  }

  if (/^(help|도움|사용법)/i.test(message)) {
    return { kind: "query", queryType: "help", params: {} };
  }

  // Cannot determine intent
  return {
    kind: "clarification",
    message: "I'm not sure what you'd like to do. Could you please be more specific?",
  };
}
