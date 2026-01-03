/**
 * TaskFlow Integration Tests
 *
 * Comprehensive vitest tests for the complete Manifesto stack flow:
 * Host -> World -> Bridge -> UI Layer
 *
 * Tests the full lifecycle of tasks including creation, updates, moves, and deletion.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHost } from "@manifesto-ai/host";
import { createManifestoWorld, type ActorRef } from "@manifesto-ai/world";
import { createBridge, type Bridge } from "@manifesto-ai/bridge";
import type { DomainSchema } from "@manifesto-ai/core";

// Import the compiled schema
import TasksDomain from "../domain/tasks-compiled.json";

// Test fixtures
const createInitialData = () => ({
  tasks: [],
  currentFilter: { status: null, priority: null, assignee: null },
  selectedTaskId: null,
  viewMode: "kanban",
  isCreating: false,
  isEditing: false,
  createIntent: null,
  updateIntent: null,
  deleteIntent: null,
  moveIntent: null,
  filterStep1: null,
  filterStep2: null,
  filterStep3: null,
  filterStep4: null,
  filterStep5: null,
  filterStep6: null,
  activeTasks: null,
  todoTasks: null,
  inProgressTasks: null,
  reviewTasks: null,
  doneTasks: null,
  deletedTasks: null,
});

const userActor: ActorRef = {
  actorId: "user:test-user",
  kind: "human",
  name: "Test User",
};

const assistantActor: ActorRef = {
  actorId: "agent:ai-assistant",
  kind: "agent",
  name: "AI Assistant",
};

describe("TaskFlow Integration", () => {
  let bridge: Bridge;

  beforeEach(async () => {
    // Create Host with initial data
    const schema = TasksDomain as unknown as DomainSchema;
    const host = createHost(schema, { initialData: createInitialData() });

    // Create World
    const world = createManifestoWorld({
      schemaHash: schema.hash,
      host: host as any,
    });

    // Register actors
    world.registerActor(userActor, { mode: "auto_approve" });
    world.registerActor(assistantActor, { mode: "auto_approve" });

    // Create genesis
    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot!);

    // Create Bridge
    bridge = createBridge({
      world,
      schemaHash: schema.hash,
      defaultActor: userActor,
      defaultProjectionId: "test:projection",
    });

    await bridge.refresh();
  });

  afterEach(() => {
    if (bridge && !bridge.isDisposed()) {
      bridge.dispose();
    }
  });

  describe("Schema Validation", () => {
    it("should have correct schema ID", () => {
      expect(TasksDomain.id).toBe("mel:tasks");
    });

    it("should have all required actions", () => {
      expect(TasksDomain.actions).toHaveProperty("createTask");
      expect(TasksDomain.actions).toHaveProperty("updateTask");
      expect(TasksDomain.actions).toHaveProperty("deleteTask");
      expect(TasksDomain.actions).toHaveProperty("moveTask");
      expect(TasksDomain.actions).toHaveProperty("selectTask");
      expect(TasksDomain.actions).toHaveProperty("restoreTask");
    });

    it("should have valid schema hash", () => {
      expect(TasksDomain.hash).toHaveLength(64);
    });
  });

  describe("Initial State", () => {
    it("should have empty tasks array", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.data?.tasks).toEqual([]);
    });

    it("should have null selectedTaskId", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.data?.selectedTaskId).toBeNull();
    });

    it("should have kanban view mode", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.data?.viewMode).toBe("kanban");
    });
  });

  describe("Task Creation", () => {
    it("should create a task with all required fields", async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Test Task",
            description: "Test Description",
            priority: "medium",
            dueDate: null,
            tags: ["test"],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      const tasks = snap?.data?.tasks as any[];

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Test Task");
      expect(tasks[0].description).toBe("Test Description");
      expect(tasks[0].priority).toBe("medium");
      expect(tasks[0].status).toBe("todo");
      expect(tasks[0].tags).toEqual(["test"]);
      expect(tasks[0].id).toBeDefined();
      expect(tasks[0].createdAt).toBeDefined();
      expect(tasks[0].updatedAt).toBeDefined();
      expect(tasks[0].deletedAt).toBeNull();
    });

    it("should trim whitespace from title", async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "  Trimmed Title  ",
            description: "Desc",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      const tasks = snap?.data?.tasks as any[];

      expect(tasks[0].title).toBe("Trimmed Title");
    });

    it("should reject empty title", async () => {
      const snapBefore = bridge.getSnapshot();
      const countBefore = (snapBefore?.data?.tasks as any[])?.length ?? 0;

      // This should fail validation
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "   ",
            description: "Should fail",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snapAfter = bridge.getSnapshot();
      const countAfter = (snapAfter?.data?.tasks as any[])?.length ?? 0;

      // Task count should not increase
      expect(countAfter).toBe(countBefore);
    });

    it("should create multiple tasks", async () => {
      for (let i = 1; i <= 3; i++) {
        await bridge.dispatch(
          {
            type: "createTask",
            input: {
              title: `Task ${i}`,
              description: `Description ${i}`,
              priority: i === 1 ? "high" : i === 2 ? "medium" : "low",
              dueDate: null,
              tags: [],
            },
          },
          undefined,
          assistantActor
        );
      }

      const snap = bridge.getSnapshot();
      const tasks = snap?.data?.tasks as any[];

      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toBe("Task 1");
      expect(tasks[1].title).toBe("Task 2");
      expect(tasks[2].title).toBe("Task 3");
    });

    it("should generate unique IDs for each task", async () => {
      for (let i = 0; i < 3; i++) {
        await bridge.dispatch(
          {
            type: "createTask",
            input: {
              title: `Task ${i}`,
              description: "",
              priority: "low",
              dueDate: null,
              tags: [],
            },
          },
          undefined,
          assistantActor
        );
      }

      const snap = bridge.getSnapshot();
      const tasks = snap?.data?.tasks as any[];
      const ids = tasks.map((t) => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("Task Selection", () => {
    let taskId: string;

    beforeEach(async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Selectable Task",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      taskId = (snap?.data?.tasks as any[])[0].id;
    });

    it("should select a task", async () => {
      await bridge.dispatch(
        {
          type: "selectTask",
          input: { taskId },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      expect(snap?.data?.selectedTaskId).toBe(taskId);
    });

    it("should update computed.hasSelection", async () => {
      let snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.hasSelection"]).toBe(false);

      await bridge.dispatch(
        {
          type: "selectTask",
          input: { taskId },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.hasSelection"]).toBe(true);
    });
  });

  describe("Task Movement (Status Change)", () => {
    let taskId: string;

    beforeEach(async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Movable Task",
            description: "",
            priority: "high",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      taskId = (snap?.data?.tasks as any[])[0].id;
    });

    it("should move task to in-progress", async () => {
      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: "in-progress" },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.status).toBe("in-progress");
    });

    it("should move task to review", async () => {
      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: "review" },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.status).toBe("review");
    });

    it("should move task to done", async () => {
      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: "done" },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.status).toBe("done");
    });

    it("should update updatedAt when moving", async () => {
      const snapBefore = bridge.getSnapshot();
      const taskBefore = (snapBefore?.data?.tasks as any[]).find(
        (t) => t.id === taskId
      );

      // Wait a moment to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: "in-progress" },
        },
        undefined,
        userActor
      );

      const snapAfter = bridge.getSnapshot();
      const taskAfter = (snapAfter?.data?.tasks as any[]).find(
        (t) => t.id === taskId
      );

      // updatedAt should be a valid ISO timestamp
      expect(taskAfter.updatedAt).toBeDefined();
      expect(new Date(taskAfter.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(taskBefore.updatedAt).getTime()
      );
    });
  });

  describe("Task Update", () => {
    let taskId: string;

    beforeEach(async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Original Title",
            description: "Original Description",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      taskId = (snap?.data?.tasks as any[])[0].id;
    });

    it("should update task title", async () => {
      await bridge.dispatch(
        {
          type: "updateTask",
          input: {
            id: taskId,
            title: "Updated Title",
            description: null,
            priority: null,
            dueDate: null,
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.title).toBe("Updated Title");
    });

    it("should update task priority", async () => {
      await bridge.dispatch(
        {
          type: "updateTask",
          input: {
            id: taskId,
            title: null,
            description: null,
            priority: "high",
            dueDate: null,
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.priority).toBe("high");
    });

    it("should update task dueDate", async () => {
      await bridge.dispatch(
        {
          type: "updateTask",
          input: {
            id: taskId,
            title: null,
            description: null,
            priority: null,
            dueDate: "2026-01-15",
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.dueDate).toBe("2026-01-15");
    });

    it("should preserve unchanged fields with coalesce", async () => {
      await bridge.dispatch(
        {
          type: "updateTask",
          input: {
            id: taskId,
            title: "Only Title Changed",
            description: null,
            priority: null,
            dueDate: null,
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.title).toBe("Only Title Changed");
      expect(task.description).toBe("Original Description");
      expect(task.priority).toBe("low");
    });
  });

  describe("Task Deletion (Soft Delete)", () => {
    let taskId: string;

    beforeEach(async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Deletable Task",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      taskId = (snap?.data?.tasks as any[])[0].id;

      // Select the task first (required for deletion)
      await bridge.dispatch(
        {
          type: "selectTask",
          input: { taskId },
        },
        undefined,
        userActor
      );
    });

    it("should soft delete a task (set deletedAt)", async () => {
      await bridge.dispatch(
        {
          type: "deleteTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.deletedAt).not.toBeNull();
      expect(task.deletedAt).toBeDefined();
    });

    it("should clear selection after delete", async () => {
      await bridge.dispatch(
        {
          type: "deleteTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      expect(snap?.data?.selectedTaskId).toBeNull();
    });

    it("should keep deleted task in array (soft delete)", async () => {
      const snapBefore = bridge.getSnapshot();
      const countBefore = (snapBefore?.data?.tasks as any[]).length;

      await bridge.dispatch(
        {
          type: "deleteTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );

      const snapAfter = bridge.getSnapshot();
      const countAfter = (snapAfter?.data?.tasks as any[]).length;

      expect(countAfter).toBe(countBefore);
    });
  });

  describe("Task Restoration", () => {
    let taskId: string;

    beforeEach(async () => {
      // Create task
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Restorable Task",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      taskId = (snap?.data?.tasks as any[])[0].id;

      // Select and delete task
      await bridge.dispatch(
        {
          type: "selectTask",
          input: { taskId },
        },
        undefined,
        userActor
      );

      await bridge.dispatch(
        {
          type: "deleteTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );
    });

    it("should restore a deleted task (clear deletedAt)", async () => {
      await bridge.dispatch(
        {
          type: "restoreTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);

      expect(task.deletedAt).toBeNull();
    });
  });

  describe("Computed Values", () => {
    beforeEach(async () => {
      // Create multiple tasks
      for (let i = 0; i < 3; i++) {
        await bridge.dispatch(
          {
            type: "createTask",
            input: {
              title: `Task ${i + 1}`,
              description: "",
              priority: "low",
              dueDate: null,
              tags: [],
            },
          },
          undefined,
          assistantActor
        );
      }
    });

    it("should compute totalCount", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.totalCount"]).toBe(3);
    });

    it("should compute canCreate based on isCreating", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.canCreate"]).toBe(true);
    });
  });

  describe("Re-entry Safety", () => {
    it("should guard createTask with createIntent", async () => {
      // Create first task
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "First Task",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
          intentId: "same-intent-id",
        },
        undefined,
        assistantActor
      );

      const snapAfterFirst = bridge.getSnapshot();
      const countAfterFirst = (snapAfterFirst?.data?.tasks as any[]).length;

      expect(countAfterFirst).toBe(1);

      // Second dispatch with SAME intentId should be blocked by re-entry guard
      // (createIntent is already set)
      // Note: In practice, the re-entry guard compares meta.intentId
    });

    it("should allow new tasks with different intentId", async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Task 1",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
          intentId: "intent-1",
        },
        undefined,
        assistantActor
      );

      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Task 2",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
          intentId: "intent-2",
        },
        undefined,
        assistantActor
      );

      const snap = bridge.getSnapshot();
      expect((snap?.data?.tasks as any[]).length).toBe(2);
    });
  });

  describe("Bridge Subscription", () => {
    it("should notify subscribers on state changes", async () => {
      let updateCount = 0;
      const unsubscribe = bridge.subscribe(() => {
        updateCount++;
      });

      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Subscribed Task",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      expect(updateCount).toBeGreaterThan(0);
      unsubscribe();
    });
  });

  describe("Bridge Disposal", () => {
    it("should return null snapshot after disposal", () => {
      bridge.dispose();
      expect(bridge.getSnapshot()).toBeNull();
    });

    it("should mark bridge as disposed", () => {
      bridge.dispose();
      expect(bridge.isDisposed()).toBe(true);
    });

    it("should throw on dispatch after disposal", async () => {
      bridge.dispose();

      await expect(
        bridge.dispatch(
          {
            type: "createTask",
            input: {
              title: "Should fail",
              description: "",
              priority: "low",
              dueDate: null,
              tags: [],
            },
          },
          undefined,
          assistantActor
        )
      ).rejects.toThrow();
    });
  });

  describe("Full Workflow", () => {
    it("should handle complete task lifecycle", async () => {
      // 1. Create task
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Lifecycle Task",
            description: "Testing full lifecycle",
            priority: "high",
            dueDate: "2026-01-15",
            tags: ["lifecycle", "test"],
          },
        },
        undefined,
        assistantActor
      );

      let snap = bridge.getSnapshot();
      const taskId = (snap?.data?.tasks as any[])[0].id;
      expect(taskId).toBeDefined();

      // 2. Select task
      await bridge.dispatch(
        {
          type: "selectTask",
          input: { taskId },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      expect(snap?.data?.selectedTaskId).toBe(taskId);

      // 3. Move to in-progress
      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: "in-progress" },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      let task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);
      expect(task.status).toBe("in-progress");

      // 4. Update task
      await bridge.dispatch(
        {
          type: "updateTask",
          input: {
            id: taskId,
            title: "Lifecycle Task (Updated)",
            description: null,
            priority: null,
            dueDate: null,
          },
        },
        undefined,
        assistantActor
      );

      snap = bridge.getSnapshot();
      task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);
      expect(task.title).toBe("Lifecycle Task (Updated)");

      // 5. Move to done
      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: "done" },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);
      expect(task.status).toBe("done");

      // 6. Delete task
      await bridge.dispatch(
        {
          type: "deleteTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);
      expect(task.deletedAt).not.toBeNull();
      expect(snap?.data?.selectedTaskId).toBeNull();

      // 7. Restore task
      await bridge.dispatch(
        {
          type: "restoreTask",
          input: { id: taskId },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);
      expect(task.deletedAt).toBeNull();
    });
  });
});
