import { describe, expect, it } from "vitest";
import { createInitialAppState } from "../../../state/index.js";

describe("Runtime bootstrap compliance", () => {
  it("RT-LC-3: genesis state materializes defaults and merges initialData", () => {
    const schemaHash = "schema-rc-3";
    const schemaDefaults = {
      count: 0,
      status: "idle",
      nested: { mode: "default" },
    };
    const initialData = {
      status: "custom",
      name: "runtime-user",
    };

    const state = createInitialAppState(schemaHash, initialData, schemaDefaults);

    expect(state.data).toEqual({
      count: 0,
      status: "custom",
      nested: { mode: "default" },
      name: "runtime-user",
    });
    expect(state.system.status).toBe("idle");
    expect(state.meta.schemaHash).toBe(schemaHash);
  });
});
