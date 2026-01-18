import { describe, it, expect } from "vitest";
import { intentResult } from "./projection.js";

describe("intentResult", () => {
  it("freezes the intent body", () => {
    const body = { type: "test-action", input: { count: 1 } };
    const result = intentResult(body);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.body)).toBe(true);
    expect(Object.isFrozen(result.body.input as object)).toBe(true);
  });
});
