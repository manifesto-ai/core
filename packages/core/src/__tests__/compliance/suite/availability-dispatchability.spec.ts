import { describe, expect, it } from "vitest";
import {
  getAvailableActions,
  isActionAvailable,
  isIntentDispatchable,
} from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  caseTitle,
  cloneJson,
  createComplianceIntent,
  createComplianceSchema,
  createComplianceSnapshot,
} from "./helpers.js";

describe("Core CTS availability and dispatchability queries", () => {
  it(caseTitle(CORE_CTS_CASES.ACTION_QUERIES, "evaluates action availability as a pure current-snapshot query"), () => {
    const schema = createComplianceSchema({
      actions: {
        withdraw: {
          available: { kind: "get", path: "enabled" },
          flow: { kind: "halt", reason: "withdraw" },
        },
        deposit: {
          flow: { kind: "halt", reason: "deposit" },
        },
      },
    });
    const snapshot = {
      ...createComplianceSnapshot({ enabled: false }, schema.hash),
      system: {
        ...createComplianceSnapshot({ enabled: false }, schema.hash).system,
        currentAction: "withdraw",
      },
    };
    const before = cloneJson(snapshot);

    expect(isActionAvailable(schema, snapshot, "deposit")).toBe(true);
    expect(isActionAvailable(schema, snapshot, "withdraw")).toBe(false);
    expect(getAvailableActions(schema, snapshot)).toEqual(["noop", "deposit"]);
    expect(() => isActionAvailable(schema, snapshot, "missing")).toThrow("Unknown action: missing");
    expect(snapshot).toEqual(before);

    const invalidSchema = createComplianceSchema({
      actions: {
        invalidAvailability: {
          available: { kind: "lit", value: "yes" },
          flow: { kind: "halt", reason: "invalid" },
        },
      },
    });
    const invalidSnapshot = createComplianceSnapshot({}, invalidSchema.hash);
    expect(() => isActionAvailable(invalidSchema, invalidSnapshot, "invalidAvailability")).toThrow("Availability condition must return boolean");
  });

  it(caseTitle(CORE_CTS_CASES.ACTION_QUERIES, "evaluates dispatchability against bound intent input and short-circuits unavailable actions"), () => {
    const schema = createComplianceSchema({
      actions: {
        withdraw: {
          input: {
            type: "object",
            required: true,
            fields: {
              amount: { type: "number", required: true },
            },
          },
          available: { kind: "get", path: "enabled" },
          dispatchable: {
            kind: "gte",
            left: { kind: "get", path: "balance" },
            right: { kind: "get", path: "input.amount" },
          },
          flow: { kind: "halt", reason: "withdraw" },
        },
        free: {
          flow: { kind: "halt", reason: "free" },
        },
        unavailableInvalid: {
          available: { kind: "lit", value: false },
          dispatchable: { kind: "lit", value: "bad" },
          flow: { kind: "halt", reason: "unavailableInvalid" },
        },
        invalidDispatchability: {
          dispatchable: { kind: "lit", value: "bad" },
          flow: { kind: "halt", reason: "invalid" },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ enabled: true, balance: 10 }, schema.hash);
    const before = cloneJson(snapshot);

    expect(isIntentDispatchable(schema, snapshot, createComplianceIntent("free"))).toBe(true);
    expect(isIntentDispatchable(schema, snapshot, createComplianceIntent("withdraw", { amount: 5 }))).toBe(true);
    expect(isIntentDispatchable(schema, snapshot, createComplianceIntent("withdraw", { amount: 15 }))).toBe(false);
    expect(isIntentDispatchable(schema, snapshot, createComplianceIntent("unavailableInvalid"))).toBe(false);
    expect(() => isIntentDispatchable(schema, snapshot, createComplianceIntent("missing"))).toThrow("Unknown action: missing");
    expect(() => isIntentDispatchable(schema, snapshot, createComplianceIntent("invalidDispatchability"))).toThrow("Dispatchability condition must return boolean");
    expect(snapshot).toEqual(before);
  });
});
