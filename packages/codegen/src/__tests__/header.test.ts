import { describe, it, expect } from "vitest";
import { generateHeader } from "../header.js";

describe("generateHeader", () => {
  it("contains @generated marker (DET-3)", () => {
    const h = generateHeader({ schemaHash: "abc123" });
    expect(h).toContain("@generated");
    expect(h).toContain("DO NOT EDIT");
  });

  it("contains schema hash (DET-4)", () => {
    const h = generateHeader({ schemaHash: "abc123" });
    expect(h).toContain("abc123");
  });

  it("contains sourceId when provided", () => {
    const h = generateHeader({ schemaHash: "abc", sourceId: "domain.mel" });
    expect(h).toContain("domain.mel");
  });

  it("uses 'unknown' when sourceId is absent", () => {
    const h = generateHeader({ schemaHash: "abc" });
    expect(h).toContain("unknown");
  });

  it("does not contain timestamp by default (DET-2)", () => {
    const h = generateHeader({ schemaHash: "abc" });
    expect(h).not.toContain("Generated at:");
  });

  it("contains timestamp when stamp=true", () => {
    const h = generateHeader({ schemaHash: "abc", stamp: true });
    expect(h).toContain("Generated at:");
  });
});
