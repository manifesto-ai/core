import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { race } from "./race.js";

describe("race", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return first successful result", async () => {
    const result = await race([
      async () => "first",
      async () => "second",
      async () => "third",
    ])();

    expect(result).toBe("first");
  });

  it("should return first success even if others fail", async () => {
    const promise = race([
      async () => {
        throw new Error("fail 1");
      },
      async () => "success",
      async () => {
        throw new Error("fail 3");
      },
    ])();

    const result = await promise;
    expect(result).toBe("success");
  });

  it("should throw AggregateError when all fail", async () => {
    await expect(
      race([
        async () => {
          throw new Error("fail 1");
        },
        async () => {
          throw new Error("fail 2");
        },
        async () => {
          throw new Error("fail 3");
        },
      ])()
    ).rejects.toThrow(AggregateError);
  });

  it("should throw AggregateError for empty array", async () => {
    await expect(race([])()).rejects.toThrow("No functions provided to race");
  });
});
