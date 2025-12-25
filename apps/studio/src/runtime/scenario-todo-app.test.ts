/**
 * Todo App Scenario Tests
 *
 * Verifies that all Todo App scenarios pass with the Core-based expression evaluator.
 */

import { describe, it, expect } from "vitest";
import { executeScenario, type DomainDefinition } from "./scenario-executor";
import { todoAppExample } from "../domain/examples/todo-app";

describe("Todo App Scenarios", () => {
  const domain: DomainDefinition = {
    sources: todoAppExample.sources,
    derived: todoAppExample.derived,
    actions: todoAppExample.actions,
    policies: todoAppExample.policies,
  };

  const scenarios = todoAppExample.scenarios;

  it("should execute Add New Todo scenario", () => {
    const result = executeScenario(scenarios.addTodo, domain);

    expect(result.passed).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  it("should execute Cannot Add Empty Todo scenario", () => {
    const result = executeScenario(scenarios.addTodoWhenEmpty, domain);

    // This step is expected to fail (precondition not met)
    // With expectFailure: true, the scenario should PASS
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(false);
    expect(result.steps[0].preconditionMet).toBe(false);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  it("should execute Toggle Todo Completion scenario", () => {
    const result = executeScenario(scenarios.toggleTodo, domain);

    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  it("should execute Delete Todo scenario", () => {
    const result = executeScenario(scenarios.deleteTodo, domain);

    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  it("should execute Clear Completed Todos scenario", () => {
    const result = executeScenario(scenarios.clearCompleted, domain);

    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  it("should execute Set Filter to Active scenario", () => {
    const result = executeScenario(scenarios.setFilter, domain);

    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  it("should execute Toggle All Todos scenario", () => {
    const result = executeScenario(scenarios.toggleAll, domain);

    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    expect(result.assertions.every(a => a.passed)).toBe(true);
  });

  describe("detailed assertion checks", () => {
    it("Add Todo: should create todo with UUID", () => {
      const result = executeScenario(scenarios.addTodo, domain);

      const todos = result.finalState["data.todos"] as Array<{ id: string; text: string }>;
      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe("Buy milk");
      expect(todos[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("Toggle Todo: should flip completed status", () => {
      const result = executeScenario(scenarios.toggleTodo, domain);

      const todos = result.finalState["data.todos"] as Array<{ id: string; completed: boolean }>;
      expect(todos).toHaveLength(1);
      expect(todos[0].completed).toBe(true);
    });

    it("Clear Completed: should only keep active todos", () => {
      const result = executeScenario(scenarios.clearCompleted, domain);

      const todos = result.finalState["data.todos"] as Array<{ id: string; text: string }>;
      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe("Walk dog");
    });

    it("Toggle All: should mark all as completed", () => {
      const result = executeScenario(scenarios.toggleAll, domain);

      const todos = result.finalState["data.todos"] as Array<{ completed: boolean }>;
      expect(todos.every(t => t.completed)).toBe(true);
    });
  });
});
