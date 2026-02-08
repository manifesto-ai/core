import { describe, it, expect } from "vitest";
import { VirtualFS } from "../virtual-fs.js";

describe("VirtualFS", () => {
  it("stores and retrieves files", () => {
    const vfs = new VirtualFS();
    vfs.applyPatch({ op: "set", path: "a.ts", content: "hello" }, "p1");
    expect(vfs.getFiles()).toEqual([{ path: "a.ts", content: "hello" }]);
  });

  it("returns files in lexicographic order (DET-5)", () => {
    const vfs = new VirtualFS();
    vfs.applyPatch({ op: "set", path: "z.ts", content: "z" }, "p1");
    vfs.applyPatch({ op: "set", path: "a.ts", content: "a" }, "p1");
    vfs.applyPatch({ op: "set", path: "m.ts", content: "m" }, "p1");
    const paths = vfs.getFiles().map((f) => f.path);
    expect(paths).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  describe("collision rules", () => {
    it("errors on duplicate set from same plugin (FP-5)", () => {
      const vfs = new VirtualFS();
      vfs.applyPatch({ op: "set", path: "a.ts", content: "v1" }, "p1");
      const d = vfs.applyPatch({ op: "set", path: "a.ts", content: "v2" }, "p1");
      expect(d).toBeDefined();
      expect(d!.level).toBe("error");
    });

    it("errors on duplicate set from different plugins (FP-5)", () => {
      const vfs = new VirtualFS();
      vfs.applyPatch({ op: "set", path: "a.ts", content: "v1" }, "p1");
      const d = vfs.applyPatch({ op: "set", path: "a.ts", content: "v2" }, "p2");
      expect(d).toBeDefined();
      expect(d!.level).toBe("error");
    });

    it("allows delete then set", () => {
      const vfs = new VirtualFS();
      vfs.applyPatch({ op: "set", path: "a.ts", content: "v1" }, "p1");
      vfs.applyPatch({ op: "delete", path: "a.ts" }, "p2");
      const d = vfs.applyPatch({ op: "set", path: "a.ts", content: "v2" }, "p2");
      expect(d).toBeUndefined();
      expect(vfs.getFiles()).toEqual([{ path: "a.ts", content: "v2" }]);
    });

    it("warns on set then delete (FP-6)", () => {
      const vfs = new VirtualFS();
      vfs.applyPatch({ op: "set", path: "a.ts", content: "v1" }, "p1");
      const d = vfs.applyPatch({ op: "delete", path: "a.ts" }, "p2");
      expect(d).toBeDefined();
      expect(d!.level).toBe("warn");
      expect(vfs.getFiles()).toEqual([]);
    });

    it("warns on delete of nonexistent path (FP-7)", () => {
      const vfs = new VirtualFS();
      const d = vfs.applyPatch({ op: "delete", path: "nope.ts" }, "p1");
      expect(d).toBeDefined();
      expect(d!.level).toBe("warn");
    });
  });

  it("has() checks existence", () => {
    const vfs = new VirtualFS();
    expect(vfs.has("a.ts")).toBe(false);
    vfs.applyPatch({ op: "set", path: "a.ts", content: "x" }, "p1");
    expect(vfs.has("a.ts")).toBe(true);
  });
});
