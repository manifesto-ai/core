import { describe, expect, it } from "vitest";
import { compile, type DomainSchema as MelDomainSchema } from "../../src/index.js";
import {
  createCore,
  createIntent,
  createSnapshot,
  type ComputeResult,
  type DomainSchema as CoreDomainSchema,
  type Snapshot,
} from "@manifesto-ai/core";

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };
let intentCounter = 0;

function adaptSchema(schema: MelDomainSchema): CoreDomainSchema {
  return schema as unknown as CoreDomainSchema;
}

function nextIntentId(): string {
  return `entity-intent-${intentCounter++}`;
}

function createTestIntent(type: string, input?: unknown) {
  return input === undefined
    ? createIntent(type, nextIntentId())
    : createIntent(type, input, nextIntentId());
}

function createTestSnapshot(data: unknown, schemaHash: string): Snapshot {
  return createSnapshot(data, schemaHash, HOST_CONTEXT);
}

function applyComputeResult(
  core: ReturnType<typeof createCore>,
  schema: CoreDomainSchema,
  snapshot: Snapshot,
  result: ComputeResult
): Snapshot {
  const patched = core.apply(schema, snapshot, result.patches, HOST_CONTEXT);
  const namespaced = core.applyNamespaceDeltas(
    patched,
    result.namespaceDelta ?? [],
    HOST_CONTEXT
  );
  return core.applySystemDelta(namespaced, result.systemDelta);
}

describe("Entity Primitive Core Integration", () => {
  it("updates matching entities by id", async () => {
    const result = compile(`
      domain Tasks {
        type Task = { id: string, title: string, done: boolean }
        state { tasks: Array<Task> = [] }
        action complete(id: string) {
          when true {
            patch tasks = updateById(tasks, id, { done: true })
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const schema = adaptSchema(result.schema);
    const core = createCore();
    const snapshot = createTestSnapshot(
      {
        tasks: [
          { id: "task-1", title: "A", done: false },
          { id: "task-2", title: "B", done: false },
        ],
      },
      schema.hash
    );

    const computeResult = await core.compute(
      schema,
      snapshot,
      createTestIntent("complete", { id: "task-2" }),
      HOST_CONTEXT
    );
    const nextSnapshot = applyComputeResult(core, schema, snapshot, computeResult);

    expect(nextSnapshot.state).toMatchObject({
      tasks: [
        { id: "task-1", title: "A", done: false },
        { id: "task-2", title: "B", done: true },
      ],
    });
  });

  it("removes all matching entities by id", async () => {
    const result = compile(`
      domain Tasks {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        action remove(id: string) {
          when true {
            patch tasks = removeById(tasks, id)
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const schema = adaptSchema(result.schema);
    const core = createCore();
    const snapshot = createTestSnapshot(
      {
        tasks: [
          { id: "task-1", title: "A" },
          { id: "task-1", title: "B" },
          { id: "task-2", title: "C" },
        ],
      },
      schema.hash
    );

    const computeResult = await core.compute(
      schema,
      snapshot,
      createTestIntent("remove", { id: "task-1" }),
      HOST_CONTEXT
    );
    const nextSnapshot = applyComputeResult(core, schema, snapshot, computeResult);

    expect(nextSnapshot.state).toMatchObject({
      tasks: [{ id: "task-2", title: "C" }],
    });
  });
});
