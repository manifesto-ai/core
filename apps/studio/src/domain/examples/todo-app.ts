import type { EditorSource, EditorDerived, EditorAction, EditorPolicy } from "../types";
import type { StudioInitialData } from "../studio-domain";
import type { Scenario } from "../../runtime/scenario-types";

/**
 * Todo App Example Schema
 *
 * A complete example demonstrating:
 * - Sources: raw data fields
 * - Derived: computed values with dependencies
 * - Actions: user interactions with effects
 * - Policies: access control rules
 */

// ============================================================================
// Sources (Data)
// ============================================================================

const sources: Record<string, EditorSource> = {
  todos: {
    id: "todos",
    path: "data.todos",
    schemaType: "array",
    description: "List of all todo items",
    defaultValue: [],
  },
  filter: {
    id: "filter",
    path: "data.filter",
    schemaType: "string",
    description: "Current filter: 'all' | 'active' | 'completed'",
    defaultValue: "all",
  },
  newTodoText: {
    id: "newTodoText",
    path: "data.newTodoText",
    schemaType: "string",
    description: "Text input for new todo",
    defaultValue: "",
  },
  isLoading: {
    id: "isLoading",
    path: "data.isLoading",
    schemaType: "boolean",
    description: "Loading state for async operations",
    defaultValue: false,
  },
};

// ============================================================================
// Derived (Computed)
// ============================================================================

const derived: Record<string, EditorDerived> = {
  completedTodos: {
    id: "completedTodos",
    path: "derived.completedTodos",
    deps: ["data.todos"],
    description: "All completed todos",
    expr: ["filter", ["get", "data.todos"], ["get", "$.completed"]],
  },
  activeTodos: {
    id: "activeTodos",
    path: "derived.activeTodos",
    deps: ["data.todos"],
    description: "All active (incomplete) todos",
    expr: ["filter", ["get", "data.todos"], ["!", ["get", "$.completed"]]],
  },
  filteredTodos: {
    id: "filteredTodos",
    path: "derived.filteredTodos",
    deps: ["data.todos", "data.filter", "derived.activeTodos", "derived.completedTodos"],
    description: "Todos filtered by current filter",
    expr: [
      "case",
      // Core format: condition, result pairs (flat, not nested)
      ["==", ["get", "data.filter"], "all"], ["get", "data.todos"],
      ["==", ["get", "data.filter"], "active"], ["get", "derived.activeTodos"],
      ["==", ["get", "data.filter"], "completed"], ["get", "derived.completedTodos"],
      ["get", "data.todos"],  // default
    ],
  },
  totalCount: {
    id: "totalCount",
    path: "derived.totalCount",
    deps: ["data.todos"],
    description: "Total number of todos",
    expr: ["length", ["get", "data.todos"]],
  },
  completedCount: {
    id: "completedCount",
    path: "derived.completedCount",
    deps: ["derived.completedTodos"],
    description: "Number of completed todos",
    expr: ["length", ["get", "derived.completedTodos"]],
  },
  remainingCount: {
    id: "remainingCount",
    path: "derived.remainingCount",
    deps: ["derived.activeTodos"],
    description: "Number of remaining todos",
    expr: ["length", ["get", "derived.activeTodos"]],
  },
  allCompleted: {
    id: "allCompleted",
    path: "derived.allCompleted",
    deps: ["derived.totalCount", "derived.completedCount"],
    description: "Whether all todos are completed",
    expr: [
      "all",
      [">", ["get", "derived.totalCount"], 0],
      ["==", ["get", "derived.totalCount"], ["get", "derived.completedCount"]],
    ],
  },
  hasCompletedTodos: {
    id: "hasCompletedTodos",
    path: "derived.hasCompletedTodos",
    deps: ["derived.completedCount"],
    description: "Whether there are any completed todos",
    expr: [">", ["get", "derived.completedCount"], 0],
  },
  canAddTodo: {
    id: "canAddTodo",
    path: "derived.canAddTodo",
    deps: ["data.newTodoText", "data.isLoading"],
    description: "Whether a new todo can be added",
    expr: [
      "all",
      ["!", ["get", "data.isLoading"]],
      [">", ["length", ["trim", ["get", "data.newTodoText"]]], 0],
    ],
  },
};

