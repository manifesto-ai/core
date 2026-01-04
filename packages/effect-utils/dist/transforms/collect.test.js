import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { collectErrors, collectFulfilled } from "./collect.js";
describe("collectErrors", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should extract errors from Settled results", () => {
        const results = {
            a: { status: "fulfilled", value: "data" },
            b: { status: "rejected", reason: new Error("Timeout") },
            c: { status: "rejected", reason: new Error("Not found") },
        };
        const patches = collectErrors(results, "signals.errors");
        expect(patches).toHaveLength(1);
        expect(patches[0].path).toBe("signals.errors");
        expect(patches[0].op).toBe("set");
        if (patches[0].op === "set") {
            expect(patches[0].value).toMatchObject({
                b: { $error: true, message: "Timeout" },
                c: { $error: true, message: "Not found" },
            });
        }
    });
    it("should return empty array when no errors", () => {
        const results = {
            a: { status: "fulfilled", value: 1 },
            b: { status: "fulfilled", value: 2 },
        };
        const patches = collectErrors(results, "errors");
        expect(patches).toEqual([]);
    });
});
describe("collectFulfilled", () => {
    it("should extract fulfilled values", () => {
        const results = {
            a: { status: "fulfilled", value: "data-a" },
            b: { status: "rejected", reason: new Error("fail") },
            c: { status: "fulfilled", value: "data-c" },
        };
        const fulfilled = collectFulfilled(results);
        expect(fulfilled).toEqual({
            a: "data-a",
            c: "data-c",
        });
        expect(fulfilled).not.toHaveProperty("b");
    });
    it("should return empty object when all rejected", () => {
        const results = {
            a: { status: "rejected", reason: new Error("fail a") },
            b: { status: "rejected", reason: new Error("fail b") },
        };
        const fulfilled = collectFulfilled(results);
        expect(fulfilled).toEqual({});
    });
});
//# sourceMappingURL=collect.test.js.map