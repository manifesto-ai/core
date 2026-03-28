import { describe, it, expect } from "vitest";
import * as sdk from "../index.js";
import type {
  CommitCapableWorldStore,
  SdkManifest,
} from "../index.js";

describe("@manifesto-ai/sdk bootstrap", () => {
  it("SdkManifest type is importable and structurally correct", () => {
    const manifest: SdkManifest = {
      name: "@manifesto-ai/sdk",
      specVersion: "1.0.1",
      phase: "released",
    };

    expect(manifest.name).toBe("@manifesto-ai/sdk");
    expect(manifest.specVersion).toBe("1.0.1");
    expect(manifest.phase).toBe("released");
  });

  it("package entry point resolves without error", () => {
    expect(sdk).toBeDefined();
  });

  it("exports createManifesto as the SDK-owned factory", () => {
    expect(sdk.createManifesto).toBeDefined();
    expect(typeof sdk.createManifesto).toBe("function");
  });

  it("exports SDK error classes", () => {
    expect(sdk.ManifestoError).toBeDefined();
    expect(sdk.ReservedEffectError).toBeDefined();
    expect(sdk.DisposedError).toBeDefined();
  });

  it("exports typed-ops utility", () => {
    expect(sdk.defineOps).toBeDefined();
  });

  it("re-exports core factories", () => {
    expect(sdk.createIntent).toBeDefined();
    expect(sdk.createSnapshot).toBeDefined();
    expect(sdk.createCore).toBeDefined();
  });

  it("re-exports legacy and governed world store factories", () => {
    const governedStore: CommitCapableWorldStore = sdk.createInMemoryWorldStore();

    expect(sdk.createMemoryWorldStore).toBeDefined();
    expect(sdk.createInMemoryWorldStore).toBeDefined();
    expect(sdk.createWorld).toBeDefined();
    expect(typeof sdk.createWorld).toBe("function");
    expect(typeof governedStore.commitSeal).toBe("function");
  });

  it("does NOT export removed v0.x concepts", () => {
    const forbidden = [
      "createApp",
      "createTestApp",
      "ManifestoApp",
      "AppRefImpl",
      "HookableImpl",
      "JobQueue",
      "HookContextImpl",
      "createAppRef",
      "createHookContext",
    ];

    for (const key of forbidden) {
      expect((sdk as Record<string, unknown>)[key]).toBeUndefined();
    }
  });
});
