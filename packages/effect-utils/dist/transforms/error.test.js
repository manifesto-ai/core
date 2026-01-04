import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toErrorPatch, toErrorPatches } from "./error.js";
describe("toErrorPatch", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should create error patch from Error object", () => {
        const error = new Error("Something went wrong");
        const patch = toErrorPatch("data.error", error);
        expect(patch.op).toBe("set");
        expect(patch.path).toBe("data.error");
        if (patch.op === "set") {
            expect(patch.value).toMatchObject({
                $error: true,
                code: "Error",
                message: "Something went wrong",
                timestamp: expect.any(Number),
            });
        }
    });
    it("should create error patch from custom error object", () => {
        const patch = toErrorPatch("data.error", {
            code: "CUSTOM_ERROR",
            message: "Custom message",
        });
        expect(patch.op).toBe("set");
        if (patch.op === "set") {
            expect(patch.value).toMatchObject({
                $error: true,
                code: "CUSTOM_ERROR",
                message: "Custom message",
                timestamp: expect.any(Number),
            });
        }
    });
});
describe("toErrorPatches", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should create system.lastError patch", () => {
        const error = new Error("Failed");
        const patches = toErrorPatches(error);
        expect(patches).toHaveLength(1);
        expect(patches[0].path).toBe("system.lastError");
        expect(patches[0].op).toBe("set");
        if (patches[0].op === "set") {
            expect(patches[0].value).toMatchObject({
                $error: true,
                code: "Error",
                message: "Failed",
            });
        }
    });
    it("should create both system and custom path patches", () => {
        const error = new Error("Failed");
        const patches = toErrorPatches(error, "data.loadError");
        expect(patches).toHaveLength(2);
        expect(patches[0].path).toBe("system.lastError");
        expect(patches[1].path).toBe("data.loadError");
    });
});
//# sourceMappingURL=error.test.js.map