import { describe, it, expect } from "vitest";
import { toPatch, toPatches } from "./patch.js";

describe("toPatch", () => {
  it("should create a set patch by default", () => {
    const patch = toPatch("data.user", { name: "Alice" });
    expect(patch).toEqual({
      op: "set",
      path: "data.user",
      value: { name: "Alice" },
    });
  });

  it("should create an unset patch", () => {
    const patch = toPatch("data.temp", undefined, "unset");
    expect(patch).toEqual({
      op: "unset",
      path: "data.temp",
    });
  });

  it("should create a merge patch", () => {
    const patch = toPatch("data.settings", { theme: "dark" }, "merge");
    expect(patch).toEqual({
      op: "merge",
      path: "data.settings",
      value: { theme: "dark" },
    });
  });
});

describe("toPatches", () => {
  it("should create multiple set patches", () => {
    const patches = toPatches({
      "data.user": { name: "Alice" },
      "data.status": "ready",
    });

    expect(patches).toHaveLength(2);
    expect(patches).toContainEqual({
      op: "set",
      path: "data.user",
      value: { name: "Alice" },
    });
    expect(patches).toContainEqual({
      op: "set",
      path: "data.status",
      value: "ready",
    });
  });

  it("should create merge patches when specified", () => {
    const patches = toPatches(
      {
        "data.settings": { theme: "dark" },
      },
      "merge"
    );

    expect(patches[0]).toEqual({
      op: "merge",
      path: "data.settings",
      value: { theme: "dark" },
    });
  });

  it("should handle empty mappings", () => {
    const patches = toPatches({});
    expect(patches).toEqual([]);
  });
});
