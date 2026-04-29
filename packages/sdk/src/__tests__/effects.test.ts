import { describe, expect, it } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";

import { createManifesto } from "../index.js";
import { defineEffects } from "../effects.js";

const pp = semanticPathToPatchPath;

type User = {
  id: string;
  name: string;
};

type EffectsDomain = {
  actions: {
    fetchUser: (id: string) => void;
    markRawHandled: () => void;
  };
  state: {
    user: User | null;
    loading: boolean;
    error: string | null;
    profile: {
      name?: string;
      source?: string;
    };
    rawHandled: boolean;
  };
  computed: {};
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createEffectsSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-effects-builder",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        user: {
          type: "object",
          required: false,
          default: null,
          fields: {
            id: { type: "string", required: true },
            name: { type: "string", required: true },
          },
        },
        loading: { type: "boolean", required: false, default: false },
        error: { type: "string", required: false, default: null },
        profile: {
          type: "object",
          required: false,
          default: {},
          fields: {
            name: { type: "string", required: false },
            source: { type: "string", required: false },
          },
        },
        rawHandled: { type: "boolean", required: false, default: false },
      },
    },
    computed: { fields: {} },
    actions: {
      fetchUser: {
        input: {
          type: "object",
          required: true,
          fields: {
            id: { type: "string", required: true },
          },
        },
        flow: {
          kind: "if",
          cond: {
            kind: "isNull",
            arg: { kind: "get", path: "user" },
          },
          then: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("loading"),
                value: { kind: "lit", value: true },
              },
              {
                kind: "patch",
                op: "set",
                path: pp("error"),
                value: { kind: "lit", value: "stale" },
              },
              {
                kind: "effect",
                type: "api.fetchUser",
                params: {
                  id: { kind: "get", path: "input.id" },
                },
              },
            ],
          },
          else: { kind: "halt", reason: "user-loaded" },
        },
      },
      markRawHandled: {
        flow: {
          kind: "if",
          cond: {
            kind: "not",
            arg: { kind: "get", path: "rawHandled" },
          },
          then: {
            kind: "effect",
            type: "api.raw",
            params: {},
          },
          else: { kind: "halt", reason: "raw-handled" },
        },
      },
    },
  });
}

describe("@manifesto-ai/sdk/effects", () => {
  it("lowers set, unset, and merge to concrete top-level patch paths in order", async () => {
    const user: User = { id: "123", name: "Ada" };
    const effects = defineEffects<EffectsDomain>(({ set, unset, merge }, MEL) => ({
      "api.fetchUser": async () => [
        set(MEL.state.user, user),
        set(MEL.state.loading, false),
        unset(MEL.state.error),
        merge(MEL.state.profile, { name: user.name, source: "api" }),
      ],
    }));

    const patches = await effects["api.fetchUser"](
      { id: "123" },
      {
        snapshot: {
          data: {
            user: null,
            loading: true,
            error: "stale",
            profile: {},
            rawHandled: false,
          },
          computed: {},
          system: {
            status: "pending",
            lastError: null,
          },
          meta: {
            schemaHash: "schema-hash",
          },
        },
      },
    );

    expect(patches).toEqual([
      {
        op: "set",
        path: [{ kind: "prop", name: "user" }],
        value: user,
      },
      {
        op: "set",
        path: [{ kind: "prop", name: "loading" }],
        value: false,
      },
      {
        op: "unset",
        path: [{ kind: "prop", name: "error" }],
      },
      {
        op: "merge",
        path: [{ kind: "prop", name: "profile" }],
        value: { name: "Ada", source: "api" },
      },
    ]);
  });

  it("integrates with createManifesto while preserving raw patch handlers inside defineEffects", async () => {
    const user: User = { id: "123", name: "Ada" };
    const app = createManifesto<EffectsDomain>(
      createEffectsSchema(),
      defineEffects<EffectsDomain>(({ set, unset, merge }, MEL) => ({
        "api.fetchUser": async (params) => {
          const { id } = params as { id: string };

          return [
            set(MEL.state.user, { ...user, id }),
            set(MEL.state.loading, false),
            unset(MEL.state.error),
            merge(MEL.state.profile, { name: user.name }),
          ];
        },
        "api.raw": async () => [{
          op: "set",
          path: pp("rawHandled"),
          value: true,
        }],
      })),
    ).activate();

    const loaded = await app.actions.fetchUser.submit("123");

    expect(loaded.ok && loaded.after.state.user).toEqual(user);
    expect(loaded.ok && loaded.after.state.loading).toBe(false);
    expect(loaded.ok && loaded.after.state.profile).toEqual({ name: "Ada" });
    expect(loaded.ok && loaded.after.state).not.toHaveProperty("error");

    const rawHandled = await app.actions.markRawHandled.submit();

    expect(rawHandled.ok && rawHandled.after.state.rawHandled).toBe(true);

    app.dispose();
  });

  it("rejects non-FieldRef inputs and reserved platform namespaces at runtime", () => {
    const effects = defineEffects<EffectsDomain>(({ set, merge }, MEL) => {
      expect(() => set(MEL.computed as never, true as never)).toThrowError(
        expect.objectContaining({
          code: "SCHEMA_ERROR",
        }),
      );

      expect(() => set({ __kind: "FieldRef", name: "$host" } as never, true as never)).toThrowError(
        expect.objectContaining({
          code: "SCHEMA_ERROR",
        }),
      );

      expect(() => merge(MEL.state.profile, [] as never)).toThrowError(
        expect.objectContaining({
          code: "SCHEMA_ERROR",
        }),
      );

      return {};
    });

    expect(effects).toEqual({});
  });

  it("surfaces helpful ManifestoError messages for runtime misuse", async () => {
    const effects = defineEffects<EffectsDomain>(({ set }, MEL) => ({
      "api.fetchUser": async () => {
        set(MEL.actions.fetchUser as never, null as never);
        return [];
      },
    }));

    await expect(effects["api.fetchUser"]({}, { snapshot: {} as never })).rejects.toMatchObject({
      code: "SCHEMA_ERROR",
      message: "PatchBuilder.set() expects a FieldRef from defineEffects(..., MEL.state.*)",
    });
  });
});
