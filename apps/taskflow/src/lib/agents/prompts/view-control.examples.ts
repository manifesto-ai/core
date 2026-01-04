/**
 * ViewControl Examples
 *
 * Examples for development and testing.
 * Excluded from production prompts to save tokens.
 */

export const VIEW_CONTROL_EXAMPLES = `## Examples

Input: "Switch to kanban view"
Output: {
  "message": "Switched to Kanban view.",
  "actions": { "viewMode": "kanban" }
}

Input: "Switch to table view"
Output: {
  "message": "Switched to Table view.",
  "actions": { "viewMode": "table" }
}

Input: "Show tasks due this week"
Output: {
  "message": "Showing tasks due this week.",
  "actions": { "dateFilter": { "field": "dueDate", "type": "week" } }
}

Input: "Show only tasks due today"
Output: {
  "message": "Filtering tasks due today.",
  "actions": { "dateFilter": { "field": "dueDate", "type": "today" } }
}

Input: "Clear the filter and show all tasks"
Output: {
  "message": "Cleared filters. Showing all tasks.",
  "actions": { "dateFilter": "clear" }
}

Input: "Select the login task"
Context: Tasks: [{ id: "task-1", title: "Login page" }]
Output: {
  "message": "Selected Login page task.",
  "actions": { "selectedTaskId": "task-1" }
}

Input: "Open the 로그인 페이지 task"
Context: Tasks: [{ id: "task-1", title: "로그인 페이지" }]
Output: {
  "message": "Selected 로그인 페이지 task.",
  "actions": { "selectedTaskId": "task-1" }
}

Input: "Close the task panel"
Output: {
  "message": "Closed the task detail panel.",
  "actions": { "selectedTaskId": "clear" }
}

Input: "Show kanban and filter by this week"
Output: {
  "message": "Switched to Kanban view and filtering by this week.",
  "actions": {
    "viewMode": "kanban",
    "dateFilter": { "field": "dueDate", "type": "week" }
  }
}`;

/**
 * Number of examples for reporting
 */
export const VIEW_CONTROL_EXAMPLE_COUNT = 9;
