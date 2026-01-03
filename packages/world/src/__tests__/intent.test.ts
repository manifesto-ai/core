import { describe, it, expect } from "vitest";
import type { IntentBody } from "../schema/intent.js";
import { computeIntentKey } from "../schema/intent.js";
import { sha256 } from "@manifesto-ai/core";

async function expectedKey(
  schemaHash: string,
  bodyType: string,
  inputJcs: string,
  scopeJcs: string
): Promise<string> {
  return sha256(`${schemaHash}:${bodyType}:${inputJcs}:${scopeJcs}`);
}

describe("computeIntentKey", () => {
  it("should use JCS for input and scopeProposal", async () => {
    const schemaHash = "schema-hash";
    const body: IntentBody = {
      type: "todo.create",
      input: { b: 2, a: 1, c: undefined },
      scopeProposal: {
        note: "create todo",
        allowedPaths: ["data.todos.*"],
      },
    };

    const inputJcs = "{\"a\":1,\"b\":2}";
    const scopeJcs = "{\"allowedPaths\":[\"data.todos.*\"],\"note\":\"create todo\"}";
    const expected = await expectedKey(schemaHash, body.type, inputJcs, scopeJcs);

    const result = await computeIntentKey(schemaHash, body);

    expect(result).toBe(expected);
  });

  it("should treat missing input and scopeProposal as null", async () => {
    const schemaHash = "schema-hash";
    const body: IntentBody = { type: "todo.clear" };

    const expected = await expectedKey(schemaHash, body.type, "null", "null");
    const result = await computeIntentKey(schemaHash, body);

    expect(result).toBe(expected);
  });

  it("should normalize non-finite numbers to null", async () => {
    const schemaHash = "schema-hash";
    const body: IntentBody = {
      type: "stats.update",
      input: { values: [1, NaN, Infinity, -Infinity] },
    };

    const inputJcs = "{\"values\":[1,null,null,null]}";
    const expected = await expectedKey(schemaHash, body.type, inputJcs, "null");
    const result = await computeIntentKey(schemaHash, body);

    expect(result).toBe(expected);
  });
});
