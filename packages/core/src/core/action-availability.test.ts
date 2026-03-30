import { describe, expect, it } from "vitest";

import { createCore, createSnapshot, getAvailableActions, isActionAvailable } from "../index.js";
import type { DomainSchema } from "../schema/domain.js";
import { hashSchemaSync } from "../utils/hash.js";

const HOST_CONTEXT = { now: 123, randomSeed: "seed" };

function createTestSchema(options: { includeInvalid?: boolean } = {}): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:action-availability-test",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        balance: { type: "number", required: true, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: {
      withdraw: {
        available: {
          kind: "gt",
          left: { kind: "get", path: "balance" },
          right: { kind: "lit", value: 0 },
        },
        flow: { kind: "halt", reason: "withdraw" },
      },
      deposit: {
        flow: { kind: "halt", reason: "deposit" },
      },
      ...(options.includeInvalid
        ? {
            invalid: {
              available: { kind: "lit", value: "not-a-boolean" },
              flow: { kind: "halt", reason: "invalid" },
            },
          }
        : {}),
    },
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

function createTestSnapshot(
  schemaHash: string,
  balance: number,
  currentAction: string | null = null
) {
  const snapshot = createSnapshot({ balance }, schemaHash, HOST_CONTEXT);
  if (currentAction === null) {
    return snapshot;
  }

  return {
    ...snapshot,
    system: {
      ...snapshot.system,
      currentAction,
    },
  };
}

describe("action availability query", () => {
  it("returns true when action has no availability clause", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 0);

    expect(isActionAvailable(schema, snapshot, "deposit")).toBe(true);
  });

  it("returns false when availability evaluates to false", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 0);

    expect(isActionAvailable(schema, snapshot, "withdraw")).toBe(false);
  });

  it("throws when action is missing", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 1);

    expect(() => isActionAvailable(schema, snapshot, "missing")).toThrow("Unknown action: missing");
  });

  it("throws when availability does not evaluate to boolean", () => {
    const schema = createTestSchema({ includeInvalid: true });
    const snapshot = createTestSnapshot(schema.hash, 1);

    expect(() => isActionAvailable(schema, snapshot, "invalid")).toThrow(
      "Availability condition must return boolean"
    );
  });

  it("returns available actions in schema key order", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 5);

    expect(getAvailableActions(schema, snapshot)).toEqual(["withdraw", "deposit"]);
  });

  it("ignores currentAction and answers for a new invocation", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 0, "withdraw");

    expect(isActionAvailable(schema, snapshot, "withdraw")).toBe(false);
  });

  it("is exposed through createCore()", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 5);
    const core = createCore();

    expect(core.isActionAvailable(schema, snapshot, "withdraw")).toBe(true);
    expect(core.getAvailableActions(schema, snapshot)).toEqual(["withdraw", "deposit"]);
  });
});
