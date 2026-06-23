import { createTodoRuntime } from "../src/runtime/manifesto-app";
import {
  runScriptedAgentToFinalFrame,
  SCRIPTED_AGENT_FINAL_FRAME,
} from "../src/runtime/scripted-agent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(values: readonly string[], expected: string): void {
  assert(values.includes(expected), `expected ${expected} in [${values.join(", ")}]`);
}

function assertJsonEqual(actual: unknown, expected: unknown, message: string): void {
  const actualJson = stableJson(actual);
  const expectedJson = stableJson(expected);
  assert(actualJson === expectedJson, `${message}: expected ${expectedJson}, got ${actualJson}`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

const app = createTodoRuntime();

try {
  const finalFrame = await runScriptedAgentToFinalFrame(app);
  const { state, computed, availableActions } = finalFrame.view;
  const todoIds = state.todos.map((todo) => todo.id);
  const availableActionNames = availableActions.map((action) => action.name);

  assert(finalFrame.latestResponse?.status === "settled", "latest response should be settled");
  assert(finalFrame.entries.length === 8, "final frame should keep the last 8 log entries");
  assert(state.todos.length === 2, "final state should have 2 todos");
  assert(todoIds[0] === "record-demo", "record-demo should remain first");
  assert(todoIds[1] === "publish-demo", "publish-demo should be added second");
  assert(state.todos.every((todo) => !todo.completed), "final todos should be active");
  assert(computed.todoCount === 2, "todoCount should be 2");
  assert(computed.activeCount === 2, "activeCount should be 2");
  assert(computed.completedCount === 0, "completedCount should be 0");
  assert(computed.hasCompleted === false, "hasCompleted should be false");
  assertIncludes(availableActionNames, "addTodo");
  assertIncludes(availableActionNames, "toggleTodo");
  assertIncludes(availableActionNames, "removeTodo");
  assertIncludes(availableActionNames, "setFilter");
  assert(!availableActionNames.includes("clearCompleted"), "clearCompleted should not be available in final frame");
  assertJsonEqual(state, SCRIPTED_AGENT_FINAL_FRAME.view.state, "poster state should match runtime final state");
  assertJsonEqual(computed, SCRIPTED_AGENT_FINAL_FRAME.view.computed, "poster computed should match runtime final computed");
  assertJsonEqual(
    finalFrame.entries,
    SCRIPTED_AGENT_FINAL_FRAME.entries,
    "poster log entries should match runtime final log entries",
  );
  assertJsonEqual(
    finalFrame.latestResponse?.report?.changes,
    SCRIPTED_AGENT_FINAL_FRAME.latestResponse?.report?.changes,
    "poster changed paths should match runtime final changed paths",
  );

  console.log(JSON.stringify({
    status: "ok",
    todos: state.todos,
    computed,
    availableActions: availableActionNames,
    latestResponse: finalFrame.latestResponse.status,
    logEntries: finalFrame.entries.length,
  }, null, 2));
} finally {
  app.dispose();
}
