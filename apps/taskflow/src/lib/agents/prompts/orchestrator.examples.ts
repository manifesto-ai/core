/**
 * Orchestrator Examples
 *
 * Examples for development and testing.
 * Excluded from production prompts to save tokens.
 */

export const ORCHESTRATOR_EXAMPLES = `## Examples

Input: "로그인 페이지 태스크 만들어줘"
Output: { "intent": "create", "agents": [{ "agent": "task-creator", "params": { "instruction": "로그인 페이지 태스크 만들어줘" }, "reason": "User wants to create a new task" }], "reasoning": "Create intent detected" }

Input: "Show me the kanban board"
Output: { "intent": "view", "agents": [{ "agent": "view-control", "params": { "instruction": "Show me the kanban board" }, "reason": "Change view mode to kanban" }], "reasoning": "View change request" }

Input: "Mark the login task as done"
Output: { "intent": "mutate", "agents": [{ "agent": "task-mutator", "params": { "instruction": "Mark the login task as done" }, "reason": "Update task status" }], "reasoning": "Status change request" }

Input: "몇 개의 태스크가 있어?"
Output: { "intent": "query", "agents": [{ "agent": "query", "params": { "instruction": "몇 개의 태스크가 있어?" }, "reason": "Count tasks" }], "reasoning": "Question about task count" }

Input: "Create 3 tasks for auth feature and switch to table view"
Output: { "intent": "multi", "agents": [{ "agent": "task-creator", "params": { "instruction": "Create 3 tasks for auth feature" }, "reason": "Create multiple tasks" }, { "agent": "view-control", "params": { "instruction": "switch to table view" }, "reason": "Change view after creation" }], "reasoning": "Multiple intents: create tasks + change view" }`;

/**
 * Number of examples for reporting
 */
export const ORCHESTRATOR_EXAMPLE_COUNT = 5;
