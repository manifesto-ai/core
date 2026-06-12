import { describe, expect, it } from "vitest";

import * as provider from "../provider.js";

/**
 * Regression test for #491: the dist types declared
 * createLineageRuntimeInstance but no JS entrypoint exported it, so
 * TypeScript resolved the import and Node failed at runtime with
 * ERR_MODULE_NOT_FOUND. The provider seam must export it (mirroring
 * createBaseRuntimeInstance on the SDK provider seam).
 */
describe("@manifesto-ai/lineage/provider exports (#491)", () => {
  it("exports createLineageRuntimeInstance as a function", () => {
    expect(typeof provider.createLineageRuntimeInstance).toBe("function");
  });

  it("keeps the established provider seam surface", () => {
    for (const name of [
      "attachLineageDecoration",
      "createLineageRuntimeController",
      "getLineageDecoration",
      "createLineageService",
      "createInMemoryLineageStore",
    ]) {
      expect(typeof provider[name as keyof typeof provider]).toBe("function");
    }
  });
});
