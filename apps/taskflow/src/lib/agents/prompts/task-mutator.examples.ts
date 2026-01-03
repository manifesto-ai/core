/**
 * TaskMutator Examples
 *
 * Examples for development and testing.
 * Excluded from production prompts to save tokens.
 */

export const TASK_MUTATOR_EXAMPLES = `## Examples

Input: "Mark the login task as done"
Context: Tasks: [{ index: 0, id: "task-1", title: "Login page" }]
Output: {
  "message": "Marked Login page as done.",
  "operations": [{
    "type": "update",
    "taskIndex": 0,
    "taskId": "task-1",
    "changes": { "status": "done" }
  }]
}

Input: "Delete the 로그인 페이지 task"
Context: Tasks: [{ index: 0, id: "task-1", title: "로그인 페이지" }]
Output: {
  "message": "Deleted 로그인 페이지 task.",
  "operations": [{
    "type": "delete",
    "taskIndex": 0,
    "taskId": "task-1"
  }]
}

Input: "Change all todo tasks to in-progress"
Context: Tasks: [{ index: 0, id: "task-1", title: "Task A", status: "todo" }, { index: 2, id: "task-3", title: "Task C", status: "todo" }]
Output: {
  "message": "Changed 2 tasks to In Progress.",
  "operations": [
    { "type": "update", "taskIndex": 0, "taskId": "task-1", "changes": { "status": "in-progress" } },
    { "type": "update", "taskIndex": 2, "taskId": "task-3", "changes": { "status": "in-progress" } }
  ]
}

Input: "Restore the deleted task"
Context: Deleted tasks: [{ id: "task-2", title: "Signup page" }]
Output: {
  "message": "Restored Signup page task.",
  "operations": [{
    "type": "restore",
    "taskId": "task-2"
  }]
}`;

/**
 * Number of examples for reporting
 */
export const TASK_MUTATOR_EXAMPLE_COUNT = 4;
