import { describe, it, expect } from "vitest";
import { compileMelDomain, lowerSystemValues } from "@manifesto-ai/compiler";
import { createManifesto } from "../index.js";
import type { Snapshot } from "../index.js";

/**
 * SDK-CONFIG-3: If snapshot is omitted, createManifesto MUST derive
 * genesis snapshot from schema defaults.
 *
 * Fixes: #240 (F-003), #249 (F-013), #250 (F-014)
 */

function compileAndCreate(mel: string) {
  const result = compileMelDomain(mel);
  expect(result.errors).toHaveLength(0);
  if (!result.schema) throw new Error("compilation produced no schema");

  const lowered = lowerSystemValues(result.schema);
  if (!lowered) throw new Error("lowerSystemValues returned null");

  return createManifesto({ schema: lowered, effects: {} });
}

describe("genesis snapshot defaults (SDK-CONFIG-3)", () => {
  it("populates schema defaults into genesis snapshot", () => {
    const instance = compileAndCreate(`
      domain Counter {
        state {
          count: number = 0
          label: string = "untitled"
        }
      }
    `);

    try {
      const snap = instance.getSnapshot();
      const data = snap.data as Record<string, unknown>;
      expect(data.count).toBe(0);
      expect(data.label).toBe("untitled");
    } finally {
      instance.dispose();
    }
  });

  it("omits fields without defaults", () => {
    const instance = compileAndCreate(`
      domain Partial {
        state {
          name: string = "default"
          optional: string
        }
      }
    `);

    try {
      const snap = instance.getSnapshot();
      const data = snap.data as Record<string, unknown>;
      expect(data.name).toBe("default");
      expect(data).not.toHaveProperty("optional");
    } finally {
      instance.dispose();
    }
  });

  it("preserves complex default values (arrays, objects)", () => {
    const instance = compileAndCreate(`
      domain Complex {
        state {
          items: Array<string> = []
          config: object = {}
        }
      }
    `);

    try {
      const snap = instance.getSnapshot();
      const data = snap.data as Record<string, unknown>;
      expect(data.items).toEqual([]);
      expect(data.config).toEqual({});
    } finally {
      instance.dispose();
    }
  });

  it("includes platform namespace defaults ($host, $mel)", () => {
    const instance = compileAndCreate(`
      domain Minimal {
        state {
          count: number = 0
        }
      }
    `);

    try {
      const snap = instance.getSnapshot();
      const data = snap.data as Record<string, unknown>;
      expect(data.$host).toEqual({});
      expect(data.$mel).toEqual({ guards: { intent: {} } });
    } finally {
      instance.dispose();
    }
  });

  it("uses provided snapshot instead of defaults (SDK-CONFIG-2)", () => {
    const result = compileMelDomain(`
      domain Counter {
        state {
          count: number = 0
        }
      }
    `);
    expect(result.errors).toHaveLength(0);
    if (!result.schema) throw new Error("compilation produced no schema");

    const lowered = lowerSystemValues(result.schema);
    if (!lowered) throw new Error("lowerSystemValues returned null");

    const restoredSnapshot: Snapshot<Record<string, unknown>> = {
      data: { count: 42, $host: {}, $mel: { guards: { intent: {} } } },
      computed: {},
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      input: null,
      meta: {
        version: 10,
        timestamp: 1000,
        randomSeed: "restored",
        schemaHash: lowered.hash,
      },
    };

    const instance = createManifesto({
      schema: lowered,
      effects: {},
      snapshot: restoredSnapshot,
    });

    try {
      const snap = instance.getSnapshot();
      const data = snap.data as Record<string, unknown>;
      expect(data.count).toBe(42);
      expect(snap.meta.version).toBe(10);
    } finally {
      instance.dispose();
    }
  });

  it("is deterministic — same schema produces same genesis snapshot", () => {
    const mel = `
      domain Det {
        state {
          count: number = 0
          name: string = "test"
        }
      }
    `;

    const instance1 = compileAndCreate(mel);
    const instance2 = compileAndCreate(mel);

    try {
      const data1 = instance1.getSnapshot().data as Record<string, unknown>;
      const data2 = instance2.getSnapshot().data as Record<string, unknown>;

      expect(data1.count).toBe(data2.count);
      expect(data1.name).toBe(data2.name);
    } finally {
      instance1.dispose();
      instance2.dispose();
    }
  });
});
