import { describe, expect, it } from "vitest";
import { sha256 } from "@manifesto-ai/core";
import type { IntentBody } from "./types.js";
import { computeIntentKey } from "./intent-instance.js";

async function expectedKey(
  schemaHash: string,
  bodyType: string,
  inputJcs: string,
  scopeJcs: string
): Promise<string> {
  return sha256(`${schemaHash}:${bodyType}:${inputJcs}:${scopeJcs}`);
}

describe("computeIntentKey", () => {
  it("uses JCS for input and scopeProposal", async () => {
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

    await expect(computeIntentKey(schemaHash, body)).resolves.toBe(expected);
  });

  it("treats missing input and scopeProposal as null", async () => {
    const schemaHash = "schema-hash";
    const body: IntentBody = { type: "todo.clear" };

    const expected = await expectedKey(schemaHash, body.type, "null", "null");
    await expect(computeIntentKey(schemaHash, body)).resolves.toBe(expected);
  });

  it("normalizes non-finite numbers to null", async () => {
    const schemaHash = "schema-hash";
    const body: IntentBody = {
      type: "stats.update",
      input: { values: [1, NaN, Infinity, -Infinity] },
    };

    const inputJcs = "{\"values\":[1,null,null,null]}";
    const expected = await expectedKey(schemaHash, body.type, inputJcs, "null");
    await expect(computeIntentKey(schemaHash, body)).resolves.toBe(expected);
  });
});
