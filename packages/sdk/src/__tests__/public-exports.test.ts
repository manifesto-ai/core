import { describe, expect, it } from "vitest";

import * as sdk from "../index.js";

describe("SDK public runtime exports", () => {
  it("exposes the v3 hard-cut runtime surface", () => {
    expect(sdk.createManifesto).toBeDefined();
    expect(sdk.createSnapshot).toBeDefined();
    expect(sdk.ManifestoError).toBeDefined();
    expect(sdk.CompileError).toBeDefined();
    expect(sdk.DisposedError).toBeDefined();
    expect(sdk.AlreadyActivatedError).toBeDefined();
    expect(sdk.ReservedEffectError).toBeDefined();
  });

  it("does not expose removed v2 helpers", () => {
    expect("dispatchAsync" in sdk).toBe(false);
    expect("DispatchRejectedError" in sdk).toBe(false);
    expect("defineOps" in sdk).toBe(false);
    expect("createWorld" in sdk).toBe(false);
    expect("createIntent" in sdk).toBe(false);
  });
});
