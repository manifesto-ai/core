import { describe, expect, it } from "vitest";
import { apply } from "../core/apply.js";
import { compute } from "../core/compute.js";
import { applySystemDelta } from "../core/system-delta.js";
import { createIntent, createSnapshot } from "../factories.js";
import type { DomainSchema } from "../schema/domain.js";
import type { Requirement } from "../schema/snapshot.js";
import { patchPathToDisplayString, semanticPathToPatchPath } from "../utils/patch-path.js";

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };
const pp = (path: string) => semanticPathToPatchPath(path);

function createSchema(stateFields: DomainSchema["state"]["fields"], actions: DomainSchema["actions"]): DomainSchema {
  return {
    id: "manifesto:test",
    version: "1.0.0",
    hash: "test-hash",
    types: {},
    state: { fields: stateFields },
    computed: { fields: {} },
    actions,
  };
}

describe("ADR-009 core acceptance", () => {
  it("ADR §9.1: supports composite path segments and display format", () => {
    expect(patchPathToDisplayString([
      { kind: "prop", name: "todos" },
      { kind: "index", index: 0 },
      { kind: "prop", name: "title" },
    ])).toBe("todos[0].title");

    const schema = createSchema(
      {
        history: {
          type: "object",
          required: true,
          fields: {
            files: {
              type: "object",
              required: true,
              fields: {
                "file:///proof.lean": { type: "string", required: false },
              },
            },
          },
        },
      },
      { noop: { flow: { kind: "halt", reason: "noop" } } }
    );

    const snapshot = createSnapshot({ history: { files: {} } }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: [{ kind: "prop", name: "history" }, { kind: "prop", name: "files" }, { kind: "prop", name: "file:///proof.lean" }], value: "ok" }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({
      history: {
        files: {
          "file:///proof.lean": "ok",
        },
      },
    });
  });

  it("ADR §9.5: allows dotted/URI keys and blocks prototype pollution", () => {
    const schema = createSchema(
      {
        history: {
          type: "object",
          required: true,
          fields: {
            files: {
              type: "object",
              required: true,
              fields: {
                "TACTIC_FAILED:simp": { type: "string", required: false },
              },
            },
          },
        },
      },
      { noop: { flow: { kind: "halt", reason: "noop" } } }
    );

    const snapshot = createSnapshot({ history: { files: {} } }, schema.hash, HOST_CONTEXT);
    const dottedResult = apply(
      schema,
      snapshot,
      [{ op: "set", path: pp("history.files.TACTIC_FAILED:simp"), value: "safe" }],
      HOST_CONTEXT
    );

    expect(dottedResult.data).toEqual({ history: { files: { "TACTIC_FAILED:simp": "safe" } } });

    const polluted = apply(
      schema,
      snapshot,
      [{ op: "set", path: [{ kind: "prop", name: "__proto__" }, { kind: "prop", name: "polluted" }], value: true }],
      HOST_CONTEXT
    );

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(polluted.system.status).toBe("error");
    expect(polluted.system.lastError?.code).toBe("PATH_NOT_FOUND");
  });

  it("ADR §9.6: bypasses schema-walk for $host/$mel roots", () => {
    const schema = createSchema(
      {
        count: { type: "number", required: true },
      },
      { noop: { flow: { kind: "halt", reason: "noop" } } }
    );

    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: pp("$host.runtime"), value: { marker: "ok" } }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({
      count: 1,
      $host: {
        runtime: {
          marker: "ok",
        },
      },
    });
    expect(result.system.status).toBe("idle");
  });

  it("ADR §9.7: applies patch path at snapshot.data root, not snapshot.system", () => {
    const schema = createSchema(
      {
        system: {
          type: "object",
          required: true,
          fields: {
            status: { type: "string", required: true },
          },
        },
      },
      { noop: { flow: { kind: "halt", reason: "noop" } } }
    );

    const snapshot = createSnapshot({ system: { status: "domain-idle" } }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: pp("system.status"), value: "domain-updated" }],
      HOST_CONTEXT
    );

    expect((result.data as { system: { status: string } }).system.status).toBe("domain-updated");
    expect(result.system.status).toBe("idle");
  });

  it("compute returns patches + systemDelta (no snapshot in result)", async () => {
    const schema = createSchema(
      {
        count: { type: "number", required: true },
      },
      {
        increment: {
          flow: {
            kind: "patch",
            op: "set",
            path: pp("count"),
            value: {
              kind: "add",
              left: { kind: "get", path: "count" },
              right: { kind: "lit", value: 1 },
            },
          },
        },
      }
    );

    const snapshot = createSnapshot({ count: 0 }, schema.hash, HOST_CONTEXT);
    const intent = createIntent("increment", "intent-1");

    const result = await compute(schema, snapshot, intent, HOST_CONTEXT);

    expect(result.patches).toHaveLength(1);
    expect(result.systemDelta).toEqual({
      status: "idle",
      currentAction: null,
      lastError: null,
      appendErrors: [],
      addRequirements: [],
      removeRequirementIds: [],
    });
    expect("snapshot" in result).toBe(false);

    const withPatches = apply(schema, snapshot, result.patches, HOST_CONTEXT);
    const finalSnapshot = applySystemDelta(withPatches, result.systemDelta);
    expect(finalSnapshot.data).toEqual({ count: 1 });
  });

  it("applySystemDelta is deterministic and applies remove->add ordering", () => {
    const schema = createSchema(
      {
        count: { type: "number", required: true },
      },
      { noop: { flow: { kind: "halt", reason: "noop" } } }
    );

    const requirementA: Requirement = {
      id: "req-a",
      type: "io.http",
      params: { url: "a" },
      actionId: "act",
      flowPosition: { nodePath: "actions.act.flow", snapshotVersion: 0 },
      createdAt: 1,
    };
    const requirementB: Requirement = {
      id: "req-b",
      type: "io.http",
      params: { url: "b" },
      actionId: "act",
      flowPosition: { nodePath: "actions.act.flow", snapshotVersion: 0 },
      createdAt: 1,
    };

    const snapshot = {
      ...createSnapshot({ count: 0 }, schema.hash, HOST_CONTEXT),
      system: {
        ...createSnapshot({ count: 0 }, schema.hash, HOST_CONTEXT).system,
        pendingRequirements: [requirementA, requirementB],
      },
    };

    const delta = {
      appendErrors: [],
      status: "pending" as const,
      currentAction: "act",
      lastError: null,
      removeRequirementIds: ["req-a"],
      addRequirements: [{ ...requirementA, params: { url: "a2" } }],
    };

    const result1 = applySystemDelta(snapshot, delta);
    const result2 = applySystemDelta(snapshot, delta);

    expect(result1).toEqual(result2);
    expect(result1.system.pendingRequirements.map((requirement) => requirement.id)).toEqual(["req-b", "req-a"]);
    expect(result1.meta.version).toBe(snapshot.meta.version + 1);
  });

  it("applySystemDelta treats explicit null as a state change", () => {
    const schema = createSchema(
      { count: { type: "number", required: true } },
      { noop: { flow: { kind: "halt", reason: "noop" } } }
    );

    const base = createSnapshot({ count: 0 }, schema.hash, HOST_CONTEXT);
    const snapshot = {
      ...base,
      system: {
        ...base.system,
        status: "pending" as const,
        currentAction: "run",
        lastError: {
          code: "E",
          message: "err",
          source: { actionId: "run", nodePath: "actions.run.flow" },
          timestamp: 1,
        },
      },
    };

    const result = applySystemDelta(snapshot, {
      status: "idle",
      currentAction: null,
      lastError: null,
      appendErrors: [],
      addRequirements: [],
      removeRequirementIds: [],
    });

    expect(result.system.currentAction).toBeNull();
    expect(result.system.lastError).toBeNull();
    expect(result.system.status).toBe("idle");
    expect(result.meta.version).toBe(snapshot.meta.version + 1);
  });
});
