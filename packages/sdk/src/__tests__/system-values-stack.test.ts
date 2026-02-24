import { describe, it, expect } from "vitest";
import {
  compileMelDomain,
  lowerSystemValues,
  type CompileMelDomainResult,
} from "@manifesto-ai/compiler";
import { createTestApp } from "../index.js";

function compile(source: string): CompileMelDomainResult & { success: boolean } {
  const result = compileMelDomain(source, { mode: "domain" });
  return {
    ...result,
    success: result.errors.length === 0 && result.schema !== null,
  };
}

describe("SDK stack integration: compiler-lowered system values", () => {
  it("hydrates $system.uuid and $system.time.now in createTestApp execution", async () => {
    const result = compile(
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
      `
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    const lowered = lowerSystemValues(result.schema);
    if (!lowered) return;

    const app = createTestApp(lowered, {
      initialData: { entries: [] },
    });
    await app.ready();

    try {
      const handle = app.act("appendEntry");
      const completed = await handle.done({ timeoutMs: 5000 });
      const snapshot = await app.getSnapshot(completed.worldId);

      const entries = snapshot.data.entries;
      expect(entries).toHaveLength(1);

      const item = entries[0] as { id: unknown; createdAt: unknown };
      expect(item.id).toEqual(expect.any(String));
      expect(item.createdAt).not.toBeUndefined();
      expect(typeof item.createdAt).toBe("number");
    } finally {
      await app.dispose();
    }
  });
});
