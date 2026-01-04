import { describe, it, expect } from "vitest";
import { withFallback } from "./fallback.js";
describe("withFallback", () => {
    it("should return value on success", async () => {
        const fn = async () => "success";
        const wrapped = withFallback(fn, "fallback");
        expect(await wrapped()).toBe("success");
    });
    it("should return static fallback on failure", async () => {
        const fn = async () => {
            throw new Error("fail");
        };
        const wrapped = withFallback(fn, "fallback");
        expect(await wrapped()).toBe("fallback");
    });
    it("should call function fallback with error", async () => {
        const fn = async () => {
            throw new Error("custom error");
        };
        const wrapped = withFallback(fn, (error) => `Caught: ${error.message}`);
        expect(await wrapped()).toBe("Caught: custom error");
    });
    it("should support async fallback function", async () => {
        const fn = async () => {
            throw new Error("fail");
        };
        const wrapped = withFallback(fn, async () => {
            await Promise.resolve();
            return "async fallback";
        });
        expect(await wrapped()).toBe("async fallback");
    });
    it("should propagate error from fallback function", async () => {
        const fn = async () => {
            throw new Error("original");
        };
        const wrapped = withFallback(fn, () => {
            throw new Error("fallback error");
        });
        await expect(wrapped()).rejects.toThrow("fallback error");
    });
});
//# sourceMappingURL=fallback.test.js.map