// ============================================================================
// Actions
// ============================================================================

const actions: Record<string, EditorAction> = {
  addTodo: {
    id: "addTodo",
    path: "action.addTodo",
    description: "Add a new todo item",
    preconditions: ["get", "derived.canAddTodo"],
    effectType: "setState",
    effectConfig: {
      updates: [
        { path: "data.todos", expr: ["append", ["get", "data.todos"], { id: ["uuid"], text: ["get", "data.newTodoText"], completed: false }] },
        { path: "data.newTodoText", value: "" },
      ],
    },
  },
  toggleTodo: {
    id: "toggleTodo",
    path: "action.toggleTodo",
    description: "Toggle a todo's completed status",
    preconditions: true,
    effectType: "setState",
    effectConfig: {
      input: { todoId: "string" },
      updates: [
        // Use case expression inside map with $ context
        // Core format: condition, result, default
        { path: "data.todos", expr: ["map", ["get", "data.todos"],
          ["case",
            ["==", ["get", "$.id"], ["get", "$input.todoId"]],
            ["assoc", ["get", "$"], "completed", ["!", ["get", "$.completed"]]],
            ["get", "$"]
          ]
        ]},
      ],
    },
  },
  deleteTodo: {
    id: "deleteTodo",
    path: "action.deleteTodo",
    description: "Delete a todo item",
    preconditions: true,
    effectType: "setState",
    effectConfig: {
      input: { todoId: "string" },
      updates: [
        { path: "data.todos", expr: ["filter", ["get", "data.todos"], ["!=", ["get", "$.id"], ["get", "$input.todoId"]]] },
      ],
    },
  },
  clearCompleted: {
    id: "clearCompleted",
    path: "action.clearCompleted",
    description: "Remove all completed todos",
    preconditions: ["get", "derived.hasCompletedTodos"],
    effectType: "setState",
    effectConfig: {
      updates: [
        { path: "data.todos", expr: ["get", "derived.activeTodos"] },
      ],
    },
  },
  setFilter: {
    id: "setFilter",
    path: "action.setFilter",
    description: "Change the current filter",
    preconditions: true,
    effectType: "setState",
    effectConfig: {
      input: { filter: "string" },
      updates: [
        { path: "data.filter", expr: ["get", "$input.filter"] },
      ],
    },
  },
  toggleAll: {
    id: "toggleAll",
    path: "action.toggleAll",
    description: "Toggle all todos completed/active",
    preconditions: [">", ["get", "derived.totalCount"], 0],
    effectType: "setState",
    effectConfig: {
      updates: [
        { path: "data.todos", expr: ["map", ["get", "data.todos"],
          ["assoc", ["get", "$"], "completed", ["!", ["get", "derived.allCompleted"]]]
        ]},
      ],
    },
  },
};

// ============================================================================
// Policies
// ============================================================================

const policies: Record<string, EditorPolicy> = {
  allowAddWhenValid: {
    id: "allowAddWhenValid",
    path: "policy.allowAddWhenValid",
    targetPath: "action.addTodo",
    policyType: "allow",
    description: "Allow adding todo only when input is valid",
    condition: ["get", "derived.canAddTodo"],
  },
  allowClearWhenHasCompleted: {
    id: "allowClearWhenHasCompleted",
    path: "policy.allowClearWhenHasCompleted",
    targetPath: "action.clearCompleted",
    policyType: "allow",
    description: "Allow clearing completed only when there are completed todos",
    condition: ["get", "derived.hasCompletedTodos"],
  },
  denyToggleAllWhenEmpty: {
    id: "denyToggleAllWhenEmpty",
    path: "policy.denyToggleAllWhenEmpty",
    targetPath: "action.toggleAll",
    policyType: "deny",
    description: "Deny toggle all when there are no todos",
    condition: ["==", ["get", "derived.totalCount"], 0],
  },
};

// ============================================================================
// Scenarios (Test Cases)
// ============================================================================

