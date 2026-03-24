import { describe, it, expect } from "vitest";
import {
  type DomainSchema,
  type Patch,
  hashSchemaSync,
  semanticPathToPatchPath,
} from "@manifesto-ai/core";
import { createManifesto } from "../index.js";

const pp = semanticPathToPatchPath;

/**
 * F-012 (#248): Verify ManifestoConfig.effects is properly wired.
 *
 * Confirms that effect handlers passed via createManifesto({ effects })
 * are registered and executed when the compute loop emits a requirement.
 */

function createSchemaWithEffect(effectType: string): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:effect-test",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        $host: { type: "object", required: false, default: {} },
        $mel: {
          type: "object",
          required: false,
          default: { guards: { intent: {} } },
          fields: {
            guards: {
              type: "object",
              required: false,
              default: { intent: {} },
              fields: {
                intent: { type: "object", required: false, default: {} },
              },
            },
          },
        },
        response: { type: "object", required: false, default: null },
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: { fields: {} },
    actions: {
      fetchData: {
        flow: {
          kind: "if",
          cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
          then: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("status"),
                value: { kind: "lit", value: "loading" },
              },
              {
                kind: "effect",
                type: effectType,
                params: { url: { kind: "lit", value: "https://api.test.com" } },
              },
            ],
          },
        },
      },
    },
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

describe("effects wiring via ManifestoConfig (F-012)", () => {
  it("executes effect handler registered through config.effects", async () => {
    const schema = createSchemaWithEffect("api.fetch");
    let effectCalled = false;

    const instance = createManifesto({
      schema,
      effects: {
        "api.fetch": async (): Promise<Patch[]> => {
          effectCalled = true;
          return [
            { op: "set", path: pp("response"), value: { data: "ok" } },
            { op: "set", path: pp("status"), value: "done" },
          ];
        },
      },
    });

    try {
      instance.dispatch({ type: "fetchData", intentId: "test-fetch-1" });
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(effectCalled).toBe(true);

      const snap = instance.getSnapshot();
      const data = snap.data as Record<string, unknown>;
      expect(data.status).toBe("done");
      expect(data.response).toEqual({ data: "ok" });
    } finally {
      instance.dispose();
    }
  });

  it("passes params to effect handler", async () => {
    const schema = createSchemaWithEffect("api.fetch");
    let receivedParams: unknown = null;

    const instance = createManifesto({
      schema,
      effects: {
        "api.fetch": async (params): Promise<Patch[]> => {
          receivedParams = params;
          return [
            { op: "set", path: pp("response"), value: { data: "ok" } },
          ];
        },
      },
    });

    try {
      instance.dispatch({ type: "fetchData", intentId: "test-params-1" });
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(receivedParams).not.toBeNull();
      expect((receivedParams as Record<string, unknown>).url).toBe("https://api.test.com");
    } finally {
      instance.dispose();
    }
  });

  it("provides snapshot in effect context", async () => {
    const schema = createSchemaWithEffect("api.fetch");
    let ctxSnapshotData: unknown = null;

    const instance = createManifesto({
      schema,
      effects: {
        "api.fetch": async (_params, ctx): Promise<Patch[]> => {
          ctxSnapshotData = ctx.snapshot.data;
          return [
            { op: "set", path: pp("response"), value: { data: "ok" } },
          ];
        },
      },
    });

    try {
      instance.dispatch({ type: "fetchData", intentId: "test-ctx-1" });
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(ctxSnapshotData).not.toBeNull();
      // Effect sees the snapshot AFTER the patch (status = "loading")
      expect((ctxSnapshotData as Record<string, unknown>).status).toBe("loading");
    } finally {
      instance.dispose();
    }
  });
});
