import { describe, it, expect } from "vitest";
import {
  compileMelDomain,
  lowerSystemValues,
} from "@manifesto-ai/compiler";
import { createTestApp } from "../index.js";

describe("SDK stack integration: compiler-lowered system values", () => {
  it("hydrates $system.uuid and $system.time.now in createTestApp execution", async () => {
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
      `
    );

    expect(result.errors).toHaveLength(0);
    expect(result.schema).not.toBeNull();
    if (result.schema === null) return;

    const lowered = lowerSystemValues(result.schema);
    if (!lowered) return;

    const app = createTestApp(lowered, {
      initialData: { entries: [] },
    });
    await app.ready();

    try {
      const handle = app.act("appendEntry");
      const completed = await handle.done({ timeoutMs: 5000 });
      const snapshot = await app.getSnapshot(completed.worldId as Parameters<typeof app.getSnapshot>[0]);
      const data = snapshot.data as { entries: unknown[] };
      const entries = data.entries;
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
