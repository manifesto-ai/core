/**
 * TaskCreator Examples
 *
 * Examples for development and testing.
 * Excluded from production prompts to save tokens.
 */

export const TASK_CREATOR_EXAMPLES = `## Examples

Input: "Create a login page task"
Output: {
  "message": "Created the Login page task.",
  "tasks": [{
    "title": "Login page",
    "status": "todo",
    "priority": "medium",
    "tags": ["auth", "feature"]
  }]
}

Input: "Create tasks for: 로그인 페이지, 회원가입 페이지, 비밀번호 재설정 페이지"
Output: {
  "message": "Created 3 tasks: 로그인 페이지, 회원가입 페이지, 비밀번호 재설정 페이지",
  "tasks": [
    { "title": "로그인 페이지", "status": "todo", "priority": "high", "tags": ["auth"] },
    { "title": "회원가입 페이지", "status": "todo", "priority": "high", "tags": ["auth"] },
    { "title": "비밀번호 재설정 페이지", "status": "todo", "priority": "medium", "tags": ["auth"] }
  ]
}

Input: "Add an urgent bug fix task for the payment system"
Output: {
  "message": "Created urgent bug fix task for payment system.",
  "tasks": [{
    "title": "Fix payment system bug",
    "status": "todo",
    "priority": "high",
    "tags": ["bug", "payment"]
  }]
}

Input: "Create a design task due next Friday"
Output: {
  "message": "Created design task due on Friday.",
  "tasks": [{
    "title": "Design task",
    "description": "Complete design work",
    "status": "todo",
    "priority": "medium",
    "tags": ["design"],
    "dueDate": "2024-12-20"
  }]
}`;

/**
 * Number of examples for reporting
 */
export const TASK_CREATOR_EXAMPLE_COUNT = 4;
