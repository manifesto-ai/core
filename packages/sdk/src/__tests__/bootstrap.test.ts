import { describe, it, expect } from "vitest";
import * as world from "@manifesto-ai/world";
import * as sdk from "../index.js";
import type { SdkManifest } from "../index.js";

describe("@manifesto-ai/sdk bootstrap", () => {
  it("SdkManifest type is importable and structurally correct", () => {
    const manifest: SdkManifest = {
      name: "@manifesto-ai/sdk",
      specVersion: "2.0.0",
      phase: "released",
    };

    expect(manifest.name).toBe("@manifesto-ai/sdk");
    expect(manifest.specVersion).toBe("2.0.0");
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

  it("re-exports only the thin governed world orchestration surface", () => {
    const removedLegacyStoreFactory = ["create", "Memory", "World", "Store"].join("");

    expect(sdk.createWorld).toBeDefined();
    expect(typeof sdk.createWorld).toBe("function");
    expect(sdk.createWorld).toBe(world.createWorld);
    expect((sdk as Record<string, unknown>).createInMemoryWorldStore).toBeUndefined();
    expect((sdk as Record<string, unknown>).createIndexedDbWorldStore).toBeUndefined();
    expect((sdk as Record<string, unknown>).createSqliteWorldStore).toBeUndefined();
    expect((sdk as Record<string, unknown>)[removedLegacyStoreFactory]).toBeUndefined();
    expect((sdk as Record<string, unknown>).createGovernanceService).toBeUndefined();
    expect((sdk as Record<string, unknown>).createLineageService).toBeUndefined();
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
