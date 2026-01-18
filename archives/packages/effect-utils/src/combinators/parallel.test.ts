import { describe, it, expect } from "vitest";
import { parallel } from "./parallel.js";

describe("parallel", () => {
  it("should execute all functions concurrently", async () => {
    const results = await parallel({
      a: async () => 1,
      b: async () => 2,
      c: async () => 3,
    })();

    expect(results.a).toEqual({ status: "fulfilled", value: 1 });
    expect(results.b).toEqual({ status: "fulfilled", value: 2 });
    expect(results.c).toEqual({ status: "fulfilled", value: 3 });
  });

  it("should return partial failures with Settled", async () => {
    const results = await parallel({
      a: async () => 1,
      b: async () => {
        throw new Error("fail b");
      },
      c: async () => 3,
    })();

    expect(results.a).toEqual({ status: "fulfilled", value: 1 });
    expect(results.b.status).toBe("rejected");
    expect((results.b as { status: "rejected"; reason: Error }).reason.message).toBe("fail b");
    expect(results.c).toEqual({ status: "fulfilled", value: 3 });
  });

  it("should throw on first failure when failFast is true", async () => {
    await expect(
      parallel(
        {
          a: async () => 1,
          b: async () => {
            throw new Error("fail b");
          },
          c: async () => 3,
        },
        { failFast: true }
      )()
    ).rejects.toThrow("fail b");
  });

  it("should preserve key order in results", async () => {
    const results = await parallel({
      first: async () => "a",
      second: async () => "b",
      third: async () => "c",
    })();

    const keys = Object.keys(results);
    expect(keys).toEqual(["first", "second", "third"]);
  });
});
