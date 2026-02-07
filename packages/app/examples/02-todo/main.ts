/**
 * Example 02: Todo List
 *
 * A todo list with typed items, computed values, and array operations.
 * Demonstrates: types, Array state, computed, action parameters, $item iteration
 *
 * Run: cd packages/app && pnpm exec tsx examples/02-todo/main.ts
 */

import { createApp, createSilentPolicyService } from "../../src/index.js";

const app = createApp({
  schema: `
    domain TodoApp {
      type Todo = {
        id: string,
        title: string,
        completed: boolean
      }

      state {
        todos: Array<Todo> = []
        filterMode: "all" | "active" | "completed" = "all"
      }

      computed todoCount = len(todos)
      computed completedCount = len(filter(todos, $item.completed))
      computed activeCount = sub(todoCount, completedCount)
      computed hasCompleted = gt(completedCount, 0)

      action addTodo(title: string) {
        onceIntent when neq(trim(title), "") {
          patch todos = append(todos, {
            id: $system.uuid,
            title: trim(title),
            completed: false
          })
        }
      }

      action toggleTodo(id: string) {
        onceIntent {
          patch todos = map(todos,
            cond(eq($item.id, id),
              { id: $item.id, title: $item.title, completed: not($item.completed) },
              $item
            )
          )
        }
      }

      action removeTodo(id: string) {
        onceIntent {
          patch todos = filter(todos, neq($item.id, id))
        }
      }

      action setFilter(newFilter: "all" | "active" | "completed") {
        onceIntent {
          patch filterMode = newFilter
        }
      }

      action clearCompleted() {
        onceIntent when hasCompleted {
          patch todos = filter(todos, not($item.completed))
        }
      }
    }
  `,
  effects: {},
  policyService: createSilentPolicyService(),
});

async function main() {
  await app.ready();

  // Add todos
  await app.act("addTodo", { title: "Learn Manifesto" }).done();
  await app.act("addTodo", { title: "Build an app" }).done();
  await app.act("addTodo", { title: "Ship it" }).done();

  const state1 = app.getState();
  console.log("After adding 3 todos:");
  console.log("  todoCount:", state1.computed["computed.todoCount"]);
  console.log("  activeCount:", state1.computed["computed.activeCount"]);
  console.log("  completedCount:", state1.computed["computed.completedCount"]);

  // Toggle first todo
  const firstTodoId = (state1.data.todos as any[])[0].id;
  await app.act("toggleTodo", { id: firstTodoId }).done();

  const state2 = app.getState();
  console.log("\nAfter toggling first todo:");
  console.log("  activeCount:", state2.computed["computed.activeCount"]);
  console.log("  completedCount:", state2.computed["computed.completedCount"]);
  console.log("  hasCompleted:", state2.computed["computed.hasCompleted"]);

  // Set filter
  await app.act("setFilter", { newFilter: "active" }).done();
  console.log("\nFilter set to:", app.getState().data.filterMode);

  // Clear completed
  await app.act("clearCompleted").done();

  const state3 = app.getState();
  console.log("\nAfter clearCompleted:");
  console.log("  todoCount:", state3.computed["computed.todoCount"]);
  console.log("  completedCount:", state3.computed["computed.completedCount"]);

  // List remaining todos
  console.log("\nRemaining todos:");
  for (const todo of state3.data.todos as any[]) {
    console.log(`  - ${todo.title} (completed: ${todo.completed})`);
  }

  await app.dispose();
  console.log("\nDone!");
}

main().catch(console.error);
