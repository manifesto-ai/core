/**
 * QueryAgent Examples
 *
 * Examples for development and testing.
 * Excluded from production prompts to save tokens.
 */

export const QUERY_AGENT_EXAMPLES = `## Examples

Input: "How many tasks do I have?"
Summary: { total: 5, byStatus: { todo: 2, in-progress: 1, review: 1, done: 1 } }
Output: {
  "message": "You have 5 tasks total: 2 To Do, 1 In Progress, 1 In Review, and 1 Done."
}

Input: "How many tasks are there?"
Summary: { total: 3, byStatus: { todo: 1, in-progress: 1, done: 1 } }
Output: {
  "message": "You have 3 tasks total: 1 To Do, 1 In Progress, 1 Done."
}

Input: "What should I focus on?"
Tasks: [{ title: "Urgent bug", priority: "high", dueDate: "2024-12-14" }, { title: "Feature", priority: "medium" }]
Output: {
  "message": "I'd recommend focusing on 'Urgent bug' first - it's high priority and due tomorrow. After that, you can work on the 'Feature' task."
}

Input: "What tasks are due today?"
Summary: { dueToday: 2 }
Tasks: [{ title: "보고서 작성", dueDate: "2024-12-13" }, { title: "회의 준비", dueDate: "2024-12-13" }]
Output: {
  "message": "You have 2 tasks due today:\\n• 보고서 작성\\n• 회의 준비"
}

Input: "Any overdue tasks?"
Summary: { overdue: 1 }
Tasks: [{ title: "Review PR", dueDate: "2024-12-10", status: "todo" }]
Output: {
  "message": "Yes, you have 1 overdue task: 'Review PR' was due on December 10th and is still in To Do status."
}

Input: "Summarize my tasks"
Summary: { total: 6, byStatus: { todo: 3, in-progress: 2, done: 1 }, byPriority: { high: 1, medium: 4, low: 1 } }
Output: {
  "message": "Here's your task summary:\\n• 6 total tasks\\n• 3 To Do, 2 In Progress, 1 Done\\n• 1 high priority task needs attention\\n• Overall progress: 17% complete"
}`;

/**
 * Number of examples for reporting
 */
export const QUERY_AGENT_EXAMPLE_COUNT = 6;
