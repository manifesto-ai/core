import { describe, it, expect } from "vitest";
import { stableHash } from "../stable-hash.js";

describe("stableHash", () => {
  it("returns same hash for same input", () => {
    const a = stableHash({ foo: 1, bar: 2 });
    const b = stableHash({ foo: 1, bar: 2 });
    expect(a).toBe(b);
  });

  it("returns same hash regardless of key order", () => {
    const a = stableHash({ z: 1, a: 2 });
    const b = stableHash({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("returns different hash for different input", () => {
    const a = stableHash({ foo: 1 });
    const b = stableHash({ foo: 2 });
    expect(a).not.toBe(b);
  });

  it("returns 64-char hex string", () => {
    const h = stableHash("test");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
