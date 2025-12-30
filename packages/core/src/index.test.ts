import { describe, it, expect } from "vitest";
import { createCore } from "./index.js";

describe("core", () => {
  it("should create a ManifestoCore instance", () => {
    const core = createCore();
    expect(core).toBeDefined();
    expect(core.compute).toBeInstanceOf(Function);
    expect(core.apply).toBeInstanceOf(Function);
    expect(core.validate).toBeInstanceOf(Function);
    expect(core.explain).toBeInstanceOf(Function);
  });
});
