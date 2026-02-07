import { describe, it, expect } from "vitest";
import { extractDefaults } from "../schema/defaults.js";
import type { StateSpec } from "../schema/field.js";

describe("extractDefaults", () => {
  it("returns empty object for empty fields", () => {
    const stateSpec: StateSpec = { fields: {} };
    expect(extractDefaults(stateSpec)).toEqual({});
  });

  it("extracts fields with defaults", () => {
    const stateSpec: StateSpec = {
      fields: {
        count: { type: "number", required: true, default: 0 },
        name: { type: "string", required: true, default: "untitled" },
      },
    };
    expect(extractDefaults(stateSpec)).toEqual({
      count: 0,
      name: "untitled",
    });
  });

  it("skips fields without defaults", () => {
    const stateSpec: StateSpec = {
      fields: {
        title: { type: "string", required: true },
        count: { type: "number", required: true, default: 0 },
      },
    };
    expect(extractDefaults(stateSpec)).toEqual({ count: 0 });
  });

  it("handles mixed fields with and without defaults", () => {
    const stateSpec: StateSpec = {
      fields: {
        status: { type: "string", required: true, default: "idle" },
        user: { type: "object", required: false },
        items: { type: "array", required: true, default: [] },
      },
    };
    expect(extractDefaults(stateSpec)).toEqual({
      status: "idle",
      items: [],
    });
  });

  it("preserves complex default values (objects, arrays)", () => {
    const stateSpec: StateSpec = {
      fields: {
        config: {
          type: "object",
          required: true,
          default: { theme: "dark", lang: "en" },
        },
        tags: {
          type: "array",
          required: true,
          default: ["a", "b"],
        },
      },
    };
    expect(extractDefaults(stateSpec)).toEqual({
      config: { theme: "dark", lang: "en" },
      tags: ["a", "b"],
    });
  });

  it("is deterministic — same input produces same output", () => {
    const stateSpec: StateSpec = {
      fields: {
        count: { type: "number", required: true, default: 0 },
        name: { type: "string", required: true, default: "test" },
      },
    };
    const result1 = extractDefaults(stateSpec);
    const result2 = extractDefaults(stateSpec);
    expect(result1).toEqual(result2);
  });
});
