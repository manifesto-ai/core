import { describe, it, expect } from "vitest";
import { toJcs } from "../utils/canonical.js";

describe("toJcs", () => {
  it("should serialize -0 as 0", () => {
    expect(toJcs(-0)).toBe("0");
  });

  it("should use exponent form for large and small numbers", () => {
    expect(toJcs(1e21)).toBe("1e+21");
    expect(toJcs(1e-7)).toBe("1e-7");
  });

  it("should omit undefined and symbol object properties", () => {
    const sym = Symbol("x");
    const value = { b: 1, a: undefined, c: sym, d: null };

    expect(toJcs(value)).toBe('{"b":1,"d":null}');
  });

  it("should convert non-serializable array items to null", () => {
    const sym = Symbol("x");
    const fn = () => {};

    expect(toJcs([1, undefined, fn, sym, 2])).toBe("[1,null,null,null,2]");
  });

  it("should escape control characters in strings", () => {
    const value = { text: "line\nbreak\tend" };

    expect(toJcs(value)).toBe("{\"text\":\"line\\nbreak\\tend\"}");
  });

  it("should order keys by code point, including surrogate pairs", () => {
    const keyA = "\uD834\uDD1E";
    const keyB = "\uD834\uDD1F";
    const value: Record<string, number> = {
      [keyB]: 2,
      a: 3,
      [keyA]: 1,
    };

    const expected = `{"a":3,${JSON.stringify(keyA)}:1,${JSON.stringify(keyB)}:2}`;

    expect(toJcs(value)).toBe(expected);
  });

  it("should escape quotes and backslashes", () => {
    const value = { text: "quote\"slash\\end" };

    expect(toJcs(value)).toBe("{\"text\":\"quote\\\"slash\\\\end\"}");
  });

  it("should escape null character", () => {
    const value = { text: "nul\u0000end" };

    expect(toJcs(value)).toBe("{\"text\":\"nul\\u0000end\"}");
  });
});
