import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./retry.js";
import { RetryError } from "../errors/index.js";
describe("withRetry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should return value on first success", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        const wrapped = withRetry(fn, { maxRetries: 3 });
        const result = await wrapped();
        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
    });
    it("should retry and succeed after initial failure", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("fail1"))
            .mockResolvedValue("success");
        const wrapped = withRetry(fn, { maxRetries: 3, baseDelay: 100 });
        const promise = wrapped();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(2);
    });
    it("should throw RetryError when all retries exhausted", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("always fail"));
        const wrapped = withRetry(fn, { maxRetries: 2, baseDelay: 100 });
        const promise = wrapped();
        // Catch to prevent unhandled rejection
        promise.catch(() => { });
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
    it("should respect retryIf predicate", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));
        const wrapped = withRetry(fn, {
            maxRetries: 3,
            retryIf: () => false,
        });
        await expect(wrapped()).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(1); // No retries
    });
    it("should call onRetry callback before each retry", async () => {
        const onRetry = vi.fn();
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("fail1"))
            .mockRejectedValueOnce(new Error("fail2"))
            .mockResolvedValue("success");
        const wrapped = withRetry(fn, {
            maxRetries: 3,
            baseDelay: 100,
            onRetry,
        });
        const promise = wrapped();
        await vi.runAllTimersAsync();
        await promise;
        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
        expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
    });
    it("should apply exponential backoff", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("fail"));
        const wrapped = withRetry(fn, {
            maxRetries: 3,
            backoff: "exponential",
            baseDelay: 100,
        });
        const promise = wrapped();
        // Catch to prevent unhandled rejection
        promise.catch(() => { });
        // First retry at 100ms
        await vi.advanceTimersByTimeAsync(100);
        expect(fn).toHaveBeenCalledTimes(2);
        // Second retry at 200ms (100 * 2^1)
        await vi.advanceTimersByTimeAsync(200);
        expect(fn).toHaveBeenCalledTimes(3);
        // Third retry at 400ms (100 * 2^2)
        await vi.advanceTimersByTimeAsync(400);
        expect(fn).toHaveBeenCalledTimes(4);
        await expect(promise).rejects.toThrow(RetryError);
    });
    it("should cap delay at maxDelay", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("fail"));
        const wrapped = withRetry(fn, {
            maxRetries: 3,
            backoff: "exponential",
            baseDelay: 1000,
            maxDelay: 1500,
        });
        const promise = wrapped();
        // Catch to prevent unhandled rejection
        promise.catch(() => { });
        // First retry at 1000ms
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
        // Second retry capped at 1500ms (not 2000ms)
        await vi.advanceTimersByTimeAsync(1500);
        expect(fn).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(1500);
        expect(fn).toHaveBeenCalledTimes(4);
        await expect(promise).rejects.toThrow(RetryError);
    });
});
//# sourceMappingURL=retry.test.js.map