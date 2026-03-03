import { describe, it, expect } from "vitest";
import {
  compileMelDomain,
  lowerSystemValues,
} from "@manifesto-ai/compiler";
import { createManifesto } from "../index.js";

describe("SDK stack integration: compiler-lowered system values", () => {
  it("hydrates $system.uuid and $system.time.now via createManifesto dispatch", async () => {
    const result = compileMelDomain(
      `
      domain SystemRuntime {
        state {
          entries: Array<object> = []
        }

        action appendEntry() {
          when true {
            patch entries = append(entries, {
              id: $system.uuid,
              createdAt: $system.time.now,
            })
          }
        }
      }
      `,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.schema).not.toBeNull();
    if (result.schema === null) return;

    const lowered = lowerSystemValues(result.schema);
    if (!lowered) return;

    const instance = createManifesto({
      schema: lowered,
      effects: {},
    });

    try {
      instance.dispatch({ type: "appendEntry", intentId: "test-intent-1" });

      // Wait for async dispatch processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const snapshot = instance.getSnapshot();
      const data = snapshot.data as { entries: unknown[] };
      const entries = data.entries;
      expect(entries).toHaveLength(1);

      const item = entries[0] as { id: unknown; createdAt: unknown };
      expect(item.id).toEqual(expect.any(String));
      expect(item.createdAt).not.toBeUndefined();
      expect(typeof item.createdAt).toBe("number");
    } finally {
      instance.dispose();
    }
  });

  it("rejects dispatch on disposed instance", () => {
    const result = compileMelDomain(
      `
      domain Empty {
        state {
          count: number = 0
        }
        action inc() {
          when true {
            patch count = count + 1
          }
        }
      }
      `,
    );

    expect(result.errors).toHaveLength(0);
    if (!result.schema) return;

    const lowered = lowerSystemValues(result.schema);
    if (!lowered) return;

    const instance = createManifesto({
      schema: lowered,
      effects: {},
    });

    instance.dispose();

    expect(() => {
      instance.dispatch({ type: "inc", intentId: "test-2" });
    }).toThrow("disposed");
  });
});
