/**
 * Golden Test: Counter Workflow End-to-End
 *
 * Tests a simple counter/task tracking workflow:
 * 1. Increment counter
 * 2. Set task status
 * 3. Clear/reset
 *
 * Verifies:
 * - State transitions are correct
 * - Trace events are emitted in expected order
 * - Execution is deterministic
 *
 * @see host-SPEC-v2.0.1.md
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createGoldenRunner,
  createGoldenSchema,
  type GoldenRunner,
  type GoldenScenario,
} from "../helpers/index.js";

describe("Golden: Workflow End-to-End", () => {
  let runner: GoldenRunner;

  beforeEach(() => {
    runner = createGoldenRunner();
  });

  afterEach(async () => {
    await runner.dispose();
  });

  /**
   * Create a simple task tracking schema using only Core-supported expressions
   */
  function createTaskSchema() {
    return createGoldenSchema({
      id: "golden:task",
      fields: {
        count: { type: "number" },
        taskName: { type: "string" },
        isComplete: { type: "boolean" },
        priority: { type: "number" },
        lastAction: { type: "string" },
      },
      actions: {
        increment: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "count",
                value: {
                  kind: "add",
                  left: {
                    kind: "coalesce",
                    args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }],
                  },
                  right: { kind: "lit", value: 1 },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "increment" },
              },
            ],
          },
        },
        decrement: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "count",
                value: {
                  kind: "sub",
                  left: { kind: "get", path: "count" },
                  right: { kind: "lit", value: 1 },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "decrement" },
              },
            ],
          },
        },
        setTask: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "taskName",
                value: { kind: "get", path: "input.name" },
              },
              {
                kind: "patch",
                op: "set",
                path: "isComplete",
                value: { kind: "lit", value: false },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "setTask" },
              },
            ],
          },
        },
        completeTask: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "isComplete",
                value: { kind: "lit", value: true },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "completeTask" },
              },
            ],
          },
        },
        setPriority: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "priority",
                value: { kind: "get", path: "input.priority" },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "setPriority" },
              },
            ],
          },
        },
        reset: {
          flow: {
            kind: "seq",
            steps: [
              { kind: "patch", op: "set", path: "count", value: { kind: "lit", value: 0 } },
              { kind: "patch", op: "set", path: "taskName", value: { kind: "lit", value: "" } },
              { kind: "patch", op: "set", path: "isComplete", value: { kind: "lit", value: false } },
              { kind: "patch", op: "set", path: "priority", value: { kind: "lit", value: 0 } },
              { kind: "patch", op: "set", path: "lastAction", value: { kind: "lit", value: "reset" } },
            ],
          },
        },
      },
    });
  }

  it("should execute increment-setTask-complete workflow", async () => {
    const scenario: GoldenScenario = {
      id: "task-workflow-basic",
      description: "Increment counter, set task, complete it",
      schema: createTaskSchema(),
      initialData: {
        count: 0,
        taskName: "",
        isComplete: false,
        priority: 0,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "increment" },
        { type: "setTask", input: { name: "Buy groceries" } },
        { type: "completeTask" },
      ],
    };

    const result = await runner.execute(scenario);

    // Verify final state
    expect(result.finalSnapshot.data).toEqual({
      count: 2,
      taskName: "Buy groceries",
      isComplete: true,
      priority: 0,
      lastAction: "completeTask",
    });

    // Verify state history
    expect(result.stateHistory).toHaveLength(4);

    // After first increment
    expect(result.stateHistory[0].snapshot.data).toMatchObject({
      count: 1,
      lastAction: "increment",
    });

    // After second increment
    expect(result.stateHistory[1].snapshot.data).toMatchObject({
      count: 2,
      lastAction: "increment",
    });

    // After setTask
    expect(result.stateHistory[2].snapshot.data).toMatchObject({
      taskName: "Buy groceries",
      isComplete: false,
      lastAction: "setTask",
    });

    // Verify metadata
    expect(result.metadata.intentCount).toBe(4);
    expect(result.metadata.scenarioId).toBe("task-workflow-basic");
  });

  it("should handle increment and decrement correctly", async () => {
    const scenario: GoldenScenario = {
      id: "counter-up-down",
      description: "Increment then decrement",
      schema: createTaskSchema(),
      initialData: {
        count: 5,
        taskName: "",
        isComplete: false,
        priority: 0,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "increment" },
        { type: "decrement" },
        { type: "increment" },
        { type: "decrement" },
        { type: "decrement" },
      ],
    };

    const result = await runner.execute(scenario);

    // 5 + 1 + 1 - 1 + 1 - 1 - 1 = 5
    expect(result.finalSnapshot.data).toMatchObject({
      count: 5,
      lastAction: "decrement",
    });
  });

  it("should handle priority changes", async () => {
    const scenario: GoldenScenario = {
      id: "task-priority",
      description: "Set and change task priority",
      schema: createTaskSchema(),
      initialData: {
        count: 0,
        taskName: "",
        isComplete: false,
        priority: 0,
        lastAction: "",
      },
      intents: [
        { type: "setTask", input: { name: "Important task" } },
        { type: "setPriority", input: { priority: 1 } },
        { type: "setPriority", input: { priority: 5 } },
        { type: "setPriority", input: { priority: 3 } },
      ],
    };

    const result = await runner.execute(scenario);

    expect(result.finalSnapshot.data).toEqual({
      count: 0,
      taskName: "Important task",
      isComplete: false,
      priority: 3,
      lastAction: "setPriority",
    });
  });

  it("should be deterministic across multiple runs", async () => {
    const scenario: GoldenScenario = {
      id: "task-determinism",
      description: "Verify deterministic execution",
      schema: createTaskSchema(),
      initialData: {
        count: 0,
        taskName: "",
        isComplete: false,
        priority: 0,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "setTask", input: { name: "Test task" } },
        { type: "setPriority", input: { priority: 2 } },
        { type: "completeTask" },
        { type: "increment" },
      ],
    };

    const verification = await runner.verifyDeterminism(scenario, 3);

    expect(verification.deterministic).toBe(true);
    expect(verification.differences).toBeUndefined();

    // All runs should produce the same final state
    const finalStates = verification.results.map((r) => r.finalSnapshot.data);
    expect(finalStates[0]).toEqual(finalStates[1]);
    expect(finalStates[1]).toEqual(finalStates[2]);
  });

  it("should handle reset correctly", async () => {
    const scenario: GoldenScenario = {
      id: "task-reset",
      description: "Set state then reset",
      schema: createTaskSchema(),
      initialData: {
        count: 0,
        taskName: "",
        isComplete: false,
        priority: 0,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "increment" },
        { type: "increment" },
        { type: "setTask", input: { name: "Task to reset" } },
        { type: "setPriority", input: { priority: 5 } },
        { type: "completeTask" },
        { type: "reset" },
      ],
    };

    const result = await runner.execute(scenario);

    // After reset, all values should be cleared
    expect(result.finalSnapshot.data).toEqual({
      count: 0,
      taskName: "",
      isComplete: false,
      priority: 0,
      lastAction: "reset",
    });
  });

  it("should track state history correctly", async () => {
    const scenario: GoldenScenario = {
      id: "state-history",
      description: "Track state history through operations",
      schema: createTaskSchema(),
      initialData: {
        count: 0,
        taskName: "",
        isComplete: false,
        priority: 0,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "setTask", input: { name: "History test" } },
        { type: "completeTask" },
      ],
    };

    const result = await runner.execute(scenario);

    // Should have 3 state snapshots
    expect(result.stateHistory).toHaveLength(3);

    // First: count=1, task=""
    expect(result.stateHistory[0].intentType).toBe("increment");
    expect((result.stateHistory[0].snapshot.data as any).count).toBe(1);

    // Second: count=1, task="History test", isComplete=false
    expect(result.stateHistory[1].intentType).toBe("setTask");
    expect((result.stateHistory[1].snapshot.data as any).taskName).toBe("History test");
    expect((result.stateHistory[1].snapshot.data as any).isComplete).toBe(false);

    // Third: count=1, task="History test", isComplete=true
    expect(result.stateHistory[2].intentType).toBe("completeTask");
    expect((result.stateHistory[2].snapshot.data as any).isComplete).toBe(true);
  });
});
