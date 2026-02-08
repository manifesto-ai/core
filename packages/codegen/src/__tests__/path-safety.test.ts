import { describe, it, expect } from "vitest";
import { validatePath } from "../path-safety.js";

describe("validatePath", () => {
  describe("valid paths", () => {
    it("accepts simple filename", () => {
      const r = validatePath("types.ts");
      expect(r).toEqual({ valid: true, normalized: "types.ts" });
    });

    it("accepts nested path", () => {
      const r = validatePath("dir/sub/file.ts");
      expect(r).toEqual({ valid: true, normalized: "dir/sub/file.ts" });
    });

    it("normalizes backslashes", () => {
      const r = validatePath("dir\\file.ts");
      expect(r).toEqual({ valid: true, normalized: "dir/file.ts" });
    });

    it("normalizes leading ./", () => {
      const r = validatePath("./dir/file.ts");
      expect(r).toEqual({ valid: true, normalized: "dir/file.ts" });
    });

    it("collapses multiple slashes", () => {
      const r = validatePath("dir//sub///file.ts");
      expect(r).toEqual({ valid: true, normalized: "dir/sub/file.ts" });
    });

    it("removes trailing slash", () => {
      const r = validatePath("dir/sub/");
      expect(r).toEqual({ valid: true, normalized: "dir/sub" });
    });
  });

  describe("invalid paths", () => {
    it("rejects empty string", () => {
      const r = validatePath("");
      expect(r.valid).toBe(false);
    });

    it("rejects null bytes", () => {
      const r = validatePath("file\0.ts");
      expect(r.valid).toBe(false);
    });

    it("rejects absolute path", () => {
      const r = validatePath("/etc/passwd");
      expect(r.valid).toBe(false);
    });

    it("rejects drive letters", () => {
      const r = validatePath("C:\\Users\\file.ts");
      expect(r.valid).toBe(false);
    });

    it("rejects .. traversal", () => {
      const r = validatePath("../escape.ts");
      expect(r.valid).toBe(false);
    });

    it("rejects .. in middle of path", () => {
      const r = validatePath("dir/../escape.ts");
      expect(r.valid).toBe(false);
    });
  });
});