const scenarios: Record<string, Scenario> = {
  addTodo: {
    id: "add-todo-test",
    name: "Add New Todo",
    description: "Test adding a new todo item when input is valid",
    given: {
      "data.todos": [],
      "data.newTodoText": "Buy milk",
      "data.isLoading": false,
      "data.filter": "all",
    },
    when: [
      { action: "action.addTodo" }
    ],
    then: [
      { path: "derived.totalCount", operator: "eq", expected: 1 },
      { path: "data.todos", operator: "length", expected: 1 },
      { path: "data.newTodoText", operator: "eq", expected: "" },
    ],
  },
  addTodoWhenEmpty: {
    id: "add-todo-empty-test",
    name: "Cannot Add Empty Todo",
    description: "Test that empty todo text prevents adding",
    given: {
      "data.todos": [],
      "data.newTodoText": "",
      "data.isLoading": false,
    },
    when: [
      { action: "action.addTodo", expectFailure: true }
    ],
    then: [
      { path: "derived.totalCount", operator: "eq", expected: 0 },
      { path: "derived.canAddTodo", operator: "falsy" },
    ],
  },
  toggleTodo: {
    id: "toggle-todo-test",
    name: "Toggle Todo Completion",
    description: "Test toggling a todo's completed status",
    given: {
      "data.todos": [
        { id: "todo-1", text: "Buy milk", completed: false }
      ],
      "data.filter": "all",
    },
    when: [
      { action: "action.toggleTodo", input: { todoId: "todo-1" } }
    ],
    then: [
      { path: "derived.completedCount", operator: "eq", expected: 1 },
      { path: "derived.remainingCount", operator: "eq", expected: 0 },
      { path: "derived.allCompleted", operator: "truthy" },
    ],
  },
  deleteTodo: {
    id: "delete-todo-test",
    name: "Delete Todo",
    description: "Test deleting a todo item",
    given: {
      "data.todos": [
        { id: "todo-1", text: "Buy milk", completed: false },
        { id: "todo-2", text: "Walk dog", completed: true },
      ],
    },
    when: [
      { action: "action.deleteTodo", input: { todoId: "todo-1" } }
    ],
    then: [
      { path: "derived.totalCount", operator: "eq", expected: 1 },
      { path: "derived.completedCount", operator: "eq", expected: 1 },
    ],
  },
  clearCompleted: {
    id: "clear-completed-test",
    name: "Clear Completed Todos",
    description: "Test clearing all completed todos",
    given: {
      "data.todos": [
        { id: "todo-1", text: "Buy milk", completed: true },
        { id: "todo-2", text: "Walk dog", completed: false },
        { id: "todo-3", text: "Read book", completed: true },
      ],
    },
    when: [
      { action: "action.clearCompleted" }
    ],
    then: [
      { path: "derived.totalCount", operator: "eq", expected: 1 },
      { path: "derived.completedCount", operator: "eq", expected: 0 },
      { path: "derived.remainingCount", operator: "eq", expected: 1 },
    ],
  },
  setFilter: {
    id: "set-filter-test",
    name: "Set Filter to Active",
    description: "Test changing the filter to show only active todos",
    given: {
      "data.todos": [
        { id: "todo-1", text: "Buy milk", completed: true },
        { id: "todo-2", text: "Walk dog", completed: false },
      ],
      "data.filter": "all",
    },
    when: [
      { action: "action.setFilter", input: { filter: "active" } }
    ],
    then: [
      { path: "data.filter", operator: "eq", expected: "active" },
    ],
  },
  toggleAll: {
    id: "toggle-all-test",
    name: "Toggle All Todos",
    description: "Test toggling all todos to completed",
    given: {
      "data.todos": [
        { id: "todo-1", text: "Buy milk", completed: false },
        { id: "todo-2", text: "Walk dog", completed: false },
      ],
    },
    when: [
      { action: "action.toggleAll" }
    ],
    then: [
      { path: "derived.allCompleted", operator: "truthy" },
      { path: "derived.completedCount", operator: "eq", expected: 2 },
      { path: "derived.remainingCount", operator: "eq", expected: 0 },
    ],
  },
};

// ============================================================================
// Export Complete Example
// ============================================================================

export const todoAppExample: StudioInitialData = {
  domain: {
    id: "todo-app",
    name: "Todo App",
    description: "A classic TodoMVC-style application with filtering, persistence, and bulk operations",
  },
  sources,
  derived,
  actions,
  policies,
  scenarios,
};

export default todoAppExample;
