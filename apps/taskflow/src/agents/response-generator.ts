/**
 * Response Generator (LLM2)
 *
 * Generates user-friendly responses based on the current snapshot.
 * This is the second LLM in the 2-LLM architecture.
 */

import type { Task } from "../manifesto/index.js";
import type { ResponseContext, AgentConfig, AgentResponse, IntentParseResult } from "./types.js";
import {
  RESPONSE_GENERATOR_SYSTEM_PROMPT,
  RESPONSE_GENERATOR_USER_PROMPT,
  formatTaskList,
  formatTaskSummary,
} from "./prompts.js";

/**
 * Generate a response for the user
 */
export async function generateResponse(
  context: ResponseContext,
  config: AgentConfig
): Promise<AgentResponse> {
  const { apiKey, responseModel = "gpt-4o-mini", language = "en" } = config;

  // Handle queries without LLM (direct response)
  if (context.parsedIntent.kind === "query") {
    return handleQueryResponse(context, language);
  }

  // Handle clarification
  if (context.parsedIntent.kind === "clarification") {
    return {
      message: context.parsedIntent.message,
      actionTaken: false,
      isQueryResult: false,
    };
  }

  // Handle errors
  if (context.parsedIntent.kind === "error") {
    const errorMessage = language === "ko"
      ? `죄송합니다. 오류가 발생했습니다: ${context.parsedIntent.error}`
      : `Sorry, an error occurred: ${context.parsedIntent.error}`;
    return {
      message: errorMessage,
      actionTaken: false,
      isQueryResult: false,
    };
  }

  // For intents, generate response with LLM
  try {
    const actionType = context.parsedIntent.kind === "intent" ? context.parsedIntent.intent.type : null;
    const actionTaken = !!context.actionResult?.success;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: responseModel,
        messages: [
          { role: "system", content: RESPONSE_GENERATOR_SYSTEM_PROMPT },
          {
            role: "user",
            content: RESPONSE_GENERATOR_USER_PROMPT(
              context.userMessage,
              actionTaken,
              actionType,
              context.tasks,
              context.computed,
              language,
              context.actionResult?.error
            ),
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content ?? getFallbackResponse(context, language);

    return {
      message,
      executedIntent: context.parsedIntent.kind === "intent" ? context.parsedIntent.intent : undefined,
      actionTaken,
      affectedTaskIds: context.actionResult?.affectedTaskIds,
      isQueryResult: false,
    };
  } catch (error) {
    console.error("[ResponseGenerator] Error:", error);
    return {
      message: getFallbackResponse(context, language),
      executedIntent: context.parsedIntent.kind === "intent" ? context.parsedIntent.intent : undefined,
      actionTaken: context.actionResult?.success ?? false,
      affectedTaskIds: context.actionResult?.affectedTaskIds,
      isQueryResult: false,
    };
  }
}

/**
 * Handle query responses without LLM
 */
function handleQueryResponse(
  context: ResponseContext,
  language: "en" | "ko"
): AgentResponse {
  const parsed = context.parsedIntent as Extract<IntentParseResult, { kind: "query" }>;

  switch (parsed.queryType) {
    case "list_tasks":
      return {
        message: formatTaskList(context.tasks.filter(t => !t.deletedAt), language),
        actionTaken: false,
        isQueryResult: true,
      };

    case "count_tasks":
      return {
        message: formatTaskSummary(context.computed, language),
        actionTaken: false,
        isQueryResult: true,
      };

    case "summarize_status":
      return {
        message: formatTaskSummary(context.computed, language),
        actionTaken: false,
        isQueryResult: true,
      };

    case "help":
      return {
        message: getHelpMessage(language),
        actionTaken: false,
        isQueryResult: true,
      };

    case "describe_task": {
      const taskId = parsed.params.taskId as string | undefined;
      const task = taskId ? context.tasks.find(t => t.id === taskId) : null;
      if (task) {
        return {
          message: formatTaskDetails(task, language),
          actionTaken: false,
          isQueryResult: true,
        };
      }
      return {
        message: language === "ko"
          ? "해당 작업을 찾을 수 없습니다."
          : "Task not found.",
        actionTaken: false,
        isQueryResult: true,
      };
    }

    default:
      return {
        message: language === "ko"
          ? "무엇을 도와드릴까요?"
          : "How can I help you?",
        actionTaken: false,
        isQueryResult: false,
      };
  }
}

/**
 * Get fallback response when LLM is unavailable
 */
function getFallbackResponse(
  context: ResponseContext,
  language: "en" | "ko"
): string {
  if (context.actionResult?.success) {
    if (language === "ko") {
      return "작업이 완료되었습니다.";
    }
    return "Done!";
  }

  if (context.actionResult?.error) {
    if (language === "ko") {
      return `오류가 발생했습니다: ${context.actionResult.error}`;
    }
    return `Error: ${context.actionResult.error}`;
  }

  if (language === "ko") {
    return "요청을 처리했습니다.";
  }
  return "Request processed.";
}

/**
 * Get help message
 */
function getHelpMessage(language: "en" | "ko"): string {
  if (language === "ko") {
    return `TaskFlow 도움말:

작업 관리:
- "할 일: [제목]" - 새 작업 추가
- "[작업 이름] 완료" - 작업을 완료 상태로 변경
- "[작업 이름] 삭제" - 작업 삭제

조회:
- "작업 목록" - 모든 작업 보기
- "몇 개?" - 작업 개수 확인

무엇을 도와드릴까요?`;
  }

  return `TaskFlow Help:

Task Management:
- "Add task: [title]" - Create a new task
- "Move [task] to done" - Mark a task as done
- "Delete [task]" - Delete a task

Queries:
- "List tasks" - Show all tasks
- "How many tasks?" - Show task counts

How can I help you?`;
}

/**
 * Format task details
 */
function formatTaskDetails(task: Task, language: "en" | "ko"): string {
  if (language === "ko") {
    return `작업: ${task.title}
설명: ${task.description ?? "(없음)"}
상태: ${task.status}
우선순위: ${task.priority}
태그: ${task.tags.length > 0 ? task.tags.join(", ") : "(없음)"}
생성: ${new Date(task.createdAt).toLocaleDateString("ko-KR")}`;
  }

  return `Task: ${task.title}
Description: ${task.description ?? "(none)"}
Status: ${task.status}
Priority: ${task.priority}
Tags: ${task.tags.length > 0 ? task.tags.join(", ") : "(none)"}
Created: ${new Date(task.createdAt).toLocaleDateString("en-US")}`;
}

/**
 * Generate response without LLM (for testing or when API is unavailable)
 */
export function generateResponseFallback(
  context: ResponseContext,
  language: "en" | "ko" = "en"
): AgentResponse {
  if (context.parsedIntent.kind === "query") {
    return handleQueryResponse(context, language);
  }

  return {
    message: getFallbackResponse(context, language),
    executedIntent: context.parsedIntent.kind === "intent" ? context.parsedIntent.intent : undefined,
    actionTaken: context.actionResult?.success ?? false,
    affectedTaskIds: context.actionResult?.affectedTaskIds,
    isQueryResult: false,
  };
}
