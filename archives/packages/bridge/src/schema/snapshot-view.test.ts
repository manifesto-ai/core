import { describe, it, expect } from "vitest";
import { createSnapshotView } from "./snapshot-view.js";

describe("createSnapshotView", () => {
  it("deep freezes data and computed", () => {
    const data = { nested: { value: 1 } };
    const view = createSnapshotView(data, { total: { value: 2 } });

    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.data)).toBe(true);
    expect(Object.isFrozen((view.data as { nested: unknown }).nested)).toBe(true);
    expect(Object.isFrozen(view.computed)).toBe(true);
    expect(Object.isFrozen((view.computed as { total: unknown }).total)).toBe(true);
  });
});
