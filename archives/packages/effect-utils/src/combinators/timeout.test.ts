import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "./timeout.js";
import { TimeoutError } from "../errors/index.js";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return value if fn completes before timeout", async () => {
    const fn = async () => "success";
    const wrapped = withTimeout(fn, 1000);

    const result = await wrapped();
    expect(result).toBe("success");
  });

  it("should throw TimeoutError if fn exceeds timeout", async () => {
    const fn = async () => {
      await new Promise((r) => setTimeout(r, 500));
      return "too late";
    };
    const wrapped = withTimeout(fn, 50);

    const promise = wrapped();
    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow(TimeoutError);
  });

  it("should preserve original error if fn throws before timeout", async () => {
    const fn = async () => {
      throw new Error("original error");
    };
    const wrapped = withTimeout(fn, 1000);

    await expect(wrapped()).rejects.toThrow("original error");
  });

  it("should use custom error message when provided", async () => {
    const fn = async () => {
      await new Promise((r) => setTimeout(r, 500));
      return "too late";
    };
    const wrapped = withTimeout(fn, 50, { message: "Custom timeout message" });

    const promise = wrapped();
    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow("Custom timeout message");
  });

  it("should include ms in TimeoutError", async () => {
    const fn = async () => {
      await new Promise((r) => setTimeout(r, 500));
      return "too late";
    };
    const wrapped = withTimeout(fn, 50);

    const promise = wrapped();
    vi.advanceTimersByTime(100);

    try {
      await promise;
    } catch (e) {
      expect(e).toBeInstanceOf(TimeoutError);
      expect((e as TimeoutError).ms).toBe(50);
    }
  });
});
