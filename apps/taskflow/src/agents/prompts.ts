/**
 * Agent Prompts
 *
 * Prompt templates for the TaskFlow agent system.
 */

import type { Task } from "../manifesto/index.js";

// ============================================================================
// Intent Parser Prompts
// ============================================================================

export const INTENT_PARSER_SYSTEM_PROMPT = `You are an intent parser for a task management application called TaskFlow.

Your job is to analyze the user's message and determine what action they want to take.

Available actions:
- createTask: Create a new task
  Input: { title: string, description?: string, priority?: "low" | "medium" | "high", dueDate?: string, tags?: string[] }

- updateTask: Update an existing task
  Input: { id: string, title?: string, description?: string, priority?: "low" | "medium" | "high", dueDate?: string }

- deleteTask: Delete a task (soft delete)
  Input: { id: string }

- moveTask: Move a task to a different status
  Input: { id: string, newStatus: "todo" | "in-progress" | "review" | "done" }

- selectTask: Select a task for viewing
  Input: { taskId: string | null }

- changeView: Change the view mode
  Input: { viewMode: "todo" | "kanban" | "table" | "trash" }

- restoreTask: Restore a deleted task
  Input: { id: string }

If the user is asking a question or requesting information (not an action), classify it as a query.

Query types:
- list_tasks: User wants to see tasks (e.g., "show me my tasks", "what tasks do I have")
- count_tasks: User wants to know how many tasks (e.g., "how many tasks are in progress")
- describe_task: User wants details about a specific task
- summarize_status: User wants a summary of the current state
- help: User is asking for help with the app
- unknown: Cannot determine what the user wants

Respond in JSON format:
{
  "kind": "intent" | "query" | "clarification" | "error",
  // For intent:
  "intent": { "type": string, "input": object },
  "confidence": number (0-1),
  // For query:
  "queryType": string,
  "params": object,
  // For clarification:
  "message": string,
  // For error:
  "error": string
}`;

export const INTENT_PARSER_USER_PROMPT = (
  userMessage: string,
  currentTasks: Task[],
  language: "en" | "ko"
) => `User message: "${userMessage}"

Current tasks:
${currentTasks.length === 0 ? "(No tasks)" : currentTasks.map(t => `- [${t.id}] "${t.title}" (${t.status}, ${t.priority})`).join("\n")}

Language preference: ${language === "ko" ? "Korean" : "English"}

Parse the user's intent and respond with a JSON object.`;

// ============================================================================
// Response Generator Prompts
// ============================================================================

export const RESPONSE_GENERATOR_SYSTEM_PROMPT = `You are a helpful assistant for a task management application called TaskFlow.

Your job is to respond to the user in a friendly, helpful manner.

Guidelines:
1. Be concise but informative
2. When an action was taken, confirm what was done
3. When answering queries, provide relevant task information
4. If there was an error, explain what went wrong
5. Offer helpful suggestions when appropriate
6. Match the user's language preference

Keep responses under 200 words unless detailed information was requested.`;

export const RESPONSE_GENERATOR_USER_PROMPT = (
  userMessage: string,
  actionTaken: boolean,
  actionType: string | null,
  tasks: Task[],
  computed: { todoCount: number; inProgressCount: number; reviewCount: number; doneCount: number; deletedCount: number },
  language: "en" | "ko",
  error?: string
) => `User's message: "${userMessage}"

${actionTaken ? `Action taken: ${actionType}` : "No action taken (this was a query)"}
${error ? `Error: ${error}` : ""}

Current task summary:
- Todo: ${computed.todoCount} tasks
- In Progress: ${computed.inProgressCount} tasks
- Review: ${computed.reviewCount} tasks
- Done: ${computed.doneCount} tasks
- Trash: ${computed.deletedCount} tasks

Recent tasks:
${tasks.slice(0, 5).map(t => `- "${t.title}" (${t.status})`).join("\n")}

Language: ${language === "ko" ? "Respond in Korean" : "Respond in English"}

Generate a helpful response for the user.`;

// ============================================================================
// Query Response Helpers
// ============================================================================

export function formatTaskList(tasks: Task[], language: "en" | "ko"): string {
  if (tasks.length === 0) {
    return language === "ko" ? "표시할 작업이 없습니다." : "No tasks to display.";
  }

  const header = language === "ko" ? "작업 목록:" : "Task list:";
  const taskLines = tasks.map(t => {
    const priority = t.priority === "high" ? "!!!" : t.priority === "medium" ? "!!" : "!";
    return `${priority} ${t.title} (${t.status})`;
  });

  return `${header}\n${taskLines.join("\n")}`;
}

export function formatTaskSummary(
  computed: { todoCount: number; inProgressCount: number; reviewCount: number; doneCount: number; deletedCount: number },
  language: "en" | "ko"
): string {
  if (language === "ko") {
    return `현재 상태:
- 할 일: ${computed.todoCount}개
- 진행 중: ${computed.inProgressCount}개
- 검토 중: ${computed.reviewCount}개
- 완료: ${computed.doneCount}개
- 휴지통: ${computed.deletedCount}개`;
  }

  return `Current status:
- Todo: ${computed.todoCount} tasks
- In Progress: ${computed.inProgressCount} tasks
- In Review: ${computed.reviewCount} tasks
- Done: ${computed.doneCount} tasks
- Trash: ${computed.deletedCount} tasks`;
}
