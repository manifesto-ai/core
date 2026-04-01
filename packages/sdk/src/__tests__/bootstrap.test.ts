import { describe, expect, it } from "vitest";

import type { SdkManifest } from "../index.js";

describe("SdkManifest", () => {
  it("reflects the v3 draft hard-cut contract", () => {
    const manifest: SdkManifest = {
      name: "@manifesto-ai/sdk",
      specVersion: "3.0.0",
      phase: "draft",
    };

    expect(manifest.specVersion).toBe("3.0.0");
    expect(manifest.phase).toBe("draft");
  });
});
