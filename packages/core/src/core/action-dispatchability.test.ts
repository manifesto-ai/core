import { describe, expect, it } from "vitest";

import {
  createCore,
  createIntent,
  createSnapshot,
  isIntentDispatchable,
} from "../index.js";
import type { DomainSchema } from "../schema/domain.js";
import { hashSchemaSync } from "../utils/hash.js";

const HOST_CONTEXT = { now: 123, randomSeed: "seed" };

function createTestSchema(
  options: { includeInvalid?: boolean; includeUnavailableInvalid?: boolean } = {},
): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:action-dispatchability-test",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        balance: { type: "number", required: true, default: 0 },
        enabled: { type: "boolean", required: true, default: true },
        amount: { type: "number", required: true, default: 999 },
      },
    },
    computed: {
      fields: {
        positiveBalance: {
          deps: ["balance"],
          expr: {
            kind: "gt",
            left: { kind: "get", path: "balance" },
            right: { kind: "lit", value: 0 },
          },
        },
      },
    },
    actions: {
      withdraw: {
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        available: {
          kind: "get",
          path: "enabled",
        },
        dispatchable: {
          kind: "gte",
          left: { kind: "get", path: "balance" },
          right: { kind: "get", path: "input.amount" },
        },
        flow: { kind: "halt", reason: "withdraw" },
      },
      shadowed: {
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        dispatchable: {
          kind: "lt",
          left: { kind: "get", path: "input.amount" },
          right: { kind: "lit", value: 5 },
        },
        flow: { kind: "halt", reason: "shadowed" },
      },
      free: {
        flow: { kind: "halt", reason: "free" },
      },
      ...(options.includeInvalid
        ? {
            invalid: {
              dispatchable: { kind: "lit", value: "not-a-boolean" },
              flow: { kind: "halt", reason: "invalid" },
            },
          }
        : {}),
      ...(options.includeUnavailableInvalid
        ? {
            unavailableInvalid: {
              available: { kind: "lit", value: false },
              dispatchable: { kind: "lit", value: "not-a-boolean" },
              flow: { kind: "halt", reason: "unavailableInvalid" },
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

function createTestSnapshot(schemaHash: string, balance: number, enabled: boolean = true) {
  return createSnapshot({ balance, enabled, amount: 999 }, schemaHash, HOST_CONTEXT);
}

describe("intent dispatchability query", () => {
  it("returns true when dispatchable is absent and action is available", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 0);

    expect(isIntentDispatchable(schema, snapshot, createIntent("free", "intent-1"))).toBe(true);
  });

  it("returns false when the action is unavailable without evaluating dispatchable", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 10, false);

    expect(
      isIntentDispatchable(schema, snapshot, createIntent("withdraw", { amount: 1 }, "intent-1"))
    ).toBe(false);
  });

  it("short-circuits invalid dispatchability when availability is already false", () => {
    const schema = createTestSchema({ includeUnavailableInvalid: true });
    const snapshot = createTestSnapshot(schema.hash, 10);

    expect(
      isIntentDispatchable(
        schema,
        snapshot,
        createIntent("unavailableInvalid", "intent-1"),
      ),
    ).toBe(false);
  });

  it("evaluates dispatchable against bound input", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 10);

    expect(
      isIntentDispatchable(schema, snapshot, createIntent("withdraw", { amount: 5 }, "intent-1"))
    ).toBe(true);
    expect(
      isIntentDispatchable(schema, snapshot, createIntent("withdraw", { amount: 15 }, "intent-2"))
    ).toBe(false);
  });

  it("uses bound input even when a state field has the same name", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 10);

    expect(
      isIntentDispatchable(schema, snapshot, createIntent("shadowed", { amount: 4 }, "intent-1"))
    ).toBe(true);
    expect(
      isIntentDispatchable(schema, snapshot, createIntent("shadowed", { amount: 8 }, "intent-2"))
    ).toBe(false);
  });

  it("throws when dispatchability does not evaluate to boolean", () => {
    const schema = createTestSchema({ includeInvalid: true });
    const snapshot = createTestSnapshot(schema.hash, 10);

    expect(
      () => isIntentDispatchable(schema, snapshot, createIntent("invalid", "intent-1"))
    ).toThrow("Dispatchability condition must return boolean");
  });

  it("is exposed through createCore()", () => {
    const schema = createTestSchema();
    const snapshot = createTestSnapshot(schema.hash, 10);
    const core = createCore();

    expect(
      core.isIntentDispatchable(schema, snapshot, createIntent("withdraw", { amount: 5 }, "intent-1"))
    ).toBe(true);
  });
});
