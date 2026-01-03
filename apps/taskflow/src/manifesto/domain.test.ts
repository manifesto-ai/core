/**
 * TaskFlow Domain Tests
 *
 * Tests the domain schema, types, and computed values.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHost } from "@manifesto-ai/host";
import { createManifestoWorld, type ActorRef } from "@manifesto-ai/world";
import { createBridge, type Bridge } from "@manifesto-ai/bridge";
import type { DomainSchema } from "@manifesto-ai/core";

import TasksDomain from "../domain/tasks-compiled.json";

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

describe("TaskFlow Domain", () => {
  describe("Schema Structure", () => {
    it("should have Task type definition", () => {
      expect(TasksDomain.types).toHaveProperty("Task");
      const taskType = TasksDomain.types.Task;
      expect(taskType.definition.kind).toBe("object");
    });

    it("should have Filter type definition", () => {
      expect(TasksDomain.types).toHaveProperty("Filter");
    });

    it("should have all state fields", () => {
      const fields = TasksDomain.state.fields;
      expect(fields).toHaveProperty("tasks");
      expect(fields).toHaveProperty("currentFilter");
      expect(fields).toHaveProperty("selectedTaskId");
      expect(fields).toHaveProperty("viewMode");
      expect(fields).toHaveProperty("isCreating");
      expect(fields).toHaveProperty("isEditing");
    });

    it("should have all computed fields", () => {
      const computed = TasksDomain.computed.fields;
      expect(computed).toHaveProperty("computed.totalCount");
      expect(computed).toHaveProperty("computed.hasSelection");
      expect(computed).toHaveProperty("computed.canCreate");
      expect(computed).toHaveProperty("computed.canEdit");
      expect(computed).toHaveProperty("computed.canDelete");
    });

    it("should have all action definitions", () => {
      const actions = TasksDomain.actions;
      expect(actions).toHaveProperty("createTask");
      expect(actions).toHaveProperty("updateTask");
      expect(actions).toHaveProperty("deleteTask");
      expect(actions).toHaveProperty("moveTask");
      expect(actions).toHaveProperty("selectTask");
      expect(actions).toHaveProperty("restoreTask");
      expect(actions).toHaveProperty("refreshFilters");
      expect(actions).toHaveProperty("setFilter");
      expect(actions).toHaveProperty("clearFilter");
      expect(actions).toHaveProperty("changeView");
    });
  });

  describe("Action Input Schemas", () => {
    it("createTask should require title, description, priority, dueDate, tags", () => {
      const input = TasksDomain.actions.createTask.input;
      expect(input.fields).toHaveProperty("title");
      expect(input.fields).toHaveProperty("description");
      expect(input.fields).toHaveProperty("priority");
      expect(input.fields).toHaveProperty("dueDate");
      expect(input.fields).toHaveProperty("tags");
    });

    it("updateTask should require id and optional fields", () => {
      const input = TasksDomain.actions.updateTask.input;
      expect(input.fields).toHaveProperty("id");
      expect(input.fields).toHaveProperty("title");
      expect(input.fields).toHaveProperty("description");
      expect(input.fields).toHaveProperty("priority");
      expect(input.fields).toHaveProperty("dueDate");
    });

    it("deleteTask should require id", () => {
      const input = TasksDomain.actions.deleteTask.input;
      expect(input.fields).toHaveProperty("id");
    });

    it("moveTask should require id and newStatus", () => {
      const input = TasksDomain.actions.moveTask.input;
      expect(input.fields).toHaveProperty("id");
      expect(input.fields).toHaveProperty("newStatus");
    });
  });

  describe("Action Availability", () => {
    it("deleteTask should have availability condition", () => {
      expect(TasksDomain.actions.deleteTask.available).toBeDefined();
      expect(TasksDomain.actions.deleteTask.available.path).toBe(
        "computed.canDelete"
      );
    });

    it("createTask should have availability condition", () => {
      expect(TasksDomain.actions.createTask.available).toBeDefined();
      expect(TasksDomain.actions.createTask.available.path).toBe(
        "computed.canCreate"
      );
    });
  });
});

describe("TaskFlow Computed Values", () => {
  let bridge: Bridge;

  beforeEach(async () => {
    const schema = TasksDomain as unknown as DomainSchema;
    const host = createHost(schema, { initialData: createInitialData() });
    const world = createManifestoWorld({
      schemaHash: schema.hash,
      host: host as any,
    });

    world.registerActor(userActor, { mode: "auto_approve" });
    world.registerActor(assistantActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot!);

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

  describe("computed.totalCount", () => {
    it("should be 0 with no tasks", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.totalCount"]).toBe(0);
    });

    it("should count all tasks", async () => {
      for (let i = 0; i < 5; i++) {
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
      expect(snap?.computed?.["computed.totalCount"]).toBe(5);
    });
  });

  describe("computed.hasSelection", () => {
    it("should be false with no selection", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.hasSelection"]).toBe(false);
    });

    it("should be true after selecting a task", async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Test",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      let snap = bridge.getSnapshot();
      const taskId = (snap?.data?.tasks as any[])[0].id;

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

  describe("computed.canCreate", () => {
    it("should be true when not creating", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.canCreate"]).toBe(true);
    });
  });

  describe("computed.canDelete", () => {
    it("should be false with no selection", () => {
      const snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.canDelete"]).toBe(false);
    });

    it("should be true after selecting a task", async () => {
      await bridge.dispatch(
        {
          type: "createTask",
          input: {
            title: "Deletable",
            description: "",
            priority: "low",
            dueDate: null,
            tags: [],
          },
        },
        undefined,
        assistantActor
      );

      let snap = bridge.getSnapshot();
      const taskId = (snap?.data?.tasks as any[])[0].id;

      await bridge.dispatch(
        {
          type: "selectTask",
          input: { taskId },
        },
        undefined,
        userActor
      );

      snap = bridge.getSnapshot();
      expect(snap?.computed?.["computed.canDelete"]).toBe(true);
    });
  });
});

describe("TaskFlow Priority Values", () => {
  let bridge: Bridge;

  beforeEach(async () => {
    const schema = TasksDomain as unknown as DomainSchema;
    const host = createHost(schema, { initialData: createInitialData() });
    const world = createManifestoWorld({
      schemaHash: schema.hash,
      host: host as any,
    });

    world.registerActor(userActor, { mode: "auto_approve" });
    world.registerActor(assistantActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot!);

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

  it("should accept low priority", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "Low Priority",
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
    expect((snap?.data?.tasks as any[])[0].priority).toBe("low");
  });

  it("should accept medium priority", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "Medium Priority",
          description: "",
          priority: "medium",
          dueDate: null,
          tags: [],
        },
      },
      undefined,
      assistantActor
    );

    const snap = bridge.getSnapshot();
    expect((snap?.data?.tasks as any[])[0].priority).toBe("medium");
  });

  it("should accept high priority", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "High Priority",
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
    expect((snap?.data?.tasks as any[])[0].priority).toBe("high");
  });
});

describe("TaskFlow Status Values", () => {
  let bridge: Bridge;
  let taskId: string;

  beforeEach(async () => {
    const schema = TasksDomain as unknown as DomainSchema;
    const host = createHost(schema, { initialData: createInitialData() });
    const world = createManifestoWorld({
      schemaHash: schema.hash,
      host: host as any,
    });

    world.registerActor(userActor, { mode: "auto_approve" });
    world.registerActor(assistantActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot!);

    bridge = createBridge({
      world,
      schemaHash: schema.hash,
      defaultActor: userActor,
      defaultProjectionId: "test:projection",
    });

    await bridge.refresh();

    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "Status Test",
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

  afterEach(() => {
    if (bridge && !bridge.isDisposed()) {
      bridge.dispose();
    }
  });

  it("should default to todo status", () => {
    const snap = bridge.getSnapshot();
    expect((snap?.data?.tasks as any[])[0].status).toBe("todo");
  });

  it("should transition to all valid statuses", async () => {
    const statuses = ["in-progress", "review", "done", "todo"];

    for (const status of statuses) {
      await bridge.dispatch(
        {
          type: "moveTask",
          input: { id: taskId, newStatus: status },
        },
        undefined,
        userActor
      );

      const snap = bridge.getSnapshot();
      const task = (snap?.data?.tasks as any[]).find((t) => t.id === taskId);
      expect(task.status).toBe(status);
    }
  });
});

describe("TaskFlow Tags", () => {
  let bridge: Bridge;

  beforeEach(async () => {
    const schema = TasksDomain as unknown as DomainSchema;
    const host = createHost(schema, { initialData: createInitialData() });
    const world = createManifestoWorld({
      schemaHash: schema.hash,
      host: host as any,
    });

    world.registerActor(userActor, { mode: "auto_approve" });
    world.registerActor(assistantActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot!);

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

  it("should create task with empty tags", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "No Tags",
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
    expect((snap?.data?.tasks as any[])[0].tags).toEqual([]);
  });

  it("should create task with multiple tags", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "Multiple Tags",
          description: "",
          priority: "low",
          dueDate: null,
          tags: ["frontend", "urgent", "bug"],
        },
      },
      undefined,
      assistantActor
    );

    const snap = bridge.getSnapshot();
    const task = (snap?.data?.tasks as any[])[0];
    expect(task.tags).toContain("frontend");
    expect(task.tags).toContain("urgent");
    expect(task.tags).toContain("bug");
    expect(task.tags).toHaveLength(3);
  });
});

describe("TaskFlow DueDate", () => {
  let bridge: Bridge;

  beforeEach(async () => {
    const schema = TasksDomain as unknown as DomainSchema;
    const host = createHost(schema, { initialData: createInitialData() });
    const world = createManifestoWorld({
      schemaHash: schema.hash,
      host: host as any,
    });

    world.registerActor(userActor, { mode: "auto_approve" });
    world.registerActor(assistantActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot!);

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

  it("should create task with null dueDate", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "No Due Date",
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
    expect((snap?.data?.tasks as any[])[0].dueDate).toBeNull();
  });

  it("should create task with specific dueDate", async () => {
    await bridge.dispatch(
      {
        type: "createTask",
        input: {
          title: "Has Due Date",
          description: "",
          priority: "low",
          dueDate: "2026-02-15",
          tags: [],
        },
      },
      undefined,
      assistantActor
    );

    const snap = bridge.getSnapshot();
    expect((snap?.data?.tasks as any[])[0].dueDate).toBe("2026-02-15");
  });
});